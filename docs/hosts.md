# Hosts and runtime behavior

Where the questionnaire renders, what it degrades to, and what happens when it cannot
render at all.

## Three environments

| Environment | What the model sees | What you see |
| --- | --- | --- |
| Interactive terminal | `ask_user_question` in its tool list | The full tabbed TUI dialog, inline in Pi's editor area (or as an overlay — see below) |
| RPC / ACP host (VS Code pendant, Zed, Paseo) | `ask_user_question` in its tool list | A sequence of the host's own native select and input dialogs |
| Non-interactive run (no UI) | Nothing — the tool is removed | Nothing |

### Terminal attention

After UI availability and questionnaire validation succeed, the package emits exactly one standard terminal BEL (`\x07`) immediately before the interactive wait begins. The signal is sent to `stdout` only when `process.stdout.isTTY` is true, so redirected output and non-TTY RPC streams stay untouched. A TTY-backed RPC dialog walker receives the same signal as the TUI path.

The BEL is best effort: if the synchronous terminal write fails, the questionnaire continues and its existing prompt/blocked lifecycle and result envelope are unchanged. The terminal configuration decides whether the BEL is audible, visual, or ignored. No BEL is emitted for missing UI, invalid questionnaires, or a failed TUI session load.

### Non-interactive runs

A `before_agent_start` hook reconciles the active tool set against `ctx.hasUI` before every
turn. When there is no UI, `ask_user_question` is stripped from the list so the model never
sees a tool it cannot use — better than offering it and auto-declining every call. When UI
comes back, the tool is restored. The reconciler is idempotent and leaves sibling tools
untouched.

A second guard lives inside the tool handler as a one-turn backstop: if a call somehow
arrives without UI, it returns `error: "no_ui"` and the text
`Error: UI not available (running in non-interactive mode)`.

### RPC and ACP hosts

RPC hosts report `hasUI: true` because Pi's dialog sub-protocol works there, but custom
terminal UI does not render. The package detects this two ways: hosts that advertise
`ctx.mode === "rpc"` route straight to the dialog walker, skipping the TUI import
entirely, and older RPC builds are caught by a backstop when custom UI resolves without
rendering anything. Either path requires the host to expose both `select` and `input`.

The walker asks one question per dialog and returns exactly the same result envelope the
TUI produces. Trade-offs inherent to the native primitives:

- No side-by-side preview pane. Previews are folded into the dialog title instead,
  truncated at 600 characters each.
- No tab bar and no Submit review tab — one dialog per question, in order.
- No notes. Both note kinds — per-question `n` on a question tab and global `n` on the
  Submit tab — are terminal-only; the host's native `select` and `input` primitives carry
  no note field.
- Multi-select is a free-text input: type the option numbers, comma-separated
  (`1,3`), optionally followed by `; your own answer` to submit checks and custom text
  together. A reply that is no option number is taken as the typed custom answer; an empty
  input commits an empty selection, matching `Next` with nothing toggled. A blank custom
  answer stays blank (this fork keeps that behavior; upstream returns to the picker).
- Dismissing any dialog cancels the whole questionnaire, mirroring `Esc` in the TUI.

If the host can render neither custom UI nor dialogs, the call returns
`error: "no_custom_ui"` with text telling the model the user never saw the questions and
that it should ask them as plain chat text instead — explicitly not a decline.

## Where the dialog renders

In a terminal the questionnaire mounts inline in Pi's editor slot by default, capped at
70% of the terminal height (at least 12 rows), so `PageUp`/`PageDown` and the mouse wheel
keep scrolling the transcript while a question is open. It falls back to an overlay in two
cases, both of which mean the inline slot cannot receive keys:

- Another questionnaire already holds the slot.
- An overlay that captures input (for example `/btw`) is on screen. A question is stacked
  on top of it as an overlay instead, and collapses to its one-line row rather than
  hiding, because Pi pops overlays from the top of its stack.

`ctx.ui.custom` options that already allocate the dialog's rows (marked with the host
symbol `rpiv-ask-user-question:host-allocated-rows`) are exempt from the 70% cap, so a
host that sizes the slot itself is never shrunk twice.

Because Pi closes an overlay by popping the top of its stack, an answer that arrives from
outside (`rpiv:ask-user:answer`) removes a stacked questionnaire through its own overlay
handle rather than the host's close callback. Answering the upper one is unaffected; the
lower one leaves the stack without disturbing it.

## Answering from outside the terminal

A program driving Pi — a pane supervisor, a phone or web bridge, a test harness — can
answer an open questionnaire without synthesizing keystrokes:

| Event | Direction | Purpose |
| --- | --- | --- |
| `rpiv:ask-user:prompt` | out | Questions, plus the `toolCallId` naming this questionnaire |
| `rpiv:ask-user:blocked` | out | `{ active: true }` while input is awaited, `{ active: false }` when it ends, both carrying `toolCallId` |
| `rpiv:ask-user:answer` | **in** | Answer or cancel the questionnaire named by `toolCallId` |
| `rpiv:ask-user:answer-result` | out | One verdict per attempt: `{ ok }`, or `{ ok: false, code, reason }` with `code` one of `not_found`, `invalid_payload`, `invalid_answer`, `unsupported_host` |

`rpiv:ask-user:answer` takes `answers` — one `{ questionIndex, optionIndexes?, text?, notes? }`
entry per question, where single-select takes one index or `text` and multi-select takes
either or both — plus an optional `globalNote`, or `{ cancel: true }` to decline as `Esc`
does. Validation is strict and all-or-nothing: a missing, duplicated, out-of-range or
blank answer applies nothing and leaves the dialog open, since a partly applied answer
would reach the model indistinguishable from one the user gave. The first answer wins,
whether it came from the keyboard or from this event, and the events are terminal-only:
RPC hosts answer through their own dialogs and return `unsupported_host`.

## Conditional surfaces

Some parts of the dialog exist only under the right conditions:

| Surface | Appears when |
| --- | --- |
| Tab bar and Submit tab | The call carries more than one question |
| `Next` row | The question is multi-select |
| `Type something.` row | Always |
| Side-by-side preview | An option carries a `preview`, and terminal and pane are both ≥ 100 columns |
| Preview pane at all | Single-select questions only |
| Collapse shortcut | `collapseKey` is not `"off"` |
| Overlay instead of inline | Another questionnaire holds the editor slot, or an overlay that captures keys is on screen |
| Full overlay hide on collapse | The host also exposes raw terminal input (the only path that can reopen a hidden overlay); without it, collapsing shrinks the dialog to a visible one-line row instead |
| Localized chrome | `@juicesharp/rpiv-i18n` is installed |

## Loading and startup cost

The dialog's render graph costs roughly 560 ms to import, so it is loaded lazily — on the
first tool call, not when the extension registers. To keep that first call fast and safe,
the graph is also pre-warmed in the background two seconds after startup. The pre-warm
timer is unref'd, so it never holds a process open, and a failed pre-warm is swallowed:
the first real call re-imports and reports properly.

The pre-warm exists for a specific failure. Pi's module loader registers a module in its
graph cache *before* evaluating it and does not evict it if evaluation throws. If your
package manager replaces the dependency store while Pi is running, one failed import can
poison the cache for the rest of the process. Evaluating the graph early, while the paths
Pi resolved at boot still exist, keeps it in memory for the process lifetime and makes
that unreachable.

When it does happen, you get a structured envelope rather than a raw `TypeError`:

| `error` | Meaning | Fix |
| --- | --- | --- |
| `session_load_failed` | The dialog module could not be imported. | Repair the install if needed, then restart Pi. |
| `stale_module_cache` | The module cache went stale after an earlier failed import. | Restart Pi — this is unrecoverable in the running process. |

Both messages tell the model the questions were never shown and to ask them as plain chat
text instead of treating the failure as a decline.
