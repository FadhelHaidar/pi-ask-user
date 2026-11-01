# Selective upstream update with fork behavior preserved

## Context

Local package 1.0.4 derives from upstream 2.12.0 (`68d9a0014b70006d7b04b57933752338a2716db7`). Reviewed upstream 2.15.0 at `46dbdfd78ab631bbf3ce41c2618bb173a5ec2725`. This is a selective port, not replacement of the fork with upstream. No production changes have been made.

### Required behavior — release blockers

- Predefined selections and explicitly checked custom text can be submitted together.
- Enter toggles checkboxes; Space never toggles and remains text while editing.
- Focusing the custom row immediately enables editing.
- Unchecking custom text retains its draft; rechecking restores it.
- Drafts and checkbox state survive tab changes and confirmation paths.
- Unchecked custom drafts never enter submitted answers.
- Preserve the Pi 1.2 `renderFakeCursor` implementation.
- Preserve existing single-select behavior unless a specific change is approved.
- Keep standalone compiled packaging, existing config location, tool name and event/localization compatibility.

## Approach

Port fixes individually around the local router, reducer, draft maps and projections. Never wholesale replace these files. Establish fork regression tests before porting. Upstream automatic custom-text selection, Space toggling and draft-clearing behavior are excluded.

Approved scope: all compatible upstream features, implemented in staged groups. Preserve current blank single-select submission behavior: do not adopt upstream's blank-input guard or its changed single-select RPC blank/cancel loop. Port RPC answer preservation/combined input, argument preparation, skipped-question reporting, keyboard improvements, transcript receipts, coordinated preview/notes/layout fixes, inline presentation and external-answer events. Output and presentation changes receive dedicated tests. Source-loader `.ts` import churn and upstream monorepo packaging are excluded because this fork ships compiled JavaScript.

Digit shortcuts toggle predefined multi-select rows and focus custom editing without checking or submitting the draft. Digits remain text in editors; configured keys take precedence. Saved multi-select answers restore focus to Next, never directly to the custom editor. Preserve blank single-select confirmation and free-text entry; number shortcuts are the explicitly selected additive feature.

Adopt inline presentation with concurrency/overlay fallback as a coordinated lifecycle change: reserve/release the editor slot safely, distinguish capturing overlays, cap terminal height and preserve collapse behavior. Do not copy assumptions about private host overlay APIs without checking Pi 1.2 compatibility. If a host capability is unavailable, retain the working overlay path.

External-answer events are TUI-only: validate complete payloads before settlement, route by toolCallId, share first-answer-wins settlement with terminal input, handle early replies and close channels in teardown. Explicit supplied external text is intentional input, not authorization to submit an unchecked local draft. Keep existing public events compatible while adding typed answer/result exports. Port model-only tool exposure for codemode compatibility after checking host support.

## Files to modify

Critical paths, grouped by stage; preserve local `.js` import conventions:
- `rpc-fallback.ts` and its existing tests: preserve arbitrary replies and combined selections/custom text.
- `tool/normalize-params.ts`, `ask-user-question.ts` and normalization tests: reuse upstream argument preparation before host validation.
- `tool/response-envelope.ts`, `tool/types.ts` and envelope tests: report unanswered questions without changing fully answered output.
- `config.ts`, `state/state.ts`, `state/build-questionnaire.ts`, `state/questionnaire-session.ts`, `state/key-router.ts` and associated tests: configurable notes keys, digit shortcuts and key precedence.
- `state/state-reducer.ts` and reducer/session tests: saved-answer focus restoration; retain local custom checkbox and draft handling.
- `state/selectors/derivations.ts`, `state/selectors/projections.ts`, `view/tab-content-strategy.ts`, `view/dialog-builder.ts`, `view/components/preview/preview-pane.ts`, `view/components/preview/preview-block-renderer.ts`, and layout tests: saved-note indicators, row allowances, pinned heading and scroll-to-cursor. Keep the custom checkbox projection local.
- New `view/dialog-copy.ts` and `view/scroll-window.ts`, plus existing consumers: upstream runtime-cycle removal and coherent scrolling; add an import-cycle regression check.
- New `view/transcript.ts` and tests; `ask-user-question.ts`: compact renderCall/renderResult receipts with expanded details, without independently changing model output.
- New root `presentation.ts`, `presentation.test.ts`, and `ask-user-question.presentation.test.ts`; `ask-user-question.ts`: inline slot ownership, row budgeting, overlay fallback and teardown.
- New root `answer-channel.ts`, new `tool/external-answer.ts` and their tests; `ask-user-question.ts`, `events.ts`, `index.ts`, `scripts/index.d.ts.template`: validated external-answer routing, event types and public exports.
- `locales/*.json`: saved-note text and configurable notes-key hints across all nine locales; keep the localization namespace.
- `tests/ask-user-question-multi-custom.test.ts`: strengthen fork acceptance cases.
- `README.md`, `CHANGELOG.md`, and generated `dist/`: document approved behavior/output changes and rebuild distribution. Do not change package version or publish without instruction.

## Reuse

- `state/state-reducer.ts`: `persistMultiSelectAnswer`, `toggleHandler`, `multiConfirmHandler`, and existing custom draft maps remain authoritative.
- `state/key-router.ts`: preserve routing precedence and input-mode forwarding; use existing key matching for encoded notes keys.
- `tool/format-answer.ts`: already combines selections and custom text; do not duplicate it.
- `view/components/inline-input.ts`: retain `renderFakeCursor` unchanged.
- Existing RPC, response-envelope, router, session and multi-custom tests; existing build/declaration pipeline.

## Steps

- [x] Confirm scope: all compatible upstream features; retain existing blank single-select behavior.
- [x] Lock fork invariants into regression tests before modifying shared behavior, including blank single-select and custom RPC cancellation behavior.
- [x] Stage 1: port RPC answer preservation/combined input, argument preparation and skipped-question reporting. Preserve fully answered output and current blank/cancel single-select behavior.
- [x] Stage 2: add notesKey validation/fallback, CSI-u matching, digits and saved-answer focus. Retain Enter-only toggling, editor routing, explicit custom check state and draft retention.
- [x] Stage 3: add compact transcript receipts and coordinated saved-note/preview/scroll fixes, with locale updates and cycle removal. Preserve cursor rendering.
- [x] Stage 4: port inline presentation with safe slot ownership, capturing/noncapturing overlay handling, concurrency fallback, height budgeting and idempotent teardown.
- [x] Stage 5: add validated TUI external-answer events, toolCallId correlation, early-answer handling and shared first-answer settlement; add compatible public declarations. Apply supported model-only exposure.
- [x] Review all affected callers, result types, fixtures, documentation and generated exports after each stage.
- [x] Run a fresh independent reviewer after nontrivial changes, resolve findings, then validate the integrated result. (Three reviews: BLOCK → BLOCK → APPROVE; every finding fixed and covered by a regression test.)
- [x] Rebuild distribution and summarize included/deferred upstream changes. No publishing or commits unless requested. (dist rebuilt and `build:check` clean; nothing published or committed.)

## Verification

- Existing baseline: 691 tests passed on full rerun; typecheck and build consistency passed. An initial prewarm timing test failed once, then passed in isolation and full rerun; investigate if it recurs.
- Run focused RPC, normalization, envelope, router and multi-custom/session tests after each port.
- Assert combined checked custom text is submitted; unchecked drafts are absent from output but retained; toggling/rechecking/tab switching preserve state; Space never toggles; immediate editing still works.
- Test encoded terminal keys, invalid/reserved notesKey fallback, configured-key precedence, digits remaining text in custom/notes editors, and restored focus without implicit custom editing or lost drafts.
- Test small terminals, long previews/notes, saved-note indicators, pinned headings, cursor visibility and scrolling; exercise all updated localized hint templates.
- Verify transcript compact/expanded rendering does not change model answers, and partial-answer reporting preserves fully answered output.
- Test concurrent inline calls, capturing/noncapturing overlays, collapse/restore, cancellation and cleanup; verify fallback on missing host capabilities.
- Test invalid/duplicate/missing external answers, unknown toolCallId, unsupported RPC host, early replies, competing terminal/event submissions and teardown. Exactly one result wins; rejected payloads do not mutate local drafts or state.
- Verify compiled event exports and declarations through existing consumer type tests; check no runtime import cycle was introduced.
- Full test suite, `bun run typecheck`, rebuild, and `bun run build:check`.
- Interactive Pi terminal checks for Enter, Space, custom-row editing, drafts across tabs and hardware/fake cursor behavior. Automated tests alone cannot guarantee terminal compatibility.

## Decisions and limits

User selected all compatible upstream features and retained current blank single-select behavior. Fork preservation is mandatory, not an optional tradeoff. Behavioral compatibility does not mean an unchanged presentation: inline mode, number shortcuts, transcript receipts and partial-answer reporting are intentional additions. Publishing, version bumps and unrelated cleanup are outside scope.

Not yet checked: implementation, actual terminal interaction, and event integration in a running host. Main risks are layout/host lifecycle differences and accidental adoption of upstream custom-draft semantics; stage tests and independent review are required before calling the update complete.
