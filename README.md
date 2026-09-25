# Marqraft

Marqraft is a local CMS and static site generator written in Kex. You author
the site in its own theme: click text to edit it, create pages from the
navigation, and adjust theme settings with a live preview. Content, uploads
and configuration are ordinary files, versioned with your usual Git tools.

The executable is `marq`.

## Build

Requirements: Tey with the Kex `0.4.0-beta.2` toolchain, Erlang/OTP 27 or newer, and Node.js 22.

```sh
. scripts/env.sh     # select the pinned Kex toolchain (TEY_KEX, KEX_ERL)
npm ci               # frontend dependencies
npm run build        # bundle the authoring UI into assets/
tey install
tey build            # compile ebin/marq, embedding assets/ and themes/
```

Rebuild the frontend before `tey build` whenever `frontend/` changes; the
bundle is embedded into the executable.

## Use

```sh
marq new my-book            # scaffold a site using the built-in "book" theme
marq new my-site --theme basic
marq new kex-guide --theme ../theme-krix  # a theme from its own repository
marq dev my-book            # author at http://localhost:4173 (loopback only)
marq build my-book          # write static output to my-book/dist/
marq eject-theme my-book    # copy the theme into my-book/themes/ to customize it
marq copy-collection /guide/v1/ /guide/v2/ my-book --title "Guide 2" --unlist
                            # cut a book's next edition; --unlist hides the old one
```

Run `marq` through `escript` if your shell does not find the right Erlang:
`/opt/homebrew/opt/erlang/bin/escript ebin/marq --help`.

## A site

```text
marqraft.jsonc            title, theme selection, theme setting values
content/**/index.md       one page per file: frontmatter + Markdown + custom blocks
public/                   static files and uploads (images/ by default), copied to dist/
.marqraft/navigation.json collections, page order and nesting, by page id (not the home page at /)
.marqraft/templates/*.md  optional starter bodies that override the theme's
.marqraft/cache/          ignored: compiled templates, materialized themes, builds
themes/<name>/            only after eject-theme, or for a hand-written theme
dist/                     ignored: build output
```

A site references its theme rather than copying it: a built-in name
(`"theme": "book"`), a directory in the project, or a path to a theme kept in
its own repository (for example `"theme": "/work/theme-krix"`), so the theme can be switched or upgraded without touching content. Theme
setting values live in the site; the theme only declares them. See
[docs/theme-authoring.md](docs/theme-authoring.md).

## Authoring

- The page tree renders inside the theme's own navigation. Drag pages to
  reorder or nest them, or use a page's menu; **New page** sits directly under
  the list and creates the page inline. New pages start as drafts.
- Menus a theme declares, such as header links, are edited where they render:
  hover a link to change or move it, or use **+** to add one.
- A formatting toolbar docks above the content. Type `/` for the block menu
  (headings, lists, tables, images, and the theme's blocks).
- Blocks show their settings and delete controls on hover; settings are
  generated from the theme's schema.
- **Page** holds the title, URL path, template and draft state. Titles and
  navigation moves never change URLs. **Preview** hides all authoring chrome.
- Edits autosave. A write based on a stale revision is rejected; if the file
  changed on disk while you were editing, autosave pauses and both versions
  are shown side by side.

## Test

```sh
. scripts/env.sh
tey test                        # Kex specs
npm test                        # frontend unit tests
npm run typecheck
npm run gate                    # end-to-end authoring gate (Chromium)
```

## Project layout

```text
src/main.kex              CLI
src/marqraft/             project model, content format, themes, API, server, build
themes/book, themes/basic built-in themes, embedded into marq
frontend/src/             React + Tiptap authoring UI (shadcn/ui components)
vendor/rodolfo/           HTTP framework snapshot
docs/                     theme authoring guide and engineering decisions
```
