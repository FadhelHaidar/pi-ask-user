# Attribution and provenance

This standalone extension was extracted from `packages/rpiv-ask-user-question`
in juicesharp/rpiv-mono (MIT), with FadhelHaidar's multi-select/custom-answer
patches preserved. The source snapshot is commit
`c814ebb3` of FadhelHaidar/rpiv-mono (the former personal fork).

`lib/config-io.ts` and the fixtures in `test/utils/` were also extracted from
that MIT-licensed source tree. Original copyright is retained in LICENSE.

This repository is maintained independently. It does not require the monorepo,
an upstream checkout, or the rpiv-config npm package. The rpiv-i18n integration
remains optional at runtime; its published package is used for localization tests.

The tool name, rpiv event names, localization namespace, and configuration path
remain unchanged for compatibility with existing sessions and other extensions.
