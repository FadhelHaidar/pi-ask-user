# pi-ask-user

A standalone Pi extension providing the `ask_user_question` tool: tabbed questionnaires, single- and multi-select choices, custom answers, notes, and markdown previews.

Maintained independently by FadhelHaidar. No monorepo checkout or upstream-sync workflow is needed.

## Origin and why this version exists

This project is derived from **juicesharp's [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question)**, originally part of the MIT-licensed [`juicesharp/rpiv-mono`](https://github.com/juicesharp/rpiv-mono) monorepo. The original author built the questionnaire UI and tool; this repository preserves that work and its copyright notice.

The customization started as local patches to the published **2.12.0** extension, then moved into a personal monorepo fork, `FadhelHaidar/rpiv-mono`. This standalone repository extracts that patched extension rather than rewriting it. Its upstream baseline is commit [`68d9a0014b70006d7b04b57933752338a2716db7`](https://github.com/juicesharp/rpiv-mono/commit/68d9a0014b70006d7b04b57933752338a2716db7); the extraction snapshot and patch identifiers are recorded in [NOTICE.md](NOTICE.md), even if the former personal fork is deleted.

### Why customize the interaction?

The goal is to make multi-select questions work naturally when the available choices are useful **but not exhaustive**:

- **Choose options and add your own answer together.** Custom text should supplement checked choices, not replace them. For example, selecting “Unit tests” and “Integration tests” can also include “Add a smoke test on deployment.”
- **Keep typing separate from checkbox toggling.** Enter explicitly toggles a checkbox; Space is text in the custom editor and never toggles a checkbox.
- **Type as soon as the custom row is focused.** There is no extra step to open the editor, and Enter toggles whether the text is included without closing the editor.
- **Do not lose work when changing your mind.** Unchecking custom text excludes it from the submitted answer but preserves the draft. Navigation and tab changes keep the draft available, and rechecking restores it.

These are deliberate preferences for this version, not a claim that the original extension is unsuitable for everyone. Single-select behavior is preserved, and the multi-select changes have dedicated regression tests.

### Why a standalone repository?

Only the ask-user extension is needed here. Keeping an entire monorepo fork solely to install one customized tool adds unrelated packages, root-level packaging changes, and an upstream-sync workflow that this project does not need.

This repository therefore owns its releases independently. The config helper and test fixtures needed by the extension are included locally, while Pi supplies the host APIs. Optional rpiv-i18n compatibility remains available. There is **no dependency on the former fork**, no requirement to track upstream releases, and no upstream PR workflow to maintain.

## Install

```sh
pi install git:github.com/FadhelHaidar/pi-ask-user@v1.0.0
```

Restart Pi after installing. Remove any other package registering `ask_user_question` to avoid duplicate registration.

## Preserved custom behavior

- Multi-select answers can include predefined choices **and** custom text together.
- **Enter** toggles checkboxes; Space remains ordinary text while typing.
- The `Type something.` row is immediately editable when focused.
- Unchecking the custom answer keeps its draft; rechecking restores it.
- Drafts and checkbox state survive tab changes.
- Single-select behavior remains unchanged.

Use arrow keys to move, Tab to switch questions, Enter to choose/toggle, and Esc to cancel. The custom-answer row is appended automatically; models must not author it. Previews are available for single-select questions. Ctrl+] collapses the overlay, Shift+Enter adds a line, and Ctrl+G opens the external editor.

## Compatibility and configuration

The tool remains named `ask_user_question`. Event names and the localization namespace are preserved for compatibility. Existing configuration remains at `~/.config/rpiv-ask-user-question/config.json`, honoring `XDG_CONFIG_HOME` with legacy fallback.

```json
{ "collapseKey": "alt+o" }
```

The optional `@juicesharp/rpiv-i18n` integration is retained. Without it, the UI uses English. Runtime config helpers are included locally; no rpiv-config dependency is required.

## Reference

- [Tool schema](docs/tool-schema.md)
- [Keyboard and layout](docs/keyboard.md)
- [Configuration](docs/configuration.md)
- [Hosts and runtime behavior](docs/hosts.md)
- [Localization](docs/localization.md)

## Development

Requires Node.js 22+ and Bun.

```sh
bun install
bun run test
pi -e ./index.ts
```

Tests and fixtures live in this repository, including the multi-select/custom-answer regressions. Published optional localization is installed only for development tests. Pi supplies its host libraries at runtime.

## License

MIT. Derived from juicesharp's rpiv-ask-user-question; original copyright is retained. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
