import { describe, expect, test } from "vitest";
import { routeKey } from "../state/key-router.js";
import type { QuestionnaireState } from "../state/state.js";
import type { ApplyContext } from "../state/state-reducer.js";
import { reduce } from "../state/state-reducer.js";
import { formatAnswerScalar } from "../tool/format-answer.js";

const question = {
	question: "Which features?",
	header: "Features",
	multiSelect: true,
	options: [
		{ label: "A", description: "First" },
		{ label: "B", description: "Second" },
	],
};
const ctx: ApplyContext = {
	questions: [question, { ...question, question: "Second question?" }],
	itemsByTab: [0, 1].map(() => [
		{ kind: "option", label: "A" },
		{ kind: "option", label: "B" },
		{ kind: "other", label: "Type something." },
		{ kind: "next", label: "Next" },
	]),
};
function initial(): QuestionnaireState {
	return {
		currentTab: 0,
		optionIndex: 0,
		inputMode: false,
		notesVisible: false,
		answers: new Map(),
		multiSelectChecked: new Set(),
		customDraftsByTab: new Map(),
		notesByTab: new Map(),
		submitChoiceIndex: 0,
		notesDraft: "",
		collapsed: false,
	};
}
function custom(state: QuestionnaireState, text: string) {
	return reduce({ ...state, optionIndex: 2, inputMode: true }, { kind: "toggle", index: 2, inputValue: text }, ctx);
}
describe("multi-select with custom text", () => {
	test("custom Enter selects text and retains focus, typing mode, and checkboxes", () => {
		const checked = reduce(initial(), { kind: "toggle", index: 0 }, ctx).state;
		const result = custom(checked, "My feature");
		expect(result.state.multiSelectChecked.has(0)).toBe(true);
		expect(result.state.answers.get(0)).toMatchObject({ kind: "multi", selected: ["A"], answer: "My feature" });
		expect(result.state.currentTab).toBe(0);
		expect(result.state.optionIndex).toBe(2);
		expect(result.state.inputMode).toBe(true);
		expect(result.effects).toEqual([]);
	});
	test("checkbox changes preserve custom text, even with no predefined choices", () => {
		let state = custom(initial(), "My feature").state;
		state = reduce(state, { kind: "toggle", index: 1 }, ctx).state;
		expect(state.answers.get(0)?.answer).toBe("My feature");
		state = reduce(state, { kind: "toggle", index: 1 }, ctx).state;
		expect(state.answers.get(0)).toMatchObject({ selected: [], answer: "My feature" });
	});
	test("leaving custom input saves text; Next and tab-back retain it", () => {
		const typing = custom(initial(), "Typed draft").state;
		let state = reduce(typing, { kind: "nav", nextIndex: 0, inputValue: "Typed draft" }, ctx).state;
		state = reduce(state, { kind: "toggle", index: 0 }, ctx).state;
		state = reduce(state, { kind: "multi_confirm", selected: ["A"], autoAdvanceTab: 1 }, ctx).state;
		const back = reduce(state, { kind: "tab_switch", nextTab: 0 }, ctx);
		expect(back.state.multiSelectChecked.has(0)).toBe(true);
		expect(back.effects).toContainEqual({ kind: "set_input_buffer", value: "Typed draft" });
		expect(formatAnswerScalar(back.state.answers.get(0)!, "envelope")).toBe("A, Typed draft");
	});
	test("clearing custom text keeps predefined selections and removes old text", () => {
		let state = reduce(initial(), { kind: "toggle", index: 0 }, ctx).state;
		state = custom(state, "Old text").state;
		state = reduce(state, { kind: "input_clear" }, ctx).state;
		state = reduce(state, { kind: "multi_confirm", selected: ["A"] }, ctx).state;
		expect(state.answers.get(0)).toMatchObject({ selected: ["A"], answer: null });
	});
	test("submission includes both and mirrors notes", () => {
		let state: QuestionnaireState = { ...initial(), notesByTab: new Map([[0, "My note"]]) };
		state = reduce(state, { kind: "toggle", index: 0 }, ctx).state;
		state = custom(state, "Additional feature").state;
		const result = reduce(state, { kind: "multi_confirm", selected: ["A"] }, ctx);
		expect(result.effects).toContainEqual({
			kind: "done",
			result: {
				cancelled: false,
				answers: [
					{
						questionIndex: 0,
						question: question.question,
						kind: "multi",
						answer: "Additional feature",
						selected: ["A"],
						notes: "My note",
					},
				],
			},
		});
	});
	test("single-select still confirms custom text directly", () => {
		const singleCtx = { ...ctx, questions: [{ ...question, multiSelect: false }] };
		const result = reduce(
			initial(),
			{
				kind: "confirm",
				answer: { questionIndex: 0, question: question.question, kind: "custom", answer: "Custom only" },
			},
			singleCtx,
		);
		expect(result.state.answers.get(0)?.kind).toBe("custom");
		expect(result.effects[0]?.kind).toBe("done");
	});
	test("custom text can be unchecked, submitted without, and rechecked intact", () => {
		let state = reduce(initial(), { kind: "toggle", index: 0 }, ctx).state;
		state = custom(state, "Keep this draft").state;
		state = reduce(state, { kind: "toggle", index: 2 }, ctx).state;
		expect(state.multiSelectChecked.has(2)).toBe(false);
		expect(state.answers.get(0)).toMatchObject({ selected: ["A"], answer: null });
		expect(state.customDraftsByTab.get(0)).toBe("Keep this draft");
		const submitted = reduce(state, { kind: "multi_confirm", selected: ["A"] }, ctx);
		expect(submitted.state.answers.get(0)?.answer).toBeNull();
		state = reduce(submitted.state, { kind: "toggle", index: 2 }, ctx).state;
		expect(state.answers.get(0)?.answer).toBe("Keep this draft");
	});
	test("unchecked custom draft survives tab switches without becoming selected", () => {
		let state = custom(initial(), "Retained").state;
		state = reduce(state, { kind: "toggle", index: 2 }, ctx).state;
		expect(state.answers.has(0)).toBe(false);
		state = reduce(state, { kind: "tab_switch", nextTab: 1 }, ctx).state;
		const back = reduce(state, { kind: "tab_switch", nextTab: 0 }, ctx);
		expect(back.state.multiSelectChecked.has(2)).toBe(false);
		expect(back.effects).toContainEqual({ kind: "set_input_buffer", value: "Retained" });
		const rechecked = reduce(back.state, { kind: "toggle", index: 2 }, ctx);
		expect(rechecked.state.answers.get(0)?.answer).toBe("Retained");
	});
	test("custom row types immediately; Enter toggles and Space is ordinary text", () => {
		const state = reduce(initial(), { kind: "nav", nextIndex: 2, inputValue: "" }, ctx).state;
		expect(state.inputMode).toBe(true);
		const runtime = {
			questions: ctx.questions,
			items: ctx.itemsByTab[0]!,
			currentItem: ctx.itemsByTab[0]![2],
			isMulti: true,
			inputBuffer: "Saved text",
			canMoveInputUp: false,
			canMoveInputDown: false,
			collapseKey: "off",
			keybindings: {
				matches: (data: string, name: string) =>
					data === "\r" && (name === "tui.select.confirm" || name === "tui.input.submit"),
			},
		};
		expect(routeKey(" ", state, runtime)).toEqual({ kind: "ignore" });
		const action = routeKey("\r", state, runtime);
		expect(action).toEqual({ kind: "toggle", index: 2, inputValue: "Saved text" });
		const selected = reduce(state, action, ctx).state;
		expect(selected.inputMode).toBe(true);
		expect(selected.answers.get(0)?.answer).toBe("Saved text");
		const deselected = reduce(selected, routeKey("\r", selected, runtime), ctx).state;
		expect(deselected.inputMode).toBe(true);
		expect(deselected.multiSelectChecked.has(2)).toBe(false);
		expect(deselected.customDraftsByTab.get(0)).toBe("Saved text");
		const optionRuntime = { ...runtime, currentItem: ctx.itemsByTab[0]![0] };
		expect(routeKey(" ", initial(), optionRuntime)).toEqual({ kind: "ignore" });
		expect(routeKey("\r", initial(), optionRuntime)).toEqual({ kind: "toggle", index: 0 });
	});
	test("leaving an unchecked custom draft does not automatically select it", () => {
		const typing = reduce(initial(), { kind: "nav", nextIndex: 2, inputValue: "" }, ctx).state;
		const left = reduce(typing, { kind: "nav", nextIndex: 0, inputValue: "Unselected draft" }, ctx).state;
		expect(left.multiSelectChecked.has(2)).toBe(false);
		expect(left.answers.has(0)).toBe(false);
		expect(left.customDraftsByTab.get(0)).toBe("Unselected draft");
	});
	test("editing selected custom text updates it on navigation without changing selection", () => {
		const typing = custom(initial(), "Original").state;
		const left = reduce(typing, { kind: "nav", nextIndex: 3, inputValue: "Revised with spaces" }, ctx).state;
		expect(left.multiSelectChecked.has(2)).toBe(true);
		expect(left.answers.get(0)?.answer).toBe("Revised with spaces");
	});
	test("single-select still enters typing mode on navigation", () => {
		const singleCtx = { ...ctx, questions: [{ ...question, multiSelect: false }] };
		const result = reduce(initial(), { kind: "nav", nextIndex: 2, inputValue: "" }, singleCtx);
		expect(result.state.inputMode).toBe(true);
	});
	test("formatting preserves existing empty and predefined-only behavior", () => {
		const base = { questionIndex: 0, question: question.question, kind: "multi" as const, answer: null };
		expect(formatAnswerScalar({ ...base, selected: [] }, "summary")).toBe("(no input)");
		expect(formatAnswerScalar({ ...base, selected: ["A", "B"] }, "summary")).toBe("A, B");
	});
});
