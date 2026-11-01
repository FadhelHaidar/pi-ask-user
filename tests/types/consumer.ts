import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import factory, {
	ASK_USER_ANSWER_EVENT,
	ASK_USER_ANSWER_RESULT_EVENT,
	ASK_USER_BLOCKED_EVENT,
	ASK_USER_PROMPT_EVENT,
	type AskUserAnswerEntry,
	type AskUserAnswerEventPayload,
	type AskUserAnswerRejectCode,
	type AskUserAnswerResultEventPayload,
	type AskUserBlockedEventPayload,
	type AskUserPromptEventPayload,
	type AskUserPromptOption,
	type AskUserPromptQuestion,
} from "@fadhelhaidar/pi-ask-user";
import {
	ASK_USER_ANSWER_EVENT as answerEvent,
	ASK_USER_ANSWER_RESULT_EVENT as resultEvent,
	ASK_USER_BLOCKED_EVENT as blockedEvent,
	ASK_USER_PROMPT_EVENT as promptEvent,
	type AskUserAnswerEntry as AnswerEntry,
	type AskUserAnswerEventPayload as AnswerPayload,
	type AskUserAnswerRejectCode as AnswerRejectCode,
	type AskUserAnswerResultEventPayload as AnswerResultPayload,
	type AskUserBlockedEventPayload as BlockedPayload,
	type AskUserPromptEventPayload as PromptPayload,
	type AskUserPromptOption as PromptOption,
	type AskUserPromptQuestion as PromptQuestion,
} from "@fadhelhaidar/pi-ask-user/events";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
	(<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

// Both conditional exports must resolve the same contracts, never implicit any.
export type Contracts = [
	Assert<Equal<AskUserBlockedEventPayload, BlockedPayload>>,
	Assert<Equal<AskUserPromptEventPayload, PromptPayload>>,
	Assert<Equal<AskUserPromptOption, PromptOption>>,
	Assert<Equal<AskUserPromptQuestion, PromptQuestion>>,
	Assert<Equal<AskUserAnswerEntry, AnswerEntry>>,
	Assert<Equal<AskUserAnswerEventPayload, AnswerPayload>>,
	Assert<Equal<AskUserAnswerResultEventPayload, AnswerResultPayload>>,
	Assert<Equal<BlockedPayload, { active: boolean; toolCallId?: string }>>,
	Assert<Equal<PromptPayload, { questions: ReadonlyArray<PromptQuestion>; toolCallId?: string }>>,
	Assert<Equal<AnswerPayload, {
		toolCallId: string; requestId?: string; answers?: ReadonlyArray<AnswerEntry>;
		globalNote?: string; cancel?: boolean;
	}>>,
	Assert<Equal<AnswerResultPayload, {
		ok: boolean; code?: AnswerRejectCode; reason?: string;
		requestId?: string; toolCallId?: string;
	}>>,
	Assert<Equal<AnswerRejectCode, "not_found" | "invalid_payload" | "invalid_answer" | "unsupported_host">>,
	Assert<Equal<PromptOption, { label: string; description: string; hasPreview: boolean }>>,
	Assert<Equal<PromptQuestion, {
		question: string; header: string; multiSelect: boolean; options: ReadonlyArray<PromptOption>;
	}>>,
	Assert<Equal<typeof factory, (pi: ExtensionAPI) => void>>,
];

const option: AskUserPromptOption = { label: "Yes", description: "Continue", hasPreview: false };
const question: AskUserPromptQuestion = {
	question: "Continue?", header: "Confirm", multiSelect: false, options: [option],
};
const payload: AskUserPromptEventPayload = { questions: [question] };
const blocked: AskUserBlockedEventPayload = { active: true };
const eventsOption: PromptOption = option;
const eventsQuestion: PromptQuestion = question;
export const eventsPayload: PromptPayload = payload;
const eventsBlocked: BlockedPayload = blocked;

const promptChannel: "rpiv:ask-user:prompt" = ASK_USER_PROMPT_EVENT;
export const eventsPromptChannel: typeof promptChannel = promptEvent;
const blockedChannel: "rpiv:ask-user:blocked" = ASK_USER_BLOCKED_EVENT;
export const eventsBlockedChannel: typeof blockedChannel = blockedEvent;
const answerChannel: "rpiv:ask-user:answer" = ASK_USER_ANSWER_EVENT;
export const eventsAnswerChannel: typeof answerChannel = answerEvent;
const answerResultChannel: "rpiv:ask-user:answer-result" = ASK_USER_ANSWER_RESULT_EVENT;
export const eventsAnswerResultChannel: typeof answerResultChannel = resultEvent;

// An external answer is JSON-safe and needs nothing but the tool call it targets.
export const externalAnswer: AnswerPayload = {
	toolCallId: "tc",
	answers: [{ questionIndex: 0, optionIndexes: [1], text: "other", notes: "note" }],
	globalNote: "ship it",
};
const verdict: AnswerResultPayload = { ok: false, code: "not_found", requestId: "r1" };
export const rejectCode: AnswerRejectCode = verdict.code ?? "invalid_answer";

declare const pi: ExtensionAPI;
export const result: void = factory(pi);
// @ts-expect-error The factory requires the host ExtensionAPI, not an arbitrary object.
factory({});
// @ts-expect-error Payload questions are readonly.
payload.questions.push(question);
// @ts-expect-error Question options are readonly on the events entry too.
eventsQuestion.options.push(eventsOption);
// @ts-expect-error active must remain boolean.
eventsBlocked.active = "true";
// @ts-expect-error Rich preview content is not part of the public option contract.
eventsOption.content;
// @ts-expect-error An external answer must name the tool call it resolves.
const missingTarget: AnswerPayload = { cancel: true };
