# pi-ask-user

A standalone Pi extension providing the `ask_user_question` tool: tabbed questionnaires, single- and multi-select choices, custom answers, notes, and markdown previews.

Maintained independently by FadhelHaidar. No monorepo checkout or upstream-sync workflow is needed.

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
