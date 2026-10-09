import {
  validateGuidanceFields,
  COLLAPSE_KEY_OFF,
  resolveCollapseKey,
  formatKeySpecForDisplay,
  loadConfig,
  ROW_INTENT_META,
  sentinelsToAppend,
  I18N_NAMESPACE,
  t,
  displayLabel,
  formatAnswerScalar
} from "./chunks/index-x7fb685n.js";
import {
  ASK_USER_PROMPT_EVENT2,
  ASK_USER_BLOCKED_EVENT2
} from "./chunks/index-bx2tbz93.js";

// ask-user-question.ts
import { isKeyRelease, isKeyRepeat, matchesKey } from "@earendil-works/pi-tui";

// rpc-fallback.ts
var MULTI_SELECT_INSTRUCTIONS = 'Enter the numbers of all that apply, comma-separated (e.g. "1,3"), or type a custom answer as plain text.';
var CUSTOM_ANSWER_TITLE = "Type your answer:";
var MULTI_SELECT_PLACEHOLDER = "1,3";
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
  const idx = parseIndex(chosen, options.length);
  if (idx == null)
    return;
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

${t("rpc.custom_answer_title", CUSTOM_ANSWER_TITLE)}`, "");
  if (typed == null)
    return;
  return { questionIndex, question: q.question, kind: "custom", answer: typed };
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
  const tokens = trimmed.split(/[,\s]+/).filter((tok) => tok.length > 0);
  const indices = tokens.map((tok) => /^\d+\.?$/.test(tok) ? parseIndex(tok, q.options.length) : null);
  if (indices.every((i) => i != null)) {
    const selected = [];
    for (const i of indices) {
      const label = q.options[i].label;
      if (!selected.includes(label))
        selected.push(label);
    }
    return { questionIndex, question: q.question, kind: "multi", answer: null, selected };
  }
  return { questionIndex, question: q.question, kind: "custom", answer: trimmed };
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
  for (let i = 0;i < params.questions.length; i++) {
    const a = result.answers.find((x) => x.questionIndex === i);
    if (a)
      segments.push(buildAnswerSegment(a));
  }
  if (result.globalNote && result.globalNote.length > 0) {
    segments.push(`global note: ${result.globalNote}.`);
  }
  if (segments.length === 0) {
    return buildToolResult(DECLINE_MESSAGE, { answers: result.answers, cancelled: true });
  }
  return buildToolResult(`${ENVELOPE_PREFIX} ${segments.join(" ")} ${ENVELOPE_SUFFIX}`, result);
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

// ask-user-question.ts
function emitAskUserPromptEvent(pi, params) {
  const payload = {
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
function emitAskUserBlockedEvent(pi, active) {
  const payload = { active };
  pi.events.emit(ASK_USER_BLOCKED_EVENT2, payload);
}
function rejectWithoutUi() {
  return buildToolResult(ERROR_NO_UI, { answers: [], cancelled: true, error: "no_ui" });
}
async function runRpcPath(pi, ui, typed) {
  emitAskUserBlockedEvent(pi, true);
  try {
    emitTerminalAttention();
    return buildQuestionnaireResponse(await runRpcQuestionnaire(ui, typed), typed);
  } finally {
    emitAskUserBlockedEvent(pi, false);
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
    mod = await import("./chunks/questionnaire-session-gdq5zqtt.js");
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
  const { ctx, typed, itemsByTab, collapseKey, canReopenWhileHidden, sessionRef, Session } = config;
  return (tui, theme, keybindings, done) => {
    const session = new Session({
      tui,
      theme,
      params: typed,
      itemsByTab,
      done,
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
      canReopenWhileHidden
    });
    sessionRef.current = session;
    return session.component;
  };
}
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
  pi.registerTool({
    name: ASK_USER_QUESTION_TOOL_NAME,
    label: "Ask User Question",
    description: guidance.description ?? DEFAULT_TOOL_DESCRIPTION,
    promptSnippet: guidance.promptSnippet ?? DEFAULT_PROMPT_SNIPPET,
    promptGuidelines: guidance.promptGuidelines ?? DEFAULT_PROMPT_GUIDELINES,
    parameters: QuestionParamsSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
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
      emitAskUserPromptEvent(pi, typed);
      if (ctx.mode === "rpc" && hasDialogUI(ctx.ui)) {
        return runRpcPath(pi, ctx.ui, typed);
      }
      const itemsByTab = typed.questions.map((q) => buildItemsForQuestion(q));
      const sessionLoad = await loadQuestionnaireSession();
      if (!sessionLoad.ok) {
        return buildToolResult(sessionLoad.message, { answers: [], cancelled: true, error: sessionLoad.error });
      }
      const { QuestionnaireSession } = sessionLoad.module;
      const collapseKey = resolveCollapseKey(loadConfig());
      const sessionRef = { current: null };
      const overlayHandleRef = { current: undefined };
      const removeOverlayInputListener = registerCollapseKeyListener(ctx, collapseKey, sessionRef, overlayHandleRef);
      const canReopenWhileHidden = removeOverlayInputListener !== undefined;
      emitAskUserBlockedEvent(pi, true);
      try {
        emitTerminalAttention();
        const result = await ctx.ui.custom(makeSessionFactory({
          ctx,
          typed,
          itemsByTab,
          collapseKey,
          canReopenWhileHidden,
          sessionRef,
          Session: QuestionnaireSession
        }), {
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
          }
        });
        if (result === undefined) {
          return resolveUndefinedResult(ctx, typed);
        }
        return buildQuestionnaireResponse(result, typed);
      } finally {
        removeOverlayInputListener?.();
        emitAskUserBlockedEvent(pi, false);
      }
    }
  });
  prewarmSessionGraph();
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
  ASK_USER_BLOCKED_EVENT2 as ASK_USER_BLOCKED_EVENT,
  ASK_USER_PROMPT_EVENT2 as ASK_USER_PROMPT_EVENT,
  pi_ask_user_default as default
};
