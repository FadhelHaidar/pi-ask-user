import { getKeybindings } from "@earendil-works/pi-tui";
import { createMockCtx, createMockPi } from "@juicesharp/rpiv-test-utils";
import { describe, expect, it, vi } from "vitest";
import { registerAskUserQuestionTool } from "./ask-user-question.js";
import { HOST_ALLOCATED_ROWS, resolvePresentation } from "./presentation.js";
import type { QuestionnaireSessionComponent } from "./state/questionnaire-session.js";
import type { QuestionnaireResult } from "./tool/types.js";
import { HINT_PART_CANCEL } from "./view/dialog-copy.js";

type Factory = (
	tui: unknown,
	theme: unknown,
	keybindings: unknown,
	done: (result: QuestionnaireResult) => void,
) => QuestionnaireSessionComponent;
type CustomOptions = { overlay?: boolean; overlayOptions?: unknown };

const DOWN = "\x1b[B";
const ENTER = "\r";
const COLLAPSE = "\x1d"; // ctrl+]

const twoOptions = {
	questions: [
		{
			question: "Where should the dialog appear?",
			header: "Layout",
			options: [{ label: "Inline" }, { label: "Overlay" }],
		},
	],
};

// Renders taller than the inline budget on a 24-row terminal.
const fourDescribedOptions = {
	questions: [
		{
			question: "Which approach should we take for the cache layer?",
			header: "Cache",
			options: [1, 2, 3, 4].map((i) => ({
				label: `Option ${i}`,
				description: `A reasonably long description of option ${i} that explains the trade-off.`,
			})),
		},
	],
};

const theme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
	bold: (text: string) => text,
};

/** Occupy the inline slot as a concurrent questionnaire would, so the next one falls back to the overlay. */
async function withInlineSlotHeld(body: () => Promise<void>): Promise<void> {
	const holder = resolvePresentation();
	try {
		await body();
	} finally {
		holder.release?.();
	}
}

function mount(factory: Factory, rows = 24, done: (r: QuestionnaireResult) => void = () => {}, tui: object = {}) {
	return factory({ requestRender() {}, terminal: { columns: 100, rows }, ...tui }, theme, getKeybindings(), done);
}

function setup(custom: (factory: Factory, options?: CustomOptions) => Promise<unknown>) {
	const { pi, captured } = createMockPi();
	registerAskUserQuestionTool(pi);
	const removeListener = vi.fn();
	const onTerminalInput = vi.fn(() => removeListener);
	const ctx = createMockCtx({ hasUI: true, ui: { custom: vi.fn(custom), onTerminalInput } as never });
	const run = (params: object) =>
		captured.tools.get("ask_user_question")!.execute!("tc", params as never, undefined, undefined, ctx as never);
	return { run, ctx, onTerminalInput, removeListener };
}

describe("inline presentation", () => {
	it("mounts in the editor slot and registers no raw collapse listener", async () => {
		const { run, ctx, onTerminalInput } = setup(async () => ({ answers: [], cancelled: true }));
		await run(twoOptions);
		expect(vi.mocked(ctx.ui.custom).mock.calls[0]?.[1]).toEqual({ overlay: false });
		expect(onTerminalInput).not.toHaveBeenCalled();
	});

	it("collapses to a visible row without a raw listener, and still submits", async () => {
		const { run, ctx, onTerminalInput } = setup(async (factory, options) => {
			expect(options).toEqual({ overlay: false });
			let result: QuestionnaireResult | undefined;
			const component = mount(factory, 24, (answer) => {
				result = answer;
			});
			expect(component.render(100).length).toBeGreaterThan(1);
			// No overlay handle to hide: collapse keeps a focused one-row component that re-expands.
			component.handleInput(COLLAPSE);
			expect(component.render(100)).toHaveLength(1);
			component.handleInput(COLLAPSE);
			expect(component.render(100).length).toBeGreaterThan(1);
			component.handleInput(ENTER);
			return result;
		});
		const result = await run(twoOptions);
		expect(ctx.ui.custom).toHaveBeenCalledOnce();
		expect(result.details).toMatchObject({ cancelled: false, answers: [{ kind: "option", answer: "Inline" }] });
		expect(onTerminalInput).not.toHaveBeenCalled();
	});

	it("caps the dialog to the inline row budget and keeps the footer and focused option visible", async () => {
		const rows = 24;
		const budget = 16; // 70% of 24 — pinned literally so a budget regression cannot move the goalposts
		const { run } = setup(async (factory) => {
			const component = mount(factory, rows);
			for (const pressDown of [false, true, true, true]) {
				if (pressDown) component.handleInput(DOWN);
				const lines = component.render(100);
				expect(lines.length).toBeLessThanOrEqual(budget);
				// The host clips the editor slot from the bottom, so the hint row must be last.
				expect(lines.at(-1)).toContain(HINT_PART_CANCEL);
				// The question being answered stays pinned while the options scroll.
				expect(lines.some((line) => line.includes("Which approach should we take"))).toBe(true);
			}
			expect(component.render(100).some((line) => line.includes("Option 4"))).toBe(true);
			return { answers: [], cancelled: true };
		});
		await run(fourDescribedOptions);
	});

	it("uses a host's whole allocated band instead of capping it again", async () => {
		const { run } = setup(async (factory) => {
			const terminal = { columns: 100, rows: 19, [HOST_ALLOCATED_ROWS]: true };
			const inline = mount(factory, 19);
			const allocated = factory({ requestRender() {}, terminal }, theme, getKeybindings(), () => {});
			expect(allocated.render(100).length).toBeGreaterThanOrEqual(inline.render(100).length);
			return { answers: [], cancelled: true };
		});
		await run(fourDescribedOptions);
	});

	it("releases the slot when the questionnaire throws", async () => {
		const { run } = setup(async () => {
			throw new Error("host failed");
		});
		await expect(run(twoOptions)).rejects.toThrow("host failed");
		// Slot free again: the next questionnaire still mounts inline rather than as an overlay.
		const next = setup(async () => ({ answers: [], cancelled: true }));
		await next.run(twoOptions);
		expect(vi.mocked(next.ctx.ui.custom).mock.calls[0]?.[1]).toEqual({ overlay: false });
	});
});

describe("overlay fallback", () => {
	it("degrades a concurrent questionnaire to a hideable overlay instead of replacing the mounted one", async () => {
		await withInlineSlotHeld(async () => {
			const { run, ctx } = setup(async () => ({ answers: [], cancelled: true }));
			await run(twoOptions);
			expect(vi.mocked(ctx.ui.custom).mock.calls[0]?.[1]).toMatchObject({ overlay: true });
		});
	});

	it("stacks as a visible-row overlay when another capturing overlay is already on screen", async () => {
		const mounted: QuestionnaireSessionComponent[] = [];
		let releaseStacked = () => {};
		const gate = new Promise<void>((resolve) => {
			releaseStacked = resolve;
		});
		const { run, ctx, onTerminalInput } = setup(async (factory) => {
			const settled: { value?: QuestionnaireResult } = {};
			const component = mount(factory, 24, (r) => {
				settled.value = r;
			}, { getTopmostVisibleOverlay: () => ({}) });
			mounted.push(component);
			// The factory settles at once when it gives the slot up; the stacked mount stays open
			// until the test has driven it.
			if (settled.value !== undefined) return settled.value;
			await gate;
			return settled.value ?? { answers: [], cancelled: true };
		});

		const running = run(twoOptions);
		await vi.waitFor(() => expect(mounted).toHaveLength(2));
		// The inline attempt gives the slot up (mount 1), then the question stacks on top of the
		// overlay already on screen (mount 2).
		expect(vi.mocked(ctx.ui.custom).mock.calls[0]?.[1]).toEqual({ overlay: false });
		expect(vi.mocked(ctx.ui.custom).mock.calls[1]?.[1]).toMatchObject({ overlay: true });
		// A stacked overlay keeps a visible one-row hint instead of hiding: pi-tui pops the
		// TOPMOST overlay, so a hidden one would be popped by the overlay below it.
		const stacked = mounted[1]!;
		expect(stacked.render(100).length).toBeGreaterThan(1);
		stacked.handleInput(COLLAPSE);
		expect(stacked.render(100)).toHaveLength(1);
		releaseStacked();
		await running;
		// Nothing can reopen a hidden overlay here, so no raw listener is registered.
		expect(onTerminalInput).not.toHaveBeenCalled();
	});
});
