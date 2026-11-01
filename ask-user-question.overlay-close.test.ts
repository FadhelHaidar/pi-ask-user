import { createEventBus } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerAskUserQuestionTool } from "./ask-user-question.js";
import { ASK_USER_ANSWER_EVENT } from "./events.js";
import { createMockCtx, createMockPi, makeTheme } from "./test/utils/index.js";

/**
 * Outside answers racing the host's own teardown. Pi closes an overlay-mode `custom()` with
 * `hideOverlay()`, which pops the last entry of its overlay stack — not the overlay being
 * answered and not the one its visibility probe reports
 * (`node_modules/@earendil-works/pi-tui/dist/tui.js:477-487`, `:552-559`) — so an outside answer
 * must remove its own overlay through the handle instead.
 */

type Close = (result: unknown) => void;
type Component = { handleInput(data: string): void; render(width: number): string[] };
type OverlayOptions = { overlay?: boolean; onHandle?: (handle: unknown) => void };

const keybindings = { matches: (data: string, name: string) => data === name };

const question = (header: string) => ({
	question: `${header}?`,
	header,
	multiSelect: false,
	options: [
		{ label: "A", description: "a" },
		{ label: "B", description: "b" },
	],
});

function harness(opts: { deferHandle?: boolean } = {}) {
	const overlays: Array<{ component: Component; hidden: boolean }> = [];
	const setFocus = vi.fn();
	const tui = {
		terminal: { columns: 120, rows: 40 },
		requestRender: vi.fn(),
		setFocus,
		// pi-tui selects by visibility, not by stack position.
		getTopmostVisibleOverlay: () => [...overlays].reverse().find((entry) => !entry.hidden),
	};
	const pendingHandles: Array<() => void> = [];
	const mounted: Component[] = [];
	const custom = vi.fn(
		(factory: (...args: unknown[]) => unknown, options?: OverlayOptions) =>
			new Promise((resolve) => {
				let closed = false;
				const close: Close = (result) => {
					if (closed) return;
					closed = true;
					// Interactive mode: an overlay close pops the last stack entry.
					if (options?.overlay) overlays.pop();
					resolve(result);
				};
				const component = factory(tui, makeTheme(), keybindings, close) as Component;
				if (closed) return; // the host drops a component closed during the factory
				if (options?.overlay) {
					const entry = { component, hidden: false };
					overlays.push(entry);
					const handOver = () =>
						options.onHandle?.({
							hide: () => {
								const index = overlays.indexOf(entry);
								if (index >= 0) overlays.splice(index, 1);
							},
							setHidden: (hidden: boolean) => {
								entry.hidden = hidden;
							},
							isHidden: () => entry.hidden,
							focus: () => setFocus(component),
							unfocus: () => {},
							isFocused: () => false,
							getBounds: () => undefined,
						});
					if (opts.deferHandle) pendingHandles.push(handOver);
					else handOver();
				}
				mounted.push(component);
			}),
	);
	const bus = createEventBus();
	const { pi, captured } = createMockPi({ events: bus } as never);
	registerAskUserQuestionTool(pi);
	const tool = captured.tools.get("ask_user_question")!;
	const ctx = createMockCtx({
		hasUI: true,
		mode: "tui",
		ui: { custom, onTerminalInput: vi.fn(() => () => {}) } as never,
	});
	const run = (toolCallId: string) =>
		tool.execute?.(
			toolCallId,
			{ questions: [question(toolCallId)] } as never,
			undefined as never,
			undefined as never,
			ctx as never,
		) as Promise<{ content: Array<{ text: string }> }>;
	const answer = (toolCallId: string, index: number) =>
		bus.emit(ASK_USER_ANSWER_EVENT, {
			toolCallId,
			answers: [{ questionIndex: 0, optionIndexes: [index] }],
		});
	// The host hands the handle over after the factory call, so the answer can land first.
	const flushHandles = async () => {
		await vi.waitFor(() => expect(pendingHandles.length).toBeGreaterThan(0));
		pendingHandles.splice(0).forEach((handOver) => handOver());
	};
	const started: string[] = [];
	const start = (toolCallId: string) => {
		started.push(toolCallId);
		return run(toolCallId);
	};
	/** Answer every questionnaire still open, so the next test starts with a free inline slot. */
	const closeAll = async (results: Array<Promise<unknown>>) => {
		for (const toolCallId of started.splice(0)) answer(toolCallId, 0);
		await Promise.allSettled(results);
	};
	return { overlays, setFocus, mounted, run: start, answer, flushHandles, closeAll };
}

describe("outside answers and host overlay teardown", () => {
	it("keeps an overlay above an inline question focused when that answer lands from outside", async () => {
		const h = harness();
		const inline = h.run("inline");
		await vi.waitFor(() => expect(h.mounted).toHaveLength(1));
		const stacked = h.run("stacked");
		await vi.waitFor(() => expect(h.overlays).toHaveLength(1));
		const top = h.overlays[0]!.component;

		h.answer("inline", 1);

		expect((await inline).content[0]!.text).toContain('"inline?"="B"');
		// The inline mount closes through the host (it cannot pop anything) and hands the
		// keyboard back to the overlay instead of to the editor behind it.
		expect(h.overlays).toHaveLength(1);
		expect(h.setFocus).toHaveBeenCalledWith(top);

		h.answer("stacked", 0);
		expect((await stacked).content[0]!.text).toContain('"stacked?"="A"');
		expect(h.overlays).toHaveLength(0);
	});

	it("removes exactly the answered overlay instead of popping the one above it", async () => {
		const h = harness();
		const inline = h.run("inline");
		await vi.waitFor(() => expect(h.mounted).toHaveLength(1));
		const lower = h.run("lower");
		await vi.waitFor(() => expect(h.overlays).toHaveLength(1));
		const upper = h.run("upper");
		await vi.waitFor(() => expect(h.overlays).toHaveLength(2));
		const upperComponent = h.overlays[1]!.component;

		// Answering the LOWER overlay must not dismiss the upper one: Pi's close path pops the
		// last stack entry, whose promise would never settle while the answered one stayed up.
		h.answer("lower", 1);

		expect((await lower).content[0]!.text).toContain('"lower?"="B"');
		expect(h.overlays).toHaveLength(1);
		expect(h.overlays[0]!.component).toBe(upperComponent);

		h.answer("upper", 0);
		expect((await upper).content[0]!.text).toContain('"upper?"="A"');
		expect(h.overlays).toHaveLength(0);

		await h.closeAll([inline]);
	});

	it("leaves a hidden overlay stacked above intact", async () => {
		const h = harness();
		const inline = h.run("inline");
		await vi.waitFor(() => expect(h.mounted).toHaveLength(1));
		const answered = h.run("answered");
		await vi.waitFor(() => expect(h.overlays).toHaveLength(1));
		// A non-capturing/hidden overlay stacks above: pi-tui's visibility probe skips it, but
		// its close path still pops the last stack entry, so only identity removal is safe.
		h.overlays.push({ component: { handleInput() {}, render: () => [] }, hidden: true });
		const hidden = h.overlays[1]!;

		h.answer("answered", 1);

		expect((await answered).content[0]!.text).toContain('"answered?"="B"');
		expect(h.overlays).toEqual([hidden]);
		h.overlays.length = 0; // that foreign overlay closes on its own, outside this harness

		await h.closeAll([inline]);
	});

	it("removes the overlay when the answer lands before the host hands its handle over", async () => {
		const h = harness({ deferHandle: true });
		const inline = h.run("inline");
		await vi.waitFor(() => expect(h.mounted).toHaveLength(1));
		const early = h.run("early");
		await vi.waitFor(() => expect(h.overlays).toHaveLength(1));

		// The host calls the factory, then `onHandle` in a later continuation; an answer in that
		// gap must still remove the overlay once the handle arrives.
		h.answer("early", 0);
		expect((await early).content[0]!.text).toContain('"early?"="A"');
		await h.flushHandles();
		expect(h.overlays).toHaveLength(0);

		await h.closeAll([inline]);
	});
});
