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
is cached under `.marqraft/cache/templates-v1/<digest>`, so a template edit is
a new compilation and content edits are not, and is loaded into marq's VM and
called with the context. Built-in themes are materialized into
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
- Each template compiles once into a module named by its digest
  (`MarqraftTemplate<digest>`, with its body in `kex_marqraft_template_<digest>`)
  that marq loads into its own VM, so a render is a function call. Running
  each render as a `kex --run` process cost ~140 ms of VM start: a page in
  `marq dev` went from ~220 ms to ~65 ms, and building kexhq/docs (101 pages)
  from 19 s to 3.5 s.

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
| POST   | `assist`              | `task` and its fields (see below)               | `markdown` + `html`, `text`, or `answer` + `edits` |

Revisions are SHA-256 digests of the file contents last read.

`marq dev` keeps the loaded site in memory (`Marqraft.Live`) and reloads it
after every successful authoring action and whenever a watcher sees the
project's files change: authored files twice a second, mounted output every
third second. Each reload is announced as `{"type": "changed"}` over the
WebSocket at `/__marqraft/live` to every open editor, which then checks its
page and project as it used to every two seconds; while the socket is down,
editors fall back to that polling.

## Writing assistant

The editor's AI features (a block's "Ask AI" menu, `/ai` and `/continue`,
the "Ask AI" chat, and autocomplete) all call `POST assist`. That request
runs in its own request process, not through the `Workspace` actor: a model
takes seconds to answer, and saves must not queue behind it. It changes no
files.

Prompts, answer checking and Markdown rendering live in `Marqraft.Assistant`
and are the same for every provider. A provider only turns a prompt into
text:

- `claude`: the local Claude Code CLI in print mode, logged in as the
  author, so no API key is involved. It runs with `--tools ""`,
  `--strict-mcp-config` and `--safe-mode`, so no tools, MCP servers,
  CLAUDE.md, plugins or hooks. Page text is untrusted input, and with these
  flags it can only produce an answer.
- `command`: any CLI configured in `~/.config/marqraft/assistant.json`,
  with `{prompt}`, `{system}` and `{model}` placeholders in its args (Codex,
  OpenCode, `llm`, local runners). Structured output (chat edits) comes from
  prompt instructions plus validation and one retry, not from a
  provider-specific schema flag.

Provider choice is per machine (which tools are installed), not per site:
the config file is under the user's home, `MARQ_ASSISTANT_PROVIDER` /
`MARQ_ASSISTANT_CONFIG` / `MARQ_CLAUDE` override it, and without a choice the
first available provider answers. `project` reports `assistant.provider`,
which is "" when none can answer. The editor then hides every AI feature.

Nothing the assistant writes enters the document on its own. Each answer is
a proposal, shown beside its block or in the chat, rendered through the
editor's schema. Accepting applies it as one ordinary transaction, so Yjs
sends it to co-editors and the saver saves it. A proposal remembers its
block's node: edits elsewhere keep that node, while an edit to the block
itself replaces it, which marks the proposal stale instead of overwriting
the change.
