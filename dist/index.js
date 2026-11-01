import {
  ASK_USER_PROMPT_EVENT2,
  ASK_USER_BLOCKED_EVENT2,
  ASK_USER_ANSWER_EVENT2,
  ASK_USER_ANSWER_RESULT_EVENT2
} from "./chunks/index-pen3t92h.js";
import {
  validateGuidanceFields,
  COLLAPSE_KEY_OFF,
  resolveCollapseKey,
  resolveNotesKey,
  formatKeySpecForDisplay,
  loadConfig,
  ROW_INTENT_META,
  sentinelsToAppend,
  I18N_NAMESPACE,
  t,
  displayLabel,
  NO_INPUT_PLACEHOLDER,
  formatAnswerScalar,
  stripFenceMarkers
} from "./chunks/index-n7wxhdmh.js";

// ask-user-question.ts
import { isKeyRelease, isKeyRepeat, matchesKey } from "@earendil-works/pi-tui";

// tool/external-answer.ts
var reject = (code, reason) => ({ ok: false, code, reason });
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function noteOf(v) {
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}
function resolveExternalAnswer(questions, payload) {
  const { answers, globalNote, cancel } = payload;
  if (cancel !== undefined && typeof cancel !== "boolean")
    return reject("invalid_payload", "cancel must be a boolean");
  if (globalNote !== undefined && typeof globalNote !== "string") {
    return reject("invalid_payload", "globalNote must be a string");
  }
  const note = noteOf(globalNote);
  const withNote = note ? { globalNote: note } : {};
  if (cancel === true) {
    if (answers !== undefined && !(Array.isArray(answers) && answers.length === 0)) {
      return reject("invalid_payload", "cancel takes no answers");
    }
    return { ok: true, result: { answers: [], cancelled: true, ...withNote } };
  }
  if (!Array.isArray(answers))
    return reject("invalid_payload", "answers must be an array");
  const byQuestion = new Map;
  for (const entry of answers) {
    if (!isRecord(entry))
      return reject("invalid_payload", "each answer must be an object");
    const index = entry.questionIndex;
    if (!Number.isInteger(index))
      return reject("invalid_payload", "questionIndex must be an integer");
    const i = index;
    if (i < 0 || i >= questions.length) {
      return reject("invalid_answer", `questionIndex ${i} out of range (0..${questions.length - 1})`);
    }
    if (byQuestion.has(i))
      return reject("invalid_answer", `question ${i} answered twice`);
    byQuestion.set(i, entry);
  }
  const resolved = [];
  for (let i = 0;i < questions.length; i++) {
    const entry = byQuestion.get(i);
    if (!entry)
      return reject("invalid_answer", `no answer for question ${i} ("${questions[i].header}")`);
    const answer = resolveEntry(questions[i], i, entry);
    if (!answer.ok)
      return answer;
    resolved.push(answer.answer);
  }
  return { ok: true, result: { answers: resolved, cancelled: false, ...withNote } };
}
function resolveEntry(q, i, entry) {
  const { optionIndexes, text, notes } = entry;
  if (optionIndexes !== undefined && (!Array.isArray(optionIndexes) || !optionIndexes.every(Number.isInteger))) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: `question ${i}: optionIndexes must be an array of integers`
    };
  }
  if (text !== undefined && typeof text !== "string") {
    return { ok: false, code: "invalid_payload", reason: `question ${i}: text must be a string` };
  }
  if (notes !== undefined && typeof notes !== "string") {
    return { ok: false, code: "invalid_payload", reason: `question ${i}: notes must be a string` };
  }
  const invalid = (reason) => ({
    ok: false,
    code: "invalid_answer",
    reason: `question ${i}: ${reason}`
  });
  const picked = optionIndexes ?? [];
  const out = picked.find((n) => n < 0 || n >= q.options.length);
  if (out !== undefined)
    return invalid(`option index ${out} out of range (0..${q.options.length - 1})`);
  if (new Set(picked).size !== picked.length)
    return invalid("option index repeated");
  if (text !== undefined && text.trim().length === 0)
    return invalid("text is blank");
  if (picked.length === 0 && text === undefined)
    return invalid("needs optionIndexes or text");
  const base = { questionIndex: i, question: q.question };
  const note = noteOf(notes);
  const withNote = note ? { notes: note } : {};
  if (q.multiSelect) {
    const selected = q.options.filter((_o, n) => picked.includes(n)).map((o) => o.label);
    return {
      ok: true,
      answer: { ...base, kind: "multi", answer: text ?? null, selected, ...withNote }
    };
  }
  if (picked.length > 0 && text !== undefined)
    return invalid("single-select takes optionIndexes or text, not both");
  if (picked.length > 1)
    return invalid(`single-select takes one option, got ${picked.length}`);
  if (text !== undefined)
    return { ok: true, answer: { ...base, kind: "custom", answer: text, ...withNote } };
  const option = q.options[picked[0]];
  const withPreview = option.preview && option.preview.length > 0 ? { preview: option.preview } : {};
  return { ok: true, answer: { ...base, kind: "option", answer: option.label, ...withPreview, ...withNote } };
}

// answer-channel.ts
class OpenQuestionnaire {
  toolCallId;
  questions;
  host;
  result;
  deliver;
  resolveEarly;
  answeredEarly = new Promise((resolve) => {
    this.resolveEarly = resolve;
  });
  constructor(toolCallId, questions, host) {
    this.toolCallId = toolCallId;
    this.questions = questions;
    this.host = host;
  }
  get settled() {
    return this.result;
  }
  attach(done) {
    this.deliver = done;
  }
  settle(result) {
    if (this.result)
      return false;
    this.result = result;
    this.resolveEarly(result);
    this.deliver?.(result);
    return true;
  }
}
var isRecord2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function registerAnswerChannel(pi) {
  const open = new Map;
  pi.events.on(ASK_USER_ANSWER_EVENT2, (data) => {
    const payload = isRecord2(data) ? data : {};
    const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
    const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : undefined;
    const reply = (code, reason) => {
      const verdict = {
        ok: code === undefined,
        ...code ? { code, reason } : {},
        ...requestId !== undefined ? { requestId } : {},
        ...toolCallId !== undefined ? { toolCallId } : {}
      };
      pi.events.emit(ASK_USER_ANSWER_RESULT_EVENT2, verdict);
    };
    if (!isRecord2(data))
      return reply("invalid_payload", "payload must be an object");
    if (payload.requestId !== undefined && requestId === undefined) {
      return reply("invalid_payload", "requestId must be a string");
    }
    if (toolCallId === undefined)
      return reply("invalid_payload", "toolCallId must be a string");
    const target = open.get(toolCallId);
    if (!target || target.settled)
      return reply("not_found", `no open questionnaire for tool call ${toolCallId}`);
    if (target.host === "rpc")
      return reply("unsupported_host", "this host shows the questions in its own dialogs");
    const outcome = resolveExternalAnswer(target.questions, payload);
    if (!outcome.ok)
      return reply(outcome.code, outcome.reason);
    if (!target.settle(outcome.result))
      return reply("not_found", `tool call ${toolCallId} is already answered`);
    reply();
  });
  return {
    open(toolCallId, questions, host) {
      const questionnaire = new OpenQuestionnaire(toolCallId, questions, host);
      open.set(toolCallId, questionnaire);
      return questionnaire;
    },
    close(questionnaire) {
      if (open.get(questionnaire.toolCallId) === questionnaire)
        open.delete(questionnaire.toolCallId);
    }
  };
}

// rpc-fallback.ts
var MULTI_SELECT_INSTRUCTIONS = 'Enter the numbers of all that apply, comma-separated (e.g. "1,3"). Add "; custom answer" to include your own text, or type only custom text.';
var CUSTOM_ANSWER_TITLE = "Type your answer:";
var MULTI_SELECT_PLACEHOLDER = "1,3; custom answer";
var MAX_PREVIEW_CHARS = 600;
function hasDialogUI(ui) {
  const u = ui;
  return typeof u?.select === "function" && typeof u?.input === "function";
}
function formatOptionLine(option, index) {
  return `${index + 1}. ${option.label} — ${option.description}`;
}
function parseIndex(token, count) {
  const i = Number.parseInt(token, 10) - 1;
  return i >= 0 && i < count ? i : null;
}
function buildPreviewBlock(question) {
  const blocks = question.options.flatMap((o, i) => o.preview && o.preview.length > 0 ? [`--- ${i + 1}. ${o.label} preview ---
${o.preview.slice(0, MAX_PREVIEW_CHARS)}`] : []);
  return blocks.length > 0 ? `

${blocks.join(`

`)}` : "";
}
async function runRpcQuestionnaire(ui, params) {
  const answers = [];
  for (let qi = 0;qi < params.questions.length; qi++) {
    const q = params.questions[qi];
    const header = q.header ? `[${q.header}] ` : "";
    const answer = q.multiSelect ? await askMultiSelect(ui, q, qi, header) : await askSingleSelect(ui, q, qi, header);
    if (answer === undefined)
      return { answers, cancelled: true };
    answers.push(answer);
  }
  return { answers, cancelled: false };
}
async function askSingleSelect(ui, q, questionIndex, header) {
  const options = q.options.map(formatOptionLine);
  options.push(`${q.options.length + 1}. ${displayLabel("other")}`);
  const chosen = await ui.select(`${header}${q.question}${buildPreviewBlock(q)}`, options);
  if (chosen == null)
    return;
  const reply = chosen.trim();
  if (reply.length === 0)
    return;
  const idx = resolveSingleSelectReply(chosen, reply, options, q);
  if (idx === undefined)
    return { questionIndex, question: q.question, kind: "custom", answer: reply };
  if (idx < q.options.length) {
    const o = q.options[idx];
    return {
      questionIndex,
      question: q.question,
      kind: "option",
      answer: o.label,
      preview: o.preview && o.preview.length > 0 ? o.preview : undefined
    };
  }
  const typed = await ui.input(`${header}${q.question}

${q.options.map(formatOptionLine).join(`
`)}

${t("rpc.custom_answer_title", CUSTOM_ANSWER_TITLE)}`, "");
  if (typed == null)
    return;
  return { questionIndex, question: q.question, kind: "custom", answer: typed };
}
function resolveSingleSelectReply(chosen, reply, lines, q) {
  const line = lines.indexOf(chosen);
  if (line >= 0)
    return line;
  if (/^\d+\.?$/.test(reply))
    return parseIndex(reply, lines.length) ?? undefined;
  const label = q.options.findIndex((o) => o.label === reply);
  return label >= 0 ? label : undefined;
}
async function askMultiSelect(ui, q, questionIndex, header) {
  const list = q.options.map(formatOptionLine).join(`
`);
  const value = await ui.input(`${header}${q.question}

${list}

${t("rpc.multi_instructions", MULTI_SELECT_INSTRUCTIONS)}`, MULTI_SELECT_PLACEHOLDER);
  if (value == null)
    return;
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { questionIndex, question: q.question, kind: "multi", answer: null, selected: [] };
  }
  const [selectionPart = "", ...customParts] = trimmed.split(";");
  const selection = selectionPart.trim();
  const custom = customParts.join(";").trim();
  const tokens = selection.split(/[,\s]+/).filter((tok) => tok.length > 0);
  const indices = tokens.map((tok) => /^\d+\.?$/.test(tok) ? parseIndex(tok, q.options.length) : null);
  if (selection.length === 0 || indices.every((i) => i != null)) {
    const selected = [];
    for (const i of indices) {
      if (i == null)
        continue;
      const label = q.options[i].label;
      if (!selected.includes(label))
        selected.push(label);
    }
    return {
      questionIndex,
      question: q.question,
      kind: "multi",
      answer: custom.length > 0 ? custom : null,
      selected
    };
  }
  return { questionIndex, question: q.question, kind: "multi", answer: trimmed, selected: [] };
}

// presentation.ts
var INLINE_ROW_RATIO = 0.7;
var INLINE_MIN_ROWS = 12;
var fullRowBudget = (terminalRows) => terminalRows;
var HOST_ALLOCATED_ROWS = Symbol.for("rpiv-ask-user-question:host-allocated-rows");
function hostAllocatesRows(terminal) {
  return typeof terminal === "object" && terminal !== null && terminal[HOST_ALLOCATED_ROWS] === true;
}
function rowBudgetForHost(terminal, budget) {
  return hostAllocatesRows(terminal) ? fullRowBudget : budget;
}
var YIELD_TO_OVERLAY = Object.freeze({
  answers: [],
  cancelled: true
});
function mustYieldInlineSlot(tui) {
  if (hostAllocatesRows(tui.terminal))
    return false;
  const probe = overlayProbe(tui);
  if (probe)
    return probe() !== undefined;
  return typeof tui.hasOverlay === "function" && tui.hasOverlay();
}
function overlayProbe(tui) {
  const { getTopmostVisibleOverlay } = tui;
  return typeof getTopmostVisibleOverlay === "function" ? () => getTopmostVisibleOverlay.call(tui) : undefined;
}
function topOverlayComponent(tui) {
  let top;
  try {
    top = overlayProbe(tui)?.()?.component;
  } catch {
    return;
  }
  return typeof top === "object" && top !== null ? top : undefined;
}
function focusOverlayComponent(tui, component) {
  const { setFocus } = tui;
  if (typeof setFocus === "function")
    setFocus.call(tui, component);
}
var inlineRowBudget = (terminalRows) => Math.min(terminalRows, Math.max(INLINE_MIN_ROWS, Math.floor(terminalRows * INLINE_ROW_RATIO)));
var inlineSlotHeld = false;
function claimInlineSlot() {
  if (inlineSlotHeld)
    return;
  inlineSlotHeld = true;
  let released = false;
  return () => {
    if (released)
      return;
    released = true;
    inlineSlotHeld = false;
  };
}
var OVERLAY_PRESENTATION = Object.freeze({
  overlay: true,
  rowBudget: fullRowBudget,
  hideOnCollapse: true
});
var STACKED_OVERLAY_PRESENTATION = Object.freeze({
  overlay: true,
  rowBudget: fullRowBudget,
  hideOnCollapse: false
});
function resolvePresentation() {
  const release = claimInlineSlot();
  return release ? { overlay: false, rowBudget: inlineRowBudget, release } : OVERLAY_PRESENTATION;
}

// tool/normalize-params.ts
function normalizeLineTerminators(text) {
  return text.replace(/\r\n/g, `
`).replace(/\r/g, "");
}
function normalizeStringFields(obj, keys) {
  const out = { ...obj };
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string")
      out[key] = normalizeLineTerminators(value);
  }
  return out;
}
function normalizeQuestionParams(params) {
  return {
    ...params,
    questions: params.questions.map((q) => ({
      ...normalizeStringFields(q, ["question", "header"]),
      options: q.options.map((o) => normalizeStringFields(o, ["label", "description", "preview"]))
    }))
  };
}
function prepareQuestionArguments(args) {
  if (!isJsonRecord(args))
    return args;
  const questions = decodeArray(args.questions);
  if (!questions)
    return args;
  const decoded = questions.map((q) => {
    const question = decodeObject(q);
    if (!question)
      return q;
    const options = decodeArray(question.options);
    return options ? { ...question, options: options.map((o) => decodeObject(o) ?? o) } : question;
  });
  return { ...args, questions: decoded };
}
function isJsonRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function decodeArray(value) {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  return Array.isArray(parsed) ? parsed : undefined;
}
function decodeObject(value) {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  return isJsonRecord(parsed) ? parsed : undefined;
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return;
  }
}

// tool/response-envelope.ts
var DECLINE_MESSAGE = "User declined to answer questions";
var ENVELOPE_PREFIX = "User has answered your questions:";
var ENVELOPE_SUFFIX = "You can now continue with the user's answers in mind.";
function buildQuestionnaireResponse(result, params) {
  if (!result || result.cancelled) {
    return buildToolResult(DECLINE_MESSAGE, {
      answers: result?.answers ?? [],
      cancelled: true,
      ...result?.globalNote && result.globalNote.length > 0 ? { globalNote: result.globalNote } : {}
    });
  }
  const segments = [];
  const unanswered = [];
  for (let i = 0;i < params.questions.length; i++) {
    const a = result.answers.find((x) => x.questionIndex === i);
    if (a)
      segments.push(buildAnswerSegment(a));
    else
      unanswered.push(i);
  }
  const hasGlobalNote = result.globalNote !== undefined && result.globalNote.length > 0;
  if (segments.length === 0 && !hasGlobalNote) {
    return buildToolResult(DECLINE_MESSAGE, { answers: result.answers, cancelled: true });
  }
  if (unanswered.length > 0)
    segments.push(buildUnansweredSegment(unanswered, params));
  if (hasGlobalNote)
    segments.push(`global note: ${result.globalNote}.`);
  const details = unanswered.length > 0 ? { ...result, unanswered } : result;
  return buildToolResult(`${ENVELOPE_PREFIX} ${segments.join(" ")} ${ENVELOPE_SUFFIX}`, details);
}
function buildUnansweredSegment(indexes, params) {
  return `unanswered: ${indexes.map((i) => `"${params.questions[i]?.question}"`).join(", ")}.`;
}
function buildAnswerSegment(a) {
  const parts = [`"${a.question}"="${formatAnswerScalar(a, "envelope")}"`];
  if (a.preview && a.preview.length > 0)
    parts.push(`selected preview: ${a.preview}`);
  if (a.notes && a.notes.length > 0)
    parts.push(`user notes: ${a.notes}`);
  return `${parts.join(". ")}.`;
}
function buildToolResult(text, details) {
  return {
    content: [{ type: "text", text }],
    details
  };
}

// tool/types.ts
import { Type } from "typebox";
var MAX_QUESTIONS = 4;
var MIN_OPTIONS = 2;
var MAX_OPTIONS = 4;
var MAX_HEADER_LENGTH = 16;
var MAX_LABEL_LENGTH = 60;
var RESERVED_LABELS = ["Other", ROW_INTENT_META.other.label, ROW_INTENT_META.next.label];
var OptionSchema = Type.Object({
  label: Type.String({
    maxLength: MAX_LABEL_LENGTH,
    description: `MAX ${MAX_LABEL_LENGTH} CHARACTERS — hard limit, requests over the limit are rejected. The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.`
  }),
  description: Type.String({
    description: "Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications."
  }),
  preview: Type.Optional(Type.String({
    description: "Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format."
  }))
});
var QuestionSchema = Type.Object({
  question: Type.String({
    description: 'The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"'
  }),
  header: Type.String({
    maxLength: MAX_HEADER_LENGTH,
    description: `MAX ${MAX_HEADER_LENGTH} CHARACTERS — hard limit, requests over the limit are rejected. Very short chip/tag shown next to the question. Examples: "Auth method", "Library", "Approach".`
  }),
  options: Type.Array(OptionSchema, {
    minItems: MIN_OPTIONS,
    maxItems: MAX_OPTIONS,
    description: "The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). The 'Type something.' row is appended automatically — do NOT author it."
  }),
  multiSelect: Type.Optional(Type.Boolean({
    default: false,
    description: "Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive."
  }))
});
var QuestionsSchema = Type.Array(QuestionSchema, {
  minItems: 1,
  maxItems: MAX_QUESTIONS,
  description: "Questions to ask the user (1-4 questions)"
});
var QuestionParamsSchema = Type.Object({
  questions: QuestionsSchema
});
function isQuestionnaireResult(value) {
  if (!value || typeof value !== "object")
    return false;
  const v = value;
  return Array.isArray(v.answers) && typeof v.cancelled === "boolean";
}

// tool/validate-questionnaire.ts
var ERROR_NO_QUESTIONS = "Error: At least one question is required";
var ERROR_TOO_MANY_QUESTIONS = `Error: At most ${MAX_QUESTIONS} questions are allowed per invocation`;
var ERROR_DUPLICATE_QUESTION = "Error: Question text must be unique within an invocation";
var ERROR_TOO_FEW_OPTIONS = `Error: Each question requires at least ${MIN_OPTIONS} options`;
var ERROR_RESERVED_LABEL = `Error: Option label is reserved (${RESERVED_LABELS.join(", ")})`;
var ERROR_DUPLICATE_OPTION_LABEL = "Error: Option labels must be unique within a question";
var RESERVED_LABEL_SET = new Set(RESERVED_LABELS);
function validateQuestionnaire(typed) {
  if (typed.questions.length === 0) {
    return { ok: false, error: "no_questions", message: ERROR_NO_QUESTIONS };
  }
  if (typed.questions.length > MAX_QUESTIONS) {
    return { ok: false, error: "too_many_questions", message: ERROR_TOO_MANY_QUESTIONS };
  }
  const seenQuestions = new Set;
  for (const q of typed.questions) {
    if (seenQuestions.has(q.question)) {
      return { ok: false, error: "duplicate_question", message: ERROR_DUPLICATE_QUESTION };
    }
    seenQuestions.add(q.question);
  }
  for (const q of typed.questions) {
    if (q.options.length < MIN_OPTIONS) {
      return { ok: false, error: "empty_options", message: ERROR_TOO_FEW_OPTIONS };
    }
    const seenLabels = new Set;
    for (const o of q.options) {
      if (RESERVED_LABEL_SET.has(o.label)) {
        return { ok: false, error: "reserved_label", message: ERROR_RESERVED_LABEL };
      }
      if (seenLabels.has(o.label)) {
        return {
          ok: false,
          error: "duplicate_option_label",
          message: ERROR_DUPLICATE_OPTION_LABEL
        };
      }
      seenLabels.add(o.label);
    }
  }
  return { ok: true };
}

// view/transcript.ts
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
var INDENT = "  ";
var COLUMN_GAP = "  ";
var RECOMMENDED_SUFFIX = /\s*\(Recommended\)$/;

class WidthLines {
  layout;
  constructor(layout) {
    this.layout = layout;
  }
  render(width) {
    return this.layout(width);
  }
  invalidate() {}
}
function renderAskCall(args, theme) {
  const headers = (args?.questions ?? []).map((q) => q?.header).filter(Boolean);
  const title = theme.fg("toolTitle", theme.bold("Ask"));
  const text = headers.length > 0 ? `${title} ${theme.fg("accent", headers.join(" · "))}` : title;
  return new WidthLines((width) => [truncateToWidth(text, width, "…")]);
}
function renderAskResult(result, args, theme, options) {
  const details = isQuestionnaireResult(result.details) ? result.details : undefined;
  if (options.isError || details?.error) {
    return new WidthLines(() => [theme.fg("error", `✗ ${firstTextLine(result)}`)]);
  }
  if (!details)
    return new WidthLines(() => [theme.fg("success", "✓")]);
  if (details.cancelled) {
    return new WidthLines(() => [theme.fg("dim", `✗ ${t("transcript.no_answer", "no answer")}`)]);
  }
  const questions = args?.questions ?? [];
  return new WidthLines((width) => questions.length > 1 ? tableLines(details, args, theme, options.expanded, width) : singleLines(details, questions[0]?.question, theme, options.expanded, width));
}
function singleLines(details, questionText, theme, expanded, width) {
  const answer = details.answers[0];
  const lines = hanging(`${theme.fg("success", "✓")} `, answerText(answer, theme), width);
  lines.push(...detailLines(answer, expanded ? questionText : undefined, INDENT, theme, width));
  return [...lines, ...globalNoteLines(details, theme, width)];
}
function tableLines(details, args, theme, expanded, width) {
  const headerWidth = Math.max(...args.questions.map((q) => visibleWidth(q.header)));
  const answerIndent = " ".repeat(INDENT.length + headerWidth + COLUMN_GAP.length);
  const lines = args.questions.flatMap((q, i) => {
    const answer = details.answers.find((a) => a.questionIndex === i);
    const header = q.header + " ".repeat(headerWidth - visibleWidth(q.header));
    const row = hanging(`${INDENT}${theme.fg("muted", header)}${COLUMN_GAP}`, answerText(answer, theme), width);
    return [...row, ...detailLines(answer, expanded ? q.question : undefined, answerIndent, theme, width)];
  });
  return [...lines, ...globalNoteLines(details, theme, width)];
}
function detailLines(answer, questionText, indent, theme, width) {
  const lines = [];
  if (questionText)
    lines.push(...hanging(indent, theme.fg("dim", questionText), width));
  if (questionText && answer?.preview) {
    for (const line of stripFenceMarkers(answer.preview.split(`
`))) {
      lines.push(truncateToWidth(`${indent}${theme.fg("dim", `│ ${line}`)}`, width, "…"));
    }
  }
  if (answer?.notes)
    lines.push(...hanging(indent, theme.fg("dim", `✎ ${answer.notes}`), width));
  return lines;
}
function globalNoteLines(details, theme, width) {
  return details.globalNote ? hanging(INDENT, theme.fg("dim", `✎ ${details.globalNote}`), width) : [];
}
function answerText(answer, theme) {
  if (!answer)
    return theme.fg("dim", t("transcript.not_answered", "not answered"));
  const typed = answer.answer ? `"${answer.answer}"` : undefined;
  const picks = answer.kind === "option" ? [label(answer.answer ?? "")] : answer.kind === "custom" ? [typed] : [...(answer.selected ?? []).map(label), typed];
  return theme.fg("toolOutput", picks.filter(Boolean).join(", ") || NO_INPUT_PLACEHOLDER);
}
function label(text) {
  return text.replace(RECOMMENDED_SUFFIX, "");
}
function hanging(prefix, text, width) {
  const indent = visibleWidth(prefix);
  return wrapTextWithAnsi(text, Math.max(1, width - indent)).map((line, i) => (i === 0 ? prefix : " ".repeat(indent)) + line);
}
function firstTextLine(result) {
  const text = result.content.find((c) => c.type === "text")?.text ?? "";
  return text.split(`
`)[0] ?? "";
}

// ask-user-question.ts
function emitAskUserPromptEvent(pi, params, toolCallId) {
  const payload = {
    toolCallId,
    questions: params.questions.map((q) => ({
      question: q.question,
      header: q.header,
      multiSelect: q.multiSelect ?? false,
      options: q.options.map((o) => ({
        label: o.label,
        description: o.description,
        hasPreview: typeof o.preview === "string" && o.preview.length > 0
      }))
    }))
  };
  pi.events.emit(ASK_USER_PROMPT_EVENT2, payload);
}
function emitAskUserBlockedEvent(pi, active, toolCallId) {
  const payload = { active, toolCallId };
  pi.events.emit(ASK_USER_BLOCKED_EVENT2, payload);
}
function rejectWithoutUi() {
  return buildToolResult(ERROR_NO_UI, { answers: [], cancelled: true, error: "no_ui" });
}
async function runRpcPath(pi, ui, typed, toolCallId) {
  emitAskUserBlockedEvent(pi, true, toolCallId);
  try {
    emitTerminalAttention();
    return buildQuestionnaireResponse(await runRpcQuestionnaire(ui, typed), typed);
  } finally {
    emitAskUserBlockedEvent(pi, false, toolCallId);
  }
}
var ASK_USER_QUESTION_TOOL_NAME = "ask_user_question";
var ERROR_NO_UI = "Error: UI not available (running in non-interactive mode)";
var ERROR_NO_CUSTOM_UI = "Error: this client cannot render the questionnaire (custom UI is unavailable, e.g. RPC/ACP hosts such as Zed or Paseo). The user never saw the questions — do NOT treat this as a decline. Ask the questions as plain chat text instead, without using this tool.";
var ERROR_SESSION_LOAD_FAILED = "Error: the questionnaire UI failed to load — the host's installed dependencies were likely replaced or removed on disk while Pi was running (e.g. a package-manager install touched the store). The user never saw the questions — do NOT treat this as a decline. Ask the questions as plain chat text instead, and tell the user that restoring this tool requires repairing the install if needed and restarting Pi.";
var ERROR_STALE_MODULE_CACHE = "Error: the questionnaire UI cannot load — the host's module cache went stale after an earlier failed load (typically dependencies replaced on disk mid-session). This is unrecoverable within the current Pi process. The user never saw the questions — do NOT treat this as a decline. Ask the questions as plain chat text instead, and tell the user to restart Pi to restore this tool.";
var BEL = "\x07";
function emitTerminalAttention() {
  try {
    if (process.stdout.isTTY)
      process.stdout.write(BEL);
  } catch {}
}
var PREWARM_DELAY_MS = 2000;
async function loadQuestionnaireSession() {
  let mod;
  try {
    mod = await import("./chunks/questionnaire-session-m053x4ka.js");
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return { ok: false, error: "session_load_failed", message: `${ERROR_SESSION_LOAD_FAILED} (cause: ${cause})` };
  }
  if (typeof mod.QuestionnaireSession !== "function") {
    const keys = JSON.stringify(Object.keys(mod));
    return {
      ok: false,
      error: "stale_module_cache",
      message: `${ERROR_STALE_MODULE_CACHE} (resolved namespace keys: ${keys})`
    };
  }
  return { ok: true, module: mod };
}
function registerCollapseKeyListener(ctx, collapseKey, sessionRef, overlayHandleRef) {
  if (collapseKey === COLLAPSE_KEY_OFF || typeof ctx.ui.onTerminalInput !== "function")
    return;
  let hasAnnouncedHide = false;
  return ctx.ui.onTerminalInput((data) => {
    const handle = overlayHandleRef.current;
    if (!handle)
      return;
    if (!handle.isHidden() && !handle.isFocused())
      return;
    if (!matchesKey(data, collapseKey))
      return;
    if (isKeyRelease(data) || isKeyRepeat(data))
      return { consume: true };
    sessionRef.current?.toggleCollapsedExternal();
    if (handle.isHidden() && !hasAnnouncedHide) {
      hasAnnouncedHide = true;
      ctx.ui.notify?.(`ask_user_question hidden — press ${formatKeySpecForDisplay(collapseKey)} to reopen`, "info");
    }
    return { consume: true };
  });
}
function makeSessionFactory(config) {
  const {
    ctx,
    typed,
    itemsByTab,
    collapseKey,
    notesKey,
    canReopenWhileHidden,
    presentation,
    open,
    sessionRef,
    overlayHandleRef,
    Session
  } = config;
  return (tui, theme, keybindings, done) => {
    if (!presentation.overlay && mustYieldInlineSlot(tui)) {
      done(YIELD_TO_OVERLAY);
      return INERT_COMPONENT;
    }
    if (open.settled) {
      if (!presentation.overlay)
        done(open.settled);
      return INERT_COMPONENT;
    }
    const session = new Session({
      tui,
      theme,
      params: typed,
      itemsByTab,
      done: (result) => open.settle(result),
      keybindings,
      editInput: async (value) => {
        try {
          const [{ SettingsManager }, { editWithExternalEditor }] = await Promise.all([
            import("@earendil-works/pi-coding-agent"),
            import("./chunks/external-editor-5wd19nyg.js")
          ]);
          const editorCommand = SettingsManager.create(ctx.cwd, undefined, {
            projectTrusted: ctx.isProjectTrusted()
          }).getExternalEditorCommand();
          if (!editorCommand)
            throw new Error("No external editor command is configured");
          return await editWithExternalEditor(tui, editorCommand, value);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify(`${t("editor.failed", "External editor failed")}: ${message}`, "error");
          return;
        }
      },
      collapseKey,
      notesKey,
      canReopenWhileHidden,
      rowBudget: rowBudgetForHost(tui.terminal, presentation.rowBudget)
    });
    sessionRef.current = session;
    open.attach((result) => {
      if (presentation.overlay) {
        overlayHandleRef.current?.hide();
        return;
      }
      done(result);
      const top = topOverlayComponent(tui);
      if (top !== undefined && top !== session.component)
        focusOverlayComponent(tui, top);
    });
    return session.component;
  };
}
var INERT_COMPONENT = {
  render: () => [],
  invalidate: () => {},
  handleInput: () => {}
};
async function resolveUndefinedResult(ctx, typed) {
  if (hasDialogUI(ctx.ui)) {
    return buildQuestionnaireResponse(await runRpcQuestionnaire(ctx.ui, typed), typed);
  }
  return buildToolResult(ERROR_NO_CUSTOM_UI, { answers: [], cancelled: true, error: "no_custom_ui" });
}
function prewarmSessionGraph() {
  const timer = setTimeout(() => void loadQuestionnaireSession().catch(() => {
    return;
  }), PREWARM_DELAY_MS);
  timer.unref?.();
}
function buildItemsForQuestion(question) {
  const items = question.options.map((o) => ({
    kind: "option",
    label: o.label,
    description: o.description
  }));
  for (const kind of sentinelsToAppend(question)) {
    items.push({ kind, label: displayLabel(kind) });
  }
  return items;
}
var DEFAULT_PROMPT_SNIPPET = `Ask the user up to ${MAX_QUESTIONS} structured questions (${MIN_OPTIONS}-${MAX_OPTIONS} options each) when requirements are ambiguous`;
var DEFAULT_PROMPT_GUIDELINES = [
  `Use ask_user_question whenever the user's request is underspecified and you cannot proceed without concrete decisions — you can ask up to ${MAX_QUESTIONS} questions per invocation.`,
  `Each question MUST have ${MIN_OPTIONS}-${MAX_OPTIONS} options. Every option requires a concise label (1-5 words) and a description explaining what the choice means or its trade-offs. The user can additionally type a custom answer via the automatically appended "Type something." row on every question, or press Esc to abandon the questionnaire. Do NOT author "Other" or "Type something." labels yourself — reserved labels are rejected at runtime.`,
  `Set multiSelect: true when multiple answers are valid. Provide an options[].preview markdown string when an option benefits from richer side-by-side context (mockups, code snippets, diagrams, configs) — single-select only. The "Type something." row is appended to every question; in preview mode it expands to the full pane width while typing so the custom answer is not cramped into the narrow options column. If you recommend a specific option, make that the first option and append "(Recommended)" to its label.`,
  "Do not stack multiple ask_user_question calls back-to-back — group all clarifying questions into one invocation."
];
var DEFAULT_TOOL_DESCRIPTION = `Ask the user one or more structured questions during execution. Use when you need to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take

Usage notes:
- Users can type a custom answer via the automatically appended "Type something." row on every question or press Esc to abandon the questionnaire. Do NOT author "Other" or "Type something." labels yourself — reserved labels are rejected at runtime.
- Use multiSelect: true when multiple answers are valid. The "Type something." row is available on every question, including when options carry a \`preview\`; in preview mode it expands to the full pane width while typing so the custom answer is not cramped into the narrow options column.
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label.

Preview feature:
Use the optional \`preview\` field on options when presenting concrete artifacts that users need to visually compare:
- ASCII mockups of UI layouts or components
- Code snippets showing different implementations
- Diagram variations
- Configuration examples

Preview content is rendered as markdown in a monospace box. Multi-line text with newlines is supported. When any option has a preview, the UI switches to a side-by-side layout with a vertical option list on the left and preview on the right. Do not use previews for simple preference questions where labels and descriptions suffice. Note: previews are only supported for single-select questions (not multiSelect).`;
function registerAskUserQuestionTool(pi) {
  const guidance = validateGuidanceFields(loadConfig().guidance);
  const answers = registerAnswerChannel(pi);
  pi.registerTool({
    name: ASK_USER_QUESTION_TOOL_NAME,
    label: "Ask User Question",
    description: guidance.description ?? DEFAULT_TOOL_DESCRIPTION,
    promptSnippet: guidance.promptSnippet ?? DEFAULT_PROMPT_SNIPPET,
    promptGuidelines: guidance.promptGuidelines ?? DEFAULT_PROMPT_GUIDELINES,
    parameters: QuestionParamsSchema,
    prepareArguments: prepareQuestionArguments,
    exposure: "model-only",
    renderCall: (args, theme) => renderAskCall(args, theme),
    renderResult: (result, { expanded }, theme, context) => renderAskResult(result, context?.args, theme, { expanded, isError: context?.isError ?? false }),
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      const typed = normalizeQuestionParams(params);
      if (!ctx.hasUI)
        return rejectWithoutUi();
      const validation = validateQuestionnaire(typed);
      if (!validation.ok) {
        return buildToolResult(validation.message, {
          answers: [],
          cancelled: true,
          error: validation.error
        });
      }
      const viaRpc = ctx.mode === "rpc" && hasDialogUI(ctx.ui);
      const open = answers.open(toolCallId, typed.questions, viaRpc ? "rpc" : "tui");
      try {
        emitAskUserPromptEvent(pi, typed, toolCallId);
        if (viaRpc)
          return await runRpcPath(pi, ctx.ui, typed, toolCallId);
        return await runTuiPath(pi, ctx, typed, open, toolCallId);
      } finally {
        answers.close(open);
      }
    }
  });
  prewarmSessionGraph();
}
async function runTuiPath(pi, ctx, typed, open, toolCallId) {
  const itemsByTab = typed.questions.map((q) => buildItemsForQuestion(q));
  let presentation;
  let removeOverlayInputListener;
  emitAskUserBlockedEvent(pi, true, toolCallId);
  try {
    const sessionLoad = await loadQuestionnaireSession();
    if (open.settled)
      return buildQuestionnaireResponse(open.settled, typed);
    if (!sessionLoad.ok) {
      return buildToolResult(sessionLoad.message, { answers: [], cancelled: true, error: sessionLoad.error });
    }
    const { QuestionnaireSession } = sessionLoad.module;
    const collapseKey = resolveCollapseKey(loadConfig());
    const notesKey = resolveNotesKey(loadConfig());
    const sessionRef = { current: null };
    const overlayHandleRef = { current: undefined };
    presentation = resolvePresentation();
    removeOverlayInputListener = presentation.hideOnCollapse ? registerCollapseKeyListener(ctx, collapseKey, sessionRef, overlayHandleRef) : undefined;
    const canReopenWhileHidden = removeOverlayInputListener !== undefined;
    const mount = (p) => Promise.race([
      ctx.ui.custom(makeSessionFactory({
        ctx,
        typed,
        itemsByTab,
        collapseKey,
        notesKey,
        canReopenWhileHidden,
        presentation: p,
        open,
        sessionRef,
        overlayHandleRef,
        Session: QuestionnaireSession
      }), p.overlay ? {
        overlay: true,
        overlayOptions: {
          anchor: "bottom-center",
          width: "100%",
          maxHeight: "100%",
          margin: { left: 0, right: 0, bottom: 0 }
        },
        onHandle: (handle) => {
          overlayHandleRef.current = handle;
          sessionRef.current?.setOverlayHandle(handle);
          if (open.settled)
            handle.hide();
        }
      } : { overlay: false }),
      open.answeredEarly
    ]);
    emitTerminalAttention();
    let result = await mount(presentation);
    if (result === YIELD_TO_OVERLAY) {
      presentation.release?.();
      presentation = STACKED_OVERLAY_PRESENTATION;
      result = await mount(presentation);
    }
    if (result === undefined) {
      open.host = "rpc";
      return await resolveUndefinedResult(ctx, typed);
    }
    return buildQuestionnaireResponse(result, typed);
  } finally {
    presentation?.release?.();
    removeOverlayInputListener?.();
    emitAskUserBlockedEvent(pi, false, toolCallId);
  }
}

// reconcile.ts
function reconcileAskUserQuestionTool(pi, ctx) {
  const active = pi.getActiveTools();
  const hasTool = active.includes(ASK_USER_QUESTION_TOOL_NAME);
  if (!ctx.hasUI && hasTool) {
    pi.setActiveTools(active.filter((n) => n !== ASK_USER_QUESTION_TOOL_NAME));
  } else if (ctx.hasUI && !hasTool) {
    pi.setActiveTools([...active, ASK_USER_QUESTION_TOOL_NAME]);
  }
}
function registerAskUserQuestionReconciler(pi) {
  pi.on("before_agent_start", (_event, ctx) => reconcileAskUserQuestionTool(pi, ctx));
}

// index.ts
try {
  const sdk = await import("@juicesharp/rpiv-i18n/loader");
  sdk.registerLocalesFromDir(I18N_NAMESPACE, import.meta.url, { label: "rpiv-ask-user-question" });
} catch {}
function pi_ask_user_default(pi) {
  registerAskUserQuestionTool(pi);
  registerAskUserQuestionReconciler(pi);
}
export {
  ASK_USER_ANSWER_EVENT2 as ASK_USER_ANSWER_EVENT,
  ASK_USER_ANSWER_RESULT_EVENT2 as ASK_USER_ANSWER_RESULT_EVENT,
  ASK_USER_BLOCKED_EVENT2 as ASK_USER_BLOCKED_EVENT,
  ASK_USER_PROMPT_EVENT2 as ASK_USER_PROMPT_EVENT,
  pi_ask_user_default as default
};
