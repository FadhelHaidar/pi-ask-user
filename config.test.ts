import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	type AskUserQuestionConfig,
	COLLAPSE_KEY_OFF,
	DEFAULT_COLLAPSE_KEY,
	DEFAULT_NOTES_KEY,
	formatKeySpecForDisplay,
	formatNotesKeyForDisplay,
	loadConfig,
	resolveCollapseKey,
	resolveNotesKey,
} from "./config.js";

describe("resolveNotesKey", () => {
	it("defaults to `n`", () => {
		expect(resolveNotesKey({})).toBe(DEFAULT_NOTES_KEY);
		expect(resolveNotesKey({ notesKey: "  " })).toBe(DEFAULT_NOTES_KEY);
	});

	it("accepts any single character, including non-Latin ones", () => {
		expect(resolveNotesKey({ notesKey: "m" })).toBe("m");
		expect(resolveNotesKey({ notesKey: "т" })).toBe("т");
	});

	it("accepts a key spec and normalizes its case", () => {
		expect(resolveNotesKey({ notesKey: "Ctrl+N" })).toBe("ctrl+n");
		expect(resolveNotesKey({ notesKey: "alt+;" })).toBe("alt+;");
	});

	it("falls back to `n` for keys the questionnaire already navigates with", () => {
		for (const reserved of ["space", "enter", "tab", "escape", "up", "down", "left", "right"]) {
			expect(resolveNotesKey({ notesKey: reserved })).toBe(DEFAULT_NOTES_KEY);
		}
	});

	it("falls back to `n` for a malformed spec", () => {
		expect(resolveNotesKey({ notesKey: "ctr+n" })).toBe(DEFAULT_NOTES_KEY);
		expect(resolveNotesKey({ notesKey: "notakey" })).toBe(DEFAULT_NOTES_KEY);
	});

	it("falls back to `n` for a wrongly typed value instead of throwing", () => {
		// lib/config-io.ts validates only the outer object, so the field arrives as authored.
		for (const wrong of [7, true, {}, [], null]) {
			expect(resolveNotesKey({ notesKey: wrong as unknown as string })).toBe(DEFAULT_NOTES_KEY);
		}
	});
});

describe("formatNotesKeyForDisplay", () => {
	it("shows a single character as configured and display-cases a spec", () => {
		expect(formatNotesKeyForDisplay("n")).toBe("n");
		expect(formatNotesKeyForDisplay("т")).toBe("т");
		expect(formatNotesKeyForDisplay("ctrl+n")).toBe("Ctrl+N");
	});

	it("falls back to the default for a missing key (stale outer module)", () => {
		expect(formatNotesKeyForDisplay(undefined)).toBe(DEFAULT_NOTES_KEY);
		expect(formatNotesKeyForDisplay("")).toBe(DEFAULT_NOTES_KEY);
	});
});

describe("formatKeySpecForDisplay", () => {
	it("capitalizes each +-part of a resolved spec", () => {
		expect(formatKeySpecForDisplay("ctrl+]")).toBe("Ctrl+]");
		expect(formatKeySpecForDisplay("alt+o")).toBe("Alt+O");
		expect(formatKeySpecForDisplay("ctrl+shift+h")).toBe("Ctrl+Shift+H");
	});

	it("handles named special keys and bare keys", () => {
		expect(formatKeySpecForDisplay("f9")).toBe("F9");
		expect(formatKeySpecForDisplay("alt+escape")).toBe("Alt+Escape");
		expect(formatKeySpecForDisplay("]")).toBe("]");
	});

	it("cases compound-word named keys conventionally", () => {
		expect(formatKeySpecForDisplay("ctrl+pagedown")).toBe("Ctrl+PageDown");
		expect(formatKeySpecForDisplay("pageup")).toBe("PageUp");
	});

	it("round-trips the default key to the historical hint casing", () => {
		expect(formatKeySpecForDisplay(DEFAULT_COLLAPSE_KEY)).toBe("Ctrl+]");
	});
});

describe("resolveCollapseKey", () => {
	it("returns the default when config has no collapseKey", () => {
		expect(resolveCollapseKey({})).toBe(DEFAULT_COLLAPSE_KEY);
		expect(resolveCollapseKey({ collapseKey: undefined })).toBe(DEFAULT_COLLAPSE_KEY);
	});

	it("returns the default when collapseKey is empty or whitespace", () => {
		expect(resolveCollapseKey({ collapseKey: "" })).toBe(DEFAULT_COLLAPSE_KEY);
		expect(resolveCollapseKey({ collapseKey: "   " })).toBe(DEFAULT_COLLAPSE_KEY);
	});

	it("normalizes the spec (trim + lowercase)", () => {
		expect(resolveCollapseKey({ collapseKey: "  Ctrl+}  " })).toBe("ctrl+}");
		expect(resolveCollapseKey({ collapseKey: "ALT+O" })).toBe("alt+o");
	});

	it("returns the off sentinel unchanged (case-insensitive)", () => {
		expect(resolveCollapseKey({ collapseKey: "off" })).toBe(COLLAPSE_KEY_OFF);
		expect(resolveCollapseKey({ collapseKey: "OFF" })).toBe(COLLAPSE_KEY_OFF);
		expect(resolveCollapseKey({ collapseKey: "  off  " })).toBe(COLLAPSE_KEY_OFF);
	});

	it("falls back to the default for malformed specs", () => {
		// Leading/trailing +, double ++, or empty
		expect(resolveCollapseKey({ collapseKey: "+ctrl+]" })).toBe(DEFAULT_COLLAPSE_KEY);
		expect(resolveCollapseKey({ collapseKey: "ctrl++" })).toBe(DEFAULT_COLLAPSE_KEY);
		// The default itself is valid
		expect(resolveCollapseKey({ collapseKey: "ctrl+]" })).toBe("ctrl+]");
		// Multi-modifier specs are valid
		expect(resolveCollapseKey({ collapseKey: "ctrl+shift+h" })).toBe("ctrl+shift+h");
	});

	it("falls back to the default for typo'd modifiers and unknown key names", () => {
		// `ctr+]` is the dangerous one: pi-tui's parseKeyId takes the LAST `+`-part as
		// the key and ignores unknown parts, so an unvalidated `ctr+]` would match every
		// bare `]` keypress and the raw terminal listener would consume them globally.
		expect(resolveCollapseKey({ collapseKey: "ctr+]" })).toBe(DEFAULT_COLLAPSE_KEY);
		expect(resolveCollapseKey({ collapseKey: "control+]" })).toBe(DEFAULT_COLLAPSE_KEY);
		expect(resolveCollapseKey({ collapseKey: "ctrl+nosuchkey" })).toBe(DEFAULT_COLLAPSE_KEY);
		expect(resolveCollapseKey({ collapseKey: "hello" })).toBe(DEFAULT_COLLAPSE_KEY);
		// Duplicate modifiers are not part of the KeyId grammar
		expect(resolveCollapseKey({ collapseKey: "ctrl+ctrl+]" })).toBe(DEFAULT_COLLAPSE_KEY);
	});

	it("accepts named special keys and bare base keys", () => {
		expect(resolveCollapseKey({ collapseKey: "ctrl+pageup" })).toBe("ctrl+pageup");
		expect(resolveCollapseKey({ collapseKey: "Ctrl+PageUp" })).toBe("ctrl+pageup");
		expect(resolveCollapseKey({ collapseKey: "f5" })).toBe("f5");
		expect(resolveCollapseKey({ collapseKey: "alt+escape" })).toBe("alt+escape");
	});
});

describe("loadConfig", () => {
	// Use the test HOME set by the project's setup.ts. The config module resolves
	// `~` at import time, so we use the directory that setup.ts has already wired up
	// and write a per-test config inside it.
	const home = process.env.HOME ?? "";
	const configPath = join(home, ".config", "rpiv-ask-user-question", "config.json");

	// We can't mutate HOME here (configPath was resolved at import time, see
	// the read in `loadJsonConfig` for the design rationale), so we test against
	// the directory setup.ts points at and clean up after ourselves.
	const removeConfig = (): void => {
		if (existsSync(configPath)) rmSync(configPath);
	};

	afterEach(removeConfig);

	it("returns an empty config when no file is present", () => {
		removeConfig();
		expect(loadConfig().collapseKey).toBeUndefined();
	});

	it("reads a valid JSON config", () => {
		mkdirSync(join(home, ".config", "rpiv-ask-user-question"), { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify({ collapseKey: "alt+o", guidance: { promptSnippet: "x" } } satisfies AskUserQuestionConfig),
		);
		const c = loadConfig();
		expect(c.collapseKey).toBe("alt+o");
		expect(c.guidance?.promptSnippet).toBe("x");
	});
});
