# Engineering decisions

Recorded for plan milestone 2 ("lock before dependent work"). Update this file
when a decision changes.

## Toolchain and dependencies

| component         | pin                         | notes |
|-------------------|-----------------------------|-------|
| Kex               | 0.4.0-beta.2                | selected by `scripts/env.sh`; `package.kex` requires `>= 0.4.0-beta.2` |
| Rodolfo           | 0.2.0 @ e48d872 (vendored)  | `vendor/rodolfo`, sources unchanged, see PROVENANCE.md |
| Tiptap            | 3.31.3                      | core, react, pm, starter-kit, extension-table, extension-image |
| React             | 19.1.1                      | |
| Tailwind CSS      | 4.3.3                       | built through `@tailwindcss/vite`; prefix `mq`, no preflight |
| Radix (radix-ui)  | 1.6.7                       | primitives behind the shadcn/ui components |
| lucide-react      | 1.46.0                      | icons |

`package-lock.json` pins transitive npm versions. Dependencies are exact
versions in `package.json`.

## Markdown parser

No Markdown reader existed in the Kex standard library. Marqraft adapts the
subset parser from Tey's docgen (`src/marqraft/markdown.kex`, MIT). It is a
documented subset, not CommonMark: ATX headings, paragraphs, fenced code,
blockquotes, nested lists, GFM tables, thematic breaks, inline code, emphasis
and links. Anything the renderer or the editor cannot represent faithfully
(reference links, footnotes, setext headings, indented code, `~~~` fences) is
kept as a source block rather than normalized.

Custom elements are scanned by `Marqraft.Content.element`, a quote-aware,
recursive reader. It never matches nested tags with regular expressions.
Untouched blocks keep their original source slice (`data-marq-original` plus
a fingerprint in the editor), so edits produce line-sized Git diffs.

## Theme compilation

`.ket` templates compile to BEAM through `kex --compile`. The compiled runner
is cached under `.marqraft/cache/renderer-<sha256 of template>`, so a template
edit is a new compilation and content edits are not. Each render runs the
cached runner with a JSON context. Built-in themes are materialized into
`.marqraft/cache/themes/<name>-<digest>/` because templates compile from files.

## Rendering performance

Measured on a two-page book site (Kex 0.4.0-beta.2, Apple Silicon). The first
authoring UI polled a project endpoint that took 1.5 s, and a page took 5 s.

| stage                         | before  | after  | change |
|-------------------------------|---------|--------|--------|
| binding substitution          | 1883 ms | 3 ms   | substring search by `split`; comparing a fresh suffix at every position was quadratic |
| template run                  | 1477 ms | 134 ms | context passed as a base64 Erlang term instead of JSON parsed by the Kex parser |
| parse a 5 KB theme manifest   | 353 ms  | 0 ms   | OTP `json:decode` through `rpc:call`, falling back to `JSON.parse` for JSONC |
| `Theme.render` for one page   | 3645 ms | 283 ms | the above |

Notes for future work:

- Process spawns cost about 6 ms each; `safePath` now uses one `realpath` call and
  `Store.files` two `find` calls rather than several per entry.
- `FS.File.writeBytes` needs a Kex `Binary`, not a raw BEAM binary from an
  Erlang call; text written with `FS.File.write` works for both.
- Exceptions raised inside Erlang calls are not caught by `trying`/`rescue`,
  hence `rpc:call` around the native JSON decoder.
- An `if` block ending in `return X if condition` made two functions return
  `None`/fail with `function_clause` when the condition was false. A minimal
  script did not reproduce it, so the cause is unconfirmed; the affected sites
  follow the check with another statement.
- Each render still runs the compiled template in a separate `kex --run`
  process (~130 ms). Loading template modules into the server VM would remove
  that, but every runner currently compiles to the same `kex_main` module.

## Theme separation

Themes are separate repositories; `book` and `basic` are the only built-in
themes. Sites reference a theme by built-in name, project path, or external
path, and store only setting values. Built-in and external themes are copied
into the cache keyed by content, so every theme is read from project files
after resolution. `marq eject-theme` copies a built-in theme into the project.
Template context includes page `description` and every declared setting value
(`context["settings"]`), so text settings are usable in templates. Sites created before this change, which have a `theme/marqraft-theme.jsonc`, keep
using it.

## Authoring UI isolation

The UI is mounted into the live themed page, so it must coexist with
arbitrary theme CSS:

- Tailwind is built without preflight. A zero-specificity (`:where`) reset
  applies only under `.marq-ui`.
- Utilities are prefixed (`mq:`) so they cannot match theme class names, and
  are `!important` so theme selectors cannot override them.
- Design tokens are named `--ui-*`; theme setting variables are `--marq-*`.
- Utility sizes are in px, so a theme's root font size does not scale the chrome.

## HTTP API

All endpoints are under `/__marqraft/`, served on loopback, and require a
`Host` of `localhost:<port>` or `127.0.0.1:<port>`. POSTs also require a
matching `Origin` and the per-process `X-Marqraft-Session` token embedded in
dev pages. Errors are `{"error": {"kind": "validation" | "conflict", "message"}}`
with status 400 or 409.

| method | path                  | body                                            | result |
|--------|-----------------------|-------------------------------------------------|--------|
| GET    | `project`             |                                                 | config, resolved theme (blocks with `editorHTML`), pages, navigation, revisions |
| GET    | `document/:id`        |                                                 | page metadata, `source`, `body`, authoring `html` |
| POST   | `save`                | `id`, `revision`, `source`                      | page metadata with the new revision |
| POST   | `create`              | `title`, `path`, `template`, `parent`           | page metadata |
| POST   | `navigation`          | `revision`, `navigation`                        | `revision` |
| POST   | `menus`               | `revision`, `menus`                             | `revision` |
| POST   | `settings`            | `revision`, `settings`, optional `favicon`      | `revision`, `settings` |
| POST   | `upload`              | `name`, `base64`                                | `url` |
| POST   | `block`               | `id`, `settings`                                | `html` rendered with an empty body |
| POST   | `operation`           | `id`, `input`                                   | the result of the mapped action |

Revisions are SHA-256 digests of the file contents last read.
