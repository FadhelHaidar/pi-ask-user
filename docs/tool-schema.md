# Tool schema

The complete programmatic surface of `ask_user_question`: what the model sends, what
validation rejects, what comes back, and the event other extensions can listen to.

## Parameters

```ts
ask_user_question({
  questions: [
    {
      question: string,            // full question text, ends with "?"
      header: string,              // chip label, max 16 chars
      options: [
        {
          label: string,           // 1-5 words, max 60 chars
          description: string,     // what the choice means / its trade-off
          preview?: string,        // markdown rendered next to the options
        },
        // … 2-4 options total
      ],
      multiSelect?: boolean,       // default false
    },
    // … 1-4 questions total
  ]
})
```

### Limits

| Field | Constraint | Enforced by |
| --- | --- | --- |
| `questions` | 1-4 entries | TypeBox schema + `validateQuestionnaire` |
| `questions[].header` | max 16 characters | TypeBox schema only |
| `questions[].options` | 2-4 entries | TypeBox schema (both bounds) + `validateQuestionnaire` (minimum only) |
| `options[].label` | max 60 characters | TypeBox schema only |
| `options[].preview` | single-select questions only | tool description (multi-select tabs render checkbox rows) |

The two `maxLength` limits are checked by the parameter schema before `execute` runs;
the runtime validator does not re-check them.

### Reserved option labels

Authoring any of `"Other"`, `"Type something."`, or `"Next"` as an option label is
rejected with `reserved_label`. The last two are the runtime sentinel rows the dialog
appends itself; `"Other"` is reserved because models are conditioned to reach for it.
Reservation is unconditional — a single-select question rejects `"Next"` even though
that row is never appended there.

## Validation errors

Every rejection returns `cancelled: true`, an empty `answers` array, and an `error`
code. The `content[0].text` string is written for the model, not for a log.

| `error` | Cause |
| --- | --- |
| `no_questions` | `questions` was empty |
| `too_many_questions` | more than 4 questions in one call |
| `duplicate_question` | two questions with identical text |
| `empty_options` | a question carried fewer than 2 options |
| `reserved_label` | an option used a reserved label |
| `duplicate_option_label` | two options in one question share a label |
| `no_ui` | the run has no UI (`ctx.hasUI === false`) |
| `no_custom_ui` | the host cannot render custom UI and exposes no `select`/`input` dialogs |
| `session_load_failed` | the dialog module failed to import (dependencies changed on disk mid-session) |
| `stale_module_cache` | the loader cached a broken module after an earlier failed import; needs a Pi restart |

`reserved_label` short-circuits before `duplicate_option_label`.

## Result

```ts
{
  content: [{ type: "text", text: string }], // envelope prose, or the decline message
  details: {
    answers: Array<{
      questionIndex: number,
      question: string,
      kind: "option" | "custom" | "multi",
      answer: string | null,       // option label, typed text, or null for multi
      selected?: string[],         // chosen labels, multi-select only
      notes?: string,              // free-text note, when you wrote one
      preview?: string,            // echoed back when the chosen option carried a preview
    }>,
    cancelled: boolean,
    globalNote?: string,          // Submit-tab note; present even when cancelled is true
    error?: QuestionnaireError,    // one of the codes above
  }
}
```

### Envelope text

On success the text reads `User has answered your questions: "<question>"="<answer>". …
You can now continue with the user's answers in mind.` A chosen option's `preview` is
appended as `selected preview: <markdown>`, a per-question note as `user notes: <text>`,
and the Submit tab's global note as a trailing `global note: <text>` segment. A global
note alone still yields the answered envelope — it counts as an answer even when every
question is blank.

Cancelling, and any result with neither answer segments nor a global note, both collapse
to the single string `User declined to answer questions` so the model sees one canonical
signal. Partial submission is allowed: unanswered questions contribute no segment, and
their question text is listed in an `unanswered: "<question>", …` segment after the
answers, with the same indexes in `details.unanswered`. A global note counts as an answer
on its own, so a note with every question blank still yields the answered envelope.
A cancelled result always reads as the decline in text; its note, if any, survives only
in `details.globalNote`.

## Event contract

The package publishes three events on Pi's event bus — one before the dialog is shown, two
bracketing the wait — and accepts a fourth that answers the questionnaire from outside the
terminal. Import them from the `/events` subpath:

```ts
import { ASK_USER_PROMPT_EVENT, type AskUserPromptEventPayload } from "@fadhelhaidar/pi-ask-user/events";

pi.events.on(ASK_USER_PROMPT_EVENT, (payload: AskUserPromptEventPayload) => {
  // payload.toolCallId, payload.questions[].{ question, header, multiSelect, options[] }
  // payload.questions[].options[].{ label, description, hasPreview }
});
```

The channel name is `rpiv:ask-user:prompt`. Preview *content* is deliberately not shipped
in the payload — only `hasPreview: boolean` — so listeners forwarding the event across a
process or network boundary stay cheap. The prompt event fires after validation passes and
before the dialog is shown; `rpiv:ask-user:blocked` then brackets the wait with
`{ active: true, toolCallId }` and `{ active: false, toolCallId }`, including when the
dialog never mounts because an answer arrived first.

## Answering from outside the terminal

A supervisor, bridge or test harness emits `rpiv:ask-user:answer` on the same bus:

```ts
pi.events.emit(ASK_USER_ANSWER_EVENT, {
  toolCallId,
  answers: [{ questionIndex: 0, optionIndexes: [1], notes: "keep the bus factor up" }],
  globalNote: "ship on Tuesday",
});
```

`answers` carries one entry per question — `optionIndexes` for chosen options (authored
order is preserved, not the order given here), `text` for a typed custom answer, `notes`
for that question's note; multi-select accepts both `optionIndexes` and `text` together,
single-select takes one index or `text`. Send `{ cancel: true }` instead to decline as `Esc`
does. Every attempt gets exactly one `rpiv:ask-user:answer-result` verdict:
`{ ok: true }`, or `{ ok: false, code, reason }` with `code` one of `not_found`,
`invalid_payload`, `invalid_answer` or `unsupported_host`. Validation is strict and
all-or-nothing — a blank, duplicated or out-of-range answer applies nothing and leaves the
dialog open — and the first answer wins, whether it came from the keyboard or this event.
Questionnaires are addressed by the `toolCallId` on the prompt event, so parallel calls
are independent. Events answer terminal dialogs only; RPC hosts answer through their own
dialogs and reject with `unsupported_host`.

Stability policy for the `rpiv:*` namespace: channel names are immutable, payload changes
are append-only and always optional, payloads stay JSON-safe, and any breaking change ships
as a new channel (e.g. `rpiv:ask-user:prompt.v2`) rather than a version field.
