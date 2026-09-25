import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { api } from './api';

export type Token = { from: number; to: number; className: string };

/**
 * The classed spans of highlighted HTML as offsets into its text, or null when
 * that text is not `code` — decorations must never disagree with the document.
 * A nested span's class wins over its parent's.
 */
export function tokens(html: string, code: string): Token[] | null {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild;
  if (!root || root.textContent !== code) return null;
  const found: Token[] = [];
  let at = 0;
  const walk = (node: ChildNode, className: string) => {
    if (node.nodeType === 3) {
      const length = node.textContent?.length ?? 0;
      if (className && length) found.push({ from: at, to: at + length, className });
      at += length;
    } else if (node.nodeType === 1) {
      const own = (node as Element).getAttribute('class') ?? '';
      node.childNodes.forEach(child => walk(child, own || className));
    }
  };
  root.childNodes.forEach(child => walk(child, ''));
  return found;
}

/** A code block the site highlights: a ```kex fence, or a code block set to Kex. */
export function kexCode(node: PMNode): boolean {
  if (node.type.name === 'codeBlock') return node.attrs.language === 'kex';
  if (node.type.name === 'marqCode') return (node.attrs.settings as Record<string, string> | null)?.language === 'kex';
  return false;
}

const key = new PluginKey<DecorationSet>('kexHighlight');

/**
 * Kex code highlighted while it is edited, with the same tokenizer and tok-*
 * classes as published pages: the server highlights each distinct snippet
 * once, and the result is laid over the text as decorations, so the document
 * and what saves stay plain code.
 */
export const KexHighlight = Extension.create({
  name: 'kexHighlight',
  addProseMirrorPlugins() {
    const cache = new Map<string, Token[]>();
    const requested = new Set<string>();

    const missing = (doc: PMNode) => {
      const codes: string[] = [];
      doc.descendants(node => {
        if (!kexCode(node)) return true;
        if (!cache.has(node.textContent)) codes.push(node.textContent);
        return false;
      });
      return codes;
    };
    const build = (doc: PMNode) => {
      const decorations: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (!kexCode(node)) return true;
        for (const token of cache.get(node.textContent) ?? []) {
          decorations.push(Decoration.inline(pos + 1 + token.from, pos + 1 + token.to, { class: token.className }));
        }
        return false;
      });
      return DecorationSet.create(doc, decorations);
    };

    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => build(state.doc),
        // While a snippet waits for its tokens, the previous colours move
        // with the edit instead of flashing off.
        apply: (tr, old) => tr.getMeta(key) || (tr.docChanged && missing(tr.doc).length === 0)
          ? build(tr.doc) : old.map(tr.mapping, tr.doc),
      },
      props: { decorations: state => key.getState(state) },
      view: view => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fetchMissing = () => {
          const codes = missing(view.state.doc).filter(code => !requested.has(code));
          if (codes.length === 0) return;
          codes.forEach(code => requested.add(code));
          void Promise.all(codes.map(code => api<{ html: string }>('highlight', { code })
            .then(({ html }) => { cache.set(code, tokens(html, code) ?? []); })
            .catch(() => { cache.set(code, []); })
            .finally(() => requested.delete(code))))
            .then(() => {
              if (cache.size > 500) [...cache.keys()].slice(0, cache.size - 500).forEach(code => cache.delete(code));
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(key, true));
            });
        };
        fetchMissing();
        return {
          update: (_, previous) => {
            if (previous.doc.eq(view.state.doc)) return;
            clearTimeout(timer);
            timer = setTimeout(fetchMissing, 200);
          },
          destroy: () => clearTimeout(timer),
        };
      },
    })];
  },
});
