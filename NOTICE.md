# Attribution and provenance

## Original project

This extension is derived from [juicesharp/rpiv-mono](https://github.com/juicesharp/rpiv-mono),
specifically [`packages/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question),
published as `@juicesharp/rpiv-ask-user-question`. The original code is MIT-licensed
and authored by juicesharp. This is an extraction of that implementation with
personal patches, not an independently written replacement.

## Source lineage

1. Local interaction patches began against the published 2.12.0 extension.
2. The patches were ported into the personal fork `FadhelHaidar/rpiv-mono`,
   based on upstream commit
   [`68d9a0014b70006d7b04b57933752338a2716db7`](https://github.com/juicesharp/rpiv-mono/commit/68d9a0014b70006d7b04b57933752338a2716db7).
3. The patched extension was extracted into `FadhelHaidar/pi-ask-user` from
   fork snapshot `c814ebb34cbcf68143ea88089be8c7cd1a69159c`.

Patch identifiers in the former fork (recorded here for provenance, not as
required downloads or links to a repository that must remain online):

- `76abd683b1a300e4962ed1ec2288c6430c10fadb` — combined multi-select/custom
  answers, Enter-only toggling, immediate custom-row editing, and draft retention.
- `023c6ac46e7eb99e7a3e3558ef13aba8bcff7090` — regression coverage for those behaviors.

## Customization and independent maintenance

The interaction changes let custom text supplement predefined selections while
keeping checkbox selection distinct from typing and preserving unchecked drafts.
The standalone extraction removes the need to maintain or install a full
monorepo fork for this single tool. This project owns its releases; upstream
synchronization and upstream PR preparation are not part of its maintenance workflow.

`lib/config-io.ts` and the fixtures in `test/utils/` were also extracted from
that MIT-licensed source tree. Original copyright is retained in LICENSE.

This repository is maintained independently. It does not require the monorepo,
an upstream checkout, or the rpiv-config npm package. The rpiv-i18n integration
remains optional at runtime; its published package is used for localization tests.

The tool name, rpiv event names, localization namespace, and configuration path
remain unchanged for compatibility with existing sessions and other extensions.
