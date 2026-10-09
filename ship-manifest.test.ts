import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("./", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function files(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? files(join(directory, entry.name)).map((file) => `${entry.name}/${file}`)
			: [entry.name],
	).sort();
}

describe("prebuilt package", () => {
	it("loads compiled entries without install-time build hooks", () => {
		expect(manifest.pi.extensions).toEqual(["./dist/index.js"]);
		expect(manifest.exports).toEqual({
			".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
			"./events": { types: "./dist/events.d.ts", default: "./dist/events.js" },
		});
		for (const entry of Object.values(manifest.exports) as Record<string, string>[]) {
			expect(Object.keys(entry)).toEqual(["types", "default"]);
			for (const path of Object.values(entry)) expect(existsSync(join(root, path))).toBe(true);
		}
		for (const hook of ["preinstall", "install", "postinstall", "prepare", "prepack"]) {
			expect(manifest.scripts[hook]).toBeUndefined();
		}
	});

	it("copies every locale beside the compiled extension without changing bytes", () => {
		const source = files(join(root, "locales"));
		expect(files(join(root, "dist/locales"))).toEqual(source);
		for (const file of source) {
			expect(readFileSync(join(root, "dist/locales", file)))
			.toEqual(readFileSync(join(root, "locales", file)));
		}
	});

	it("ships all built modules and resources, without development source or tools", () => {
		const [pack] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
			cwd: root,
			encoding: "utf8",
		}));
		const packed = pack.files.map((file: { path: string }) => file.path);
		for (const file of files(join(root, "dist"))) expect(packed).toContain(`dist/${file}`);
		for (const file of ["package.json", "LICENSE", "NOTICE.md", "README.md"]) expect(packed).toContain(file);
		for (const file of ["dist/index.d.ts", "dist/events.d.ts"]) expect(packed).toContain(file);
		expect(packed.some((file: string) =>
			(file.endsWith(".ts") && !file.endsWith(".d.ts")) ||
			/^(?:scripts\/|tests\/|node_modules\/|PLAN\.md$)/.test(file),
		)).toBe(false);
	});

	it("loads the shipped module graph and registers the extension in Node", () => {
		execFileSync(process.execPath, ["--input-type=module", "--eval", `
			import assert from "node:assert/strict";
			import { readdir } from "node:fs/promises";
			import { pathToFileURL } from "node:url";
			const dist = new URL("./dist/", pathToFileURL(process.cwd() + "/"));
			const entry = await import(new URL("index.js", dist));
			const events = await import(new URL("events.js", dist));
			assert.equal(events.ASK_USER_PROMPT_EVENT, "rpiv:ask-user:prompt");
			assert.equal(events.ASK_USER_BLOCKED_EVENT, "rpiv:ask-user:blocked");
			for (const [key, value] of Object.entries(events)) assert.equal(entry[key], value);
			const tools = new Map();
			const handlers = new Map();
			entry.default({
				registerTool(tool) { tools.set(tool.name, tool); },
				on(event, handler) { handlers.set(event, handler); },
			});
			assert.equal(typeof tools.get("ask_user_question")?.execute, "function");
			assert.equal(typeof handlers.get("before_agent_start"), "function");
			async function loadGraph(directory) {
				for (const file of await readdir(directory, { withFileTypes: true })) {
					const url = new URL(file.name + (file.isDirectory() ? "/" : ""), directory);
					if (file.isDirectory()) await loadGraph(url);
					else if (file.name.endsWith(".js")) await import(url);
				}
			}
			await loadGraph(dist);
		`], { cwd: root, encoding: "utf8" });
	});

	it("typechecks the public contracts through both package entrypoints", () => {
		execFileSync(process.execPath, [
			join(root, "node_modules/typescript/bin/tsc"),
			"-p", join(root, "tests/types/tsconfig.json"),
		], { cwd: root, encoding: "utf8" });
	});

	it("keeps host libraries and optional localization external", () => {
		const javascript = files(join(root, "dist"))
			.filter((file) => file.endsWith(".js"))
			.map((file) => readFileSync(join(root, "dist", file), "utf8"))
			.join("\n");
		expect(javascript).toContain('from "@earendil-works/pi-tui"');
		expect(javascript).toContain('from "@earendil-works/pi-coding-agent"');
		expect(javascript).toContain('from "typebox"');
		expect(javascript).toContain('import("@juicesharp/rpiv-i18n/loader")');
		expect(javascript).not.toContain("node_modules/");
	});
});
