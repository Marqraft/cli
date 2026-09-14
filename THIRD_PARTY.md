# Third-party sources

`src/marqraft/markdown.kex` adapts the Markdown parser from
`kexhq/kex`, `tey/src/tey/docgen/md.kex`, distributed under the MIT license.
The parser is a documented Markdown subset, not a CommonMark implementation.
`src/marqraft/highlight.kex` adapts the Kex highlighter from the same
directory (`highlight.kex`), MIT.

`frontend/src/components/ui/` follows shadcn/ui component source (MIT),
adapted to a prefixed Tailwind build.

Rodolfo, React, Tiptap, Tailwind CSS, Radix UI, lucide-react,
class-variance-authority, tailwind-merge, clsx and their dependencies retain
their upstream licenses. The bundled `assets/editor.js` includes React, Tiptap,
Radix UI and lucide-react.
