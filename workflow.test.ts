import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("./", import.meta.url));
const workflow = readFileSync(join(root, ".github/workflows/test.yml"), "utf8");
const release = readFileSync(join(root, ".github/workflows/release.yml"), "utf8");
// Extract the actual inline publishing shell, not a reimplementation of it.
const marker = "      - name: Commit tested dist if main is unchanged\n        run: |\n";
const publishingShell = workflow.split(marker)[1]?.split("\n")
	.map((line) => line.replace(/^          /, "")).join("\n");
const temporary: string[] = [];
afterEach(() => {
	for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "ask-user-workflow-"));
	temporary.push(directory);
	const remote = join(directory, "remote.git");
	const checkout = join(directory, "checkout");
	const git = (...args: string[]) => execFileSync("git", args, {
		cwd: checkout,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
	execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
	mkdirSync(checkout);
	git("init", "-b", "main");
	git("config", "user.name", "Workflow fixture");
	git("config", "user.email", "fixture@example.invalid");
	mkdirSync(join(checkout, "dist"));
	writeFileSync(join(checkout, "dist/index.js"), "old build\n");
	writeFileSync(join(checkout, "dist/old-chunk.js"), "old chunk\n");
	writeFileSync(join(checkout, "source.ts"), "original source\n");
	git("add", ".");
	git("commit", "-m", "fixture base");
	const sha = git("rev-parse", "HEAD");
	git("remote", "add", "origin", remote);
	git("push", "origin", "main");
	git("checkout", "--detach", sha);
	const changeDist = () => {
		writeFileSync(join(checkout, "dist/index.js"), "tested build\n");
		rmSync(join(checkout, "dist/old-chunk.js"));
		writeFileSync(join(checkout, "dist/new-chunk.js"), "new chunk\n");
	};
	const publish = () => {
		if (!publishingShell) throw new Error("Publishing shell not found");
		return spawnSync("bash", ["-c", publishingShell], {
			cwd: checkout,
			encoding: "utf8",
			env: { ...process.env, GITHUB_SHA: sha },
		});
	};
	return { checkout, remote, git, sha, changeDist, publish };
}

describe("automatic build workflow", () => {
	it("builds branch pushes and PRs before validation, with write access only for main publication", () => {
		expect(workflow).toContain("  push:\n    branches:\n      - '**'\n  pull_request:");
		expect(workflow).toContain("permissions:\n  contents: read\n");
		const testJob = workflow.split("  test:\n")[1].split("  publish-dist:\n")[0];
		const commands = [...testJob.matchAll(/- run: (bun .*)/g)].map((match) => match[1]);
		expect(commands).toEqual([
			"bun install --frozen-lockfile", "bun run build", "bun run build:check",
			"bun run typecheck", "bun run test",
		]);
		expect(testJob).toContain("persist-credentials: false");
		expect(testJob.indexOf("actions/upload-artifact@v4")).toBeGreaterThan(testJob.indexOf("bun run test"));
		const publishJob = workflow.split("  publish-dist:\n")[1];
		expect(publishJob).toContain("needs: test");
		expect(publishJob).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
		expect(publishJob).toContain("permissions:\n      contents: write");
		expect(publishJob).toContain("ref: ${{ github.sha }}");
		expect(publishJob.indexOf("rm -rf dist")).toBeLessThan(publishJob.indexOf("actions/download-artifact@v4"));
		expect(publishJob).not.toMatch(/--force|GH_TOKEN|secrets\./);
	});

	it("keeps tag releases validating checked-in dist before tests and packing", () => {
		expect(release).toContain("tags:\n      - 'v*'");
		expect(release).toContain("if (actual !== expected)");
		expect(release).not.toMatch(/run: bun run build\s*\n/);
		expect(release.indexOf("Validate release tag")).toBeLessThan(release.indexOf("bun run build:check"));
		expect(release.indexOf("bun run build:check")).toBeLessThan(release.indexOf("bun run test"));
		expect(release.indexOf("bun run test")).toBeLessThan(release.indexOf("npm pack --ignore-scripts"));
	});

	it("publishes only changed dist, including deletions, from the tested detached HEAD", () => {
		const { checkout, git, sha, changeDist, publish } = fixture();
		changeDist();
		writeFileSync(join(checkout, "source.ts"), "unstaged source change\n");
		const result = publish();
		expect(result.status, result.stderr).toBe(0);
		const published = git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0];
		expect(published).not.toBe(sha);
		expect(git("rev-parse", `${published}^`)).toBe(sha);
		expect(git("diff-tree", "--no-commit-id", "--name-only", "-r", published).split("\n"))
			.toEqual(["dist/index.js", "dist/new-chunk.js", "dist/old-chunk.js"]);
		expect(git("show", `${published}:source.ts`)).toBe("original source");
		expect(git("status", "--porcelain")).toBe("M source.ts");
	});

	it("does not create a commit when dist is unchanged", () => {
		const { git, sha, publish } = fixture();
		const result = publish();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("dist/ is already current.");
		expect(git("rev-parse", "HEAD")).toBe(sha);
	});

	it("skips a stale workflow HEAD without staging or changing main", () => {
		const { checkout, git, sha, changeDist, publish } = fixture();
		writeFileSync(join(checkout, "source.ts"), "newer source\n");
		git("add", "source.ts");
		git("commit", "-m", "newer main");
		const newer = git("rev-parse", "HEAD");
		git("push", "origin", "HEAD:refs/heads/main");
		git("checkout", "--detach", sha);
		changeDist();
		const result = publish();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("main advanced");
		expect(git("diff", "--cached", "--name-only")).toBe("");
		expect(git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]).toBe(newer);
	});

	it("rejects a main update racing after the stale-HEAD check without force-pushing", () => {
		const { checkout, remote, git, sha, changeDist, publish } = fixture();
		writeFileSync(join(checkout, "source.ts"), "racing source\n");
		git("add", "source.ts");
		git("commit", "-m", "racing main");
		const newer = git("rev-parse", "HEAD");
		git("push", "origin", "HEAD:refs/heads/racing");
		git("checkout", "--detach", sha);
		changeDist();
		// Move the disposable bare remote at the exact pre-push seam.
		writeFileSync(join(checkout, ".git/hooks/pre-push"),
			`#!/bin/sh\ngit --git-dir='${remote}' update-ref refs/heads/main ${newer} ${sha}\n`,
			{ mode: 0o755 });
		const result = publish();
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("rejected");
		expect(git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]).toBe(newer);
	});
});
