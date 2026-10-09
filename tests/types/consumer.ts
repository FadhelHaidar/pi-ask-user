import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import factory, {
	ASK_USER_BLOCKED_EVENT,
	ASK_USER_PROMPT_EVENT,
	type AskUserBlockedEventPayload,
	type AskUserPromptEventPayload,
	type AskUserPromptOption,
	type AskUserPromptQuestion,
} from "@fadhelhaidar/pi-ask-user";
import {
	ASK_USER_BLOCKED_EVENT as blockedEvent,
	ASK_USER_PROMPT_EVENT as promptEvent,
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
	Assert<Equal<BlockedPayload, { active: boolean }>>,
	Assert<Equal<PromptPayload, { questions: ReadonlyArray<PromptQuestion> }>>,
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
