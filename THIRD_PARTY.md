# Third-party sources

Markdown parsing and rendering (`Markdown`, `Markdown.Inline`,
`Markdown.Highlight`) come from the separate `markdown` package (`tey`
dependency, `github.com/kexhq/markdown`), which carries its own
THIRD_PARTY.md for the `kexhq/kex` sources it adapts.

`frontend/src/components/ui/` follows shadcn/ui component source (MIT),
adapted to a prefixed Tailwind build.

Rodolfo, React, Tiptap, Tailwind CSS, Radix UI, lucide-react,
class-variance-authority, tailwind-merge, clsx and their dependencies retain
their upstream licenses. The bundled `assets/editor.js` includes React, Tiptap,
Radix UI and lucide-react.
