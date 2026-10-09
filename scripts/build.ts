import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
	throw new Error("Usage: bun scripts/build.ts [--check]");
}
const check = args[0] === "--check";

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...await listFiles(join(directory, entry.name), relative));
		} else {
			files.push(relative);
		}
	}
	return files.sort();
}

async function compareDist(built: string): Promise<void> {
	if (!existsSync(dist)) {
		throw new Error("dist/ is missing; run bun scripts/build.ts.");
	}
	const expected = await listFiles(built);
	const actual = await listFiles(dist);
	const expectedSet = new Set(expected);
	const actualSet = new Set(actual);
	const differences: string[] = [];
	for (const file of expected) {
		if (!actualSet.has(file)) {
			differences.push(`Missing: ${file}`);
		} else if (!(await readFile(join(built, file))).equals(await readFile(join(dist, file)))) {
			differences.push(`Changed: ${file}`);
		}
	}
	for (const file of actual) {
		if (!expectedSet.has(file)) differences.push(`Unexpected: ${file}`);
	}
	if (differences.length > 0) {
		throw new Error(`dist/ is out of date; run bun scripts/build.ts.\n${differences.join("\n")}`);
	}
}

// Stage beside dist so publishing uses a same-filesystem rename. The random
// staging path never appears in artifacts (no source maps or absolute paths).
const temporary = await mkdtemp(join(root, ".build-"));
const built = join(temporary, "dist");
try {
	// Bun's source-label comments are relative to cwd, not the build root.
	// Keep them stable even when the script is invoked from another directory.
	process.chdir(root);
	const result = await Bun.build({
		entrypoints: [join(root, "index.ts"), join(root, "events.ts")],
		root,
		outdir: built,
		target: "node",
		format: "esm",
		packages: "external",
		// Both entry points must reference one shared events module.
		splitting: true,
		sourcemap: "none",
		naming: {
			entry: "[name].[ext]",
			chunk: "chunks/[name]-[hash].[ext]",
			asset: "assets/[name]-[hash].[ext]",
		},
	});
	if (!result.success) {
		throw new AggregateError(result.logs, "Build failed");
	}
	// events.ts is self-contained: emit its contract without traversing the
	// extension's runtime dependencies. The root contract is an explicit template.
	const program = ts.createProgram([join(root, "events.ts")], {
		declaration: true,
		emitDeclarationOnly: true,
		noEmitOnError: true,
		strict: true,
		types: [],
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.NodeNext,
		outDir: built,
	});
	const emitted = program.emit();
	const diagnostics = [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics];
	if (emitted.emitSkipped || diagnostics.length > 0) {
		throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
			getCurrentDirectory: () => root,
			getCanonicalFileName: (file) => file,
			getNewLine: () => "\n",
		}));
	}
	await cp(join(root, "scripts/index.d.ts.template"), join(built, "index.d.ts"));
	// The optional i18n loader resolves locales relative to index.js.
	await cp(join(root, "locales"), join(built, "locales"), { recursive: true });

	if (check) {
		await compareDist(built);
		console.log("dist/ is up to date.");
	} else {
		await rm(dist, { recursive: true, force: true });
		await rename(built, dist);
		console.log("Built dist/.");
	}
} finally {
	await rm(temporary, { recursive: true, force: true });
}
