# Theme authoring

A theme is a directory with a manifest, Kex templates and CSS. Themes need no
React or JavaScript. The built-in `book` and `basic` themes are complete
examples; `marq eject-theme` copies the site's current one into `themes/`.

```text
marqraft-theme.jsonc      manifest (JSON with comments): page templates, settings, blocks, commands, operations
style.css                 inlined into every page, followed by setting variables
assets/                   files served as /_theme/…, such as favicons and fonts
page.html.ket             one template per page template id
landing.html.ket
blocks/card.html.ket      block templates
starters/page.md          initial body for new pages of that template
```

Themes are usually their own repositories; only `book` and `basic` ship
inside marq. A site selects a theme in `marqraft.jsonc`:

```jsonc
{ "theme": "book" }              // built-in, shipped inside marq
{ "theme": "./themes/mine" }     // a directory inside the project (vendored, or a git submodule)
{ "theme": "/work/theme-krix" }  // a checkout elsewhere (absolute, or ../ relative to the site)
```

Built-in and external themes are copied into `.marqraft/cache/themes/`,
keyed by their content, because templates compile from project files.
Editing an external theme takes effect on the next load, in `marq dev` and
`marq build` alike. External themes must contain only text files; hidden
files and `node_modules` are skipped. `marq new site --theme /work/theme-krix`
creates a site that references one.

Setting *values* are stored in the site's `settings`, so they survive a theme
switch or upgrade. Values the new theme does not declare are rejected on the
next save, so review settings after switching.

## Page templates

Templates are Kex `.ket` files that receive one parameter:

```text
---
params: [context: {String: Any}]
---
<title><%= context["title"].or("") %> · <%= context["siteTitle"].or("") %></title>
<style><%== context["css"].or("") %></style>
```

| key         | value                                                    |
|-------------|----------------------------------------------------------|
| `title`     | page title (text; escape with `<%= %>`)                  |
| `description` | page frontmatter `description`, or empty               |
| `collectionTitle`, `collectionPath`, `collectionId` | the top-level navigation entry holding this page, or empty |
| `isHome`     | true on the home page (the page at `/`) |
| `version`    | the version the page documents: its frontmatter `version`, else its collection's; a generated page's is its mount version directory; empty when none |
| `searchIndex` | the URL of the site's search index (`"search"` in `marqraft.jsonc`), or empty |
| `path`      | page URL path, such as `/guide/intro/`                   |
| `settings`  | map of every declared setting: stored value or default (`context["settings"].try["label"].or("")`) |
| `siteTitle` | site title                                               |
| `css`       | `style.css` plus setting variables (raw)                 |
| `favicon`   | `<link rel="icon">` tags: the site's favicon, or the theme's `favicons` (raw) |
| `assetsUrl` | `/_theme/`, the URL of the theme's `assets/` folder      |
| `logo`      | `<img class="site-logo">` when the logo setting is set (raw) |
| `authoring` | `true` in `marq dev`, `false` in builds                  |
| `mounts`    | the site's mounts: `path`, `dir`, and `versions` (`name` + `path` per immediate subdirectory), for the theme to iterate |
| `page`      | a generated page's own data: what a fragments mount's sidecar puts in `data` (`context["page"].try["version"].or("")`); empty otherwise |

Content regions are bound with elements rather than interpolation, so the
authoring server can attach the editor to exactly that region and builds can
emit plain HTML:

```html
<nav class="site-navigation"><marqraft-content source="navigation"></marqraft-content></nav>
<article class="site-content">
  <marqraft-content source="title"></marqraft-content>
  <marqraft-content source="body"></marqraft-content>
</article>
<marqraft-content source="pager"></marqraft-content>
```

| source       | renders                                                       |
|--------------|---------------------------------------------------------------|
| `title`      | `<h1>` with the page title                                    |
| `body`       | the page content                                              |
| `navigation` | nested `<ul><li><a>` in navigation order; the current page has `aria-current="page"`, drafts carry `<small class="marq-draft">` in dev and are omitted from builds. A template may bind it more than once (a sidebar and a contents list); in dev the first region in document order becomes the editable page tree, with its New page and reordering controls, and later ones stay read-only, so put the sidebar first |
| `menu`       | with `menu="<id>"`: `<ul class="marq-menu">` of the site's links for a menu the theme declares; the current page's link has `aria-current="page"`, links to drafts are omitted from builds |
| `navigation` with `scope="collections"` | the top-level entries only, one link per collection; the collection holding the current page has `aria-current="true"` |
| `navigation` with `scope="collection"` | the pages nested under the current page's collection |
| `pager` with `scope="collection"` | reading order within the current collection, starting at the collection page |
| `pager`      | `<nav class="marq-pager">` with `a.marq-pager-previous` / `a.marq-pager-next` in reading order, or nothing |

### Collections

A site can be organized into collections, such as a Guide and a Tutorial,
without any extra data: every top-level entry in the navigation is a
collection, usually a page with a landing template, and the pages nested
under it are its members. A theme that shows collections in its header and
the current collection in its sidebar binds both scopes:

```html
<nav class="top-nav"><marqraft-content source="navigation" scope="collections"></marqraft-content></nav>
<aside><a href="<%= context["collectionPath"].or("/") %>"><%= context["collectionTitle"].or("") %></a>
  <marqraft-content source="navigation" scope="collection"></marqraft-content></aside>
```

In `marq dev`, the collections region adds new collections, and the
collection region adds pages inside the current collection. Themes without
scopes show the whole tree.

A collection says which version it documents with `version:` in its page's
frontmatter (the Version field in Page settings); its pages inherit it
unless they name their own, and templates read it as `version`, for a
version badge or a title.

The home page, the page at `/`, is not a collection: it is the landing page
the site title links to, and it never appears in the navigation, so no menu,
pager or collection region lists it. Its collection context is empty and
`isHome` is true, so a landing template can leave the sidebar out. A site
whose `.marqraft/navigation.json` still lists it has the entry ignored,
anything nested under it moved into its place, and the file follows on its
next save.

A top-level entry with `"listed": false` in `.marqraft/navigation.json` is
built and linkable but left out of `scope="collections"` and the whole-tree
navigation, except while the reader is inside it. `marq copy-collection
--unlist` sets it on a book's previous edition.

`<marqraft-action operation="create-page" label="New page">` renders a button
in dev and nothing in builds.

A page whose template does not exist in the current theme renders with
`page.html.ket`, so every theme must provide it.

### Search index

With `"search": "/search.json"` in `marqraft.jsonc`, Marqraft serves (in
`marq dev`) and writes (in `marq build`) a search index of the published
authored pages: one entry per page and one per `h2`/`h3` section, as
`{ "entries": [{ "kind": "page" | "section", "name", "qualifiedName",
"summary", "text", "url" }] }`. `qualifiedName` is the page's collection for
a page and the page's title for a section; `url` is the page path, with the
heading's anchor for a section. The shape follows Tey docgen's
`search.json`, so a theme can search the site and a generated reference with
one script. Generated pages are left to their producer's own index. The
path must be a file path that no page, upload or mount uses.

### Generated mounts

A site serves read-only generated directories — API references written by an
external generator, for example — through mounts declared in
`marqraft.jsonc`:

```jsonc
{ "mounts": [
  { "path": "/prelude/", "dir": "reference/prelude" },
  { "path": "/search.json", "file": "reference/search.json" }
] }
```

`dir` mounts a directory inside the project under a URL prefix; `file`
mounts one generated file at an exact URL (a search index, `versions.json`).
Either way the output serves in both `marq dev` and `dist/`, is never
editable, and carries no authoring bindings. Collisions with pages or uploads
are errors, and `content/`, `public/`, `.marqraft/`, and the theme directory
cannot be mounted. Hidden files are skipped.

Each mount's immediate subdirectories are exposed as `versions` (`name` and
`path` per directory, sorted), so the theme can render a version selector
from `context["mounts"]`. Version truth lives with the generator's output —
a new release appears by generating it, with no site edit.

### Rendered mounts

With `"pages": true` (plus an optional `title` and `template`, defaulting to
the directory name and `"page"`), a mount's Markdown files render through the
site's templates instead of serving raw:

```jsonc
{ "path": "/prelude/", "dir": "reference/prelude", "pages": true, "title": "Prelude" }
```

Identity, title, and URL derive from each file: the URL mirrors the relative
path, the title is a leading `# ` heading (removed from the body), and
frontmatter-style header lines are dropped unread. `.md`-relative links
between generated files are rewritten to page URLs; anything unresolvable
stays verbatim. Every version and the mount root get a synthetic index page
listing their members, unless a real `index.md` already claims that URL.

A producer that renders its own pages — linked, highlighted API signatures
that Markdown cannot carry — mounts them with `"format": "fragments"`:

```jsonc
{ "path": "/prelude/", "dir": "reference/prelude", "pages": true, "format": "fragments", "template": "reference" }
```

Each page is an HTML body plus a `<page>.page.json` sidecar beside it:

```json
{ "title": "List", "description": "Ordered sequences.", "path": "/prelude/0.4/list/",
  "template": "reference", "body": "list.html", "data": { "version": "0.4" } }
```

The body is used as-is; `path` must lie inside the mount; `template`
overrides the mount's; `data` reaches the template as `context["page"]`. A
sidecar at a version's own URL replaces the synthetic version index, and a
`nav.json` in the version directory (`{ "title", "path", "children" }`)
shapes that version's navigation instead of a flat list. Sidecars, bodies
and `nav.json` are not served; the mount's other files (Markdown twins,
JSON indexes) are. Tey's `tey docs build --format fragments` writes this
layout.

Generated pages publish and render like any other, but nothing may edit
them: `save`, draft changes, nesting under them, and the document API all
refuse with a read-only error, they render without editing bindings in
`marq dev`, and the authoring sidebar only ever shows the file tree. Their
`.md` sources (and any `index.html` shadowed by a synthetic index) are
neither served nor published.

### Editable-region contract

In dev, the editor adds structure inside the bound regions: a sticky toolbar
before the title, a `.ProseMirror` wrapper inside the body, and hover controls
inside navigation rows. All authoring chrome carries `.marq-ui` and is styled
with prefixed, `!important` utilities, so theme CSS cannot break it and it
cannot restyle the theme. To keep the edited page identical to the published
one, style content with descendant selectors on the region
(`.site-content h2`, `.site-navigation a`) rather than child selectors
(`.site-content > h2`) that the editor wrapper would break.

## Menus

A theme declares named menus, such as header links, and where they render:

```json
"menus": [{ "id": "header", "label": "Header", "default": [{ "label": "Guide", "path": "/" }, { "label": "kex.run", "url": "https://kex.run" }] }]
```

```html
<nav class="top-nav"><marqraft-content source="menu" menu="header"></marqraft-content></nav>
```

Until a site saves its own links, the defaults apply; a default `path` links
to the page at that path when it exists. Authors edit the menu in place in
`marq dev`, and the site stores it in `.marqraft/menus.json`: each item is
`{ "label", "page": <page id> }` or `{ "label", "url" }`, where URLs are
http(s), mailto or site paths.

## Assets, favicons and uploads

Files in the theme's `assets/` folder, text or binary, are served at
`/_theme/…` in `marq dev` and copied to `dist/_theme/` by `marq build`. The
manifest names the icons and the folder, inside `public/`, where uploaded
images go:

```json
"favicons": [{ "file": "icon.png", "type": "image/png", "sizes": "32x32" }],
"uploads": { "images": "assets/images" }
```

Put `<%== context["favicon"].or("") %>` in the `<head>`. Both are defaults a
site can override in `marqraft.jsonc`; the favicon can also be picked in the
Theme panel:

```jsonc
{ "favicon": "/assets/images/icon.png", "uploads": { "images": "media" } }
```

Upload folders must be inside `public/` and cannot use the reserved
`_theme` or `__marqraft` names. Image settings, such as a logo, accept any
path within the site.

## Settings

```json
{ "name": "accent", "label": "Accent color", "type": "color", "default": "#b52a35" }
{ "name": "contentWidth", "label": "Content width", "type": "number", "unit": "px", "min": 480, "max": 1400, "default": "760" }
```

Types: `text`, `multiline`, `toggle` (`"true"`/`"false"`), `number` (`min`,
`max`, `unit`: `px`, `rem`, `em`, `%` or empty), `enum` (`options`), `color`
(`#rgb` or `#rrggbb`) and `image` (a path within the site; the control uploads
into the site's upload folder).
Values are strings and are validated on the server.

Color and number settings become CSS custom properties named
`--marq-<name>`, so the theme uses `var(--marq-accent, #b52a35)`. The Theme
panel previews them live by updating the same properties.

## Callouts

Callouts need no block: they are GitHub alerts, plain Markdown that also
renders on GitHub.

```markdown
> [!WARNING]
> Back up **before** upgrading.
```

The kinds are `NOTE`, `TIP`, `IMPORTANT`, `WARNING` and `CAUTION`. Marqraft
renders GitHub's markup, so style these classes:

```html
<div class="markdown-alert markdown-alert-warning">
  <p class="markdown-alert-title">Warning</p>
  <div class="markdown-alert-body"><p>Back up <strong>before</strong> upgrading.</p></div>
</div>
```

`/callout` inserts one, and its settings choose the kind.

## Blocks

Blocks are custom HTML elements embedded in Markdown. Settings are
attributes:

```html
<marqraft-card title="Install">
Markdown **body**.
</marqraft-card>
```

```json
{
  "id": "card", "element": "marqraft-card", "label": "Card",
  "body": "markdown", "template": "blocks/card.html.ket",
  "settings": [{ "name": "title", "label": "Card title", "type": "text", "default": "" }]
}
```

`body` is one of:

- `none`: no content. The element must be empty.
- `literal`: text shown as written, such as code. Entities are decoded for
  display and re-escaped on save.
- `markdown`: Markdown and nested blocks.
- `areas`: repeatable `<marqraft-area id="…" label="…">` children, each with
  a stable id and a Markdown body.

A block template receives `context["settings"]` (a map of attribute values)
and `context["body"]` (rendered HTML), and must render exactly one root
element. Unless `body` is `none`, it marks where the content goes with
`data-marq-slot`:

```text
<section class="card">
  <h4><%= context["settings"].try["title"].or("") %></h4>
  <div data-marq-slot><%== context["body"].or("") %></div>
</section>
```

In the editor, the slot becomes the editable region and the rest of the
template is chrome. When settings change, the server re-renders the template
and only the chrome is replaced, so the cursor and undo history inside the
slot survive. Settings must therefore not add, remove or move the slot.
Builds strip `data-marq-slot`.

`code` and `tabs` without a `template` use Marqraft's built-in rendering
(`figure.marq-code`, `div.marq-tabs > section.marq-area`); style those
classes.

Unknown elements, and blocks whose markup does not parse, stay in the file
unchanged and appear in the editor as editable source.

## Slash commands

```json
{ "id": "card", "label": "Card", "aliases": ["box"], "icon": "blocks", "kind": "insert", "block": "card" }
```

Theme commands join the built-in ones (`paragraph`, `heading`, `subheading`,
`list`, `numbered`, `quote`, `callout`, `code`, `image`, `table`, `divider`,
`source`).
Replacing a built-in requires `"override": true`; ids must be unique. Icons:
`text`, `heading2`, `heading3`, `list`, `listOrdered`, `quote`, `code`, `image`,
`table`, `minus`, `braces`, `tabs`, `callout`, `blocks`.

## Operations

Operations are declarative and validated by the server; themes cannot run
code or write arbitrary files.

| kind               | input                                      | effect |
|--------------------|--------------------------------------------|--------|
| `createPage`       | `title`, `path`, `template`, `parent`      | writes `content<path>index.md` from a starter, adds it to navigation |
| `uploadAsset`      | `name`, `base64`                           | stores an image under a collision-safe name in `public/images/` |
| `updateSettings`   | `revision`, `settings`                     | validates against the schema, writes `marqraft.jsonc` |
| `updateMenus`      | `revision`, `menus`                        | validates menu ids, labels, page ids and URLs, writes `.marqraft/menus.json` |
| `updateNavigation` | `revision`, `navigation`                   | validates ids and nesting, writes `.marqraft/navigation.json` |

## Starters

A new page's body comes from `.marqraft/templates/<template>.md` in the site
if present, otherwise from the theme's `starters/<template>.md`, otherwise
empty.
