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

/**
 * The language a code block is highlighted as: a fence's info string, or a
 * Code block's language setting. Null for plain text, which is left as it is.
 */
export function codeLanguage(node: PMNode): string | null {
  const language = node.type.name === 'codeBlock' ? node.attrs.language as string | null
    : node.type.name === 'marqCode' ? (node.attrs.settings as Record<string, string> | null)?.language : null;
  return language && language !== 'text' ? language : null;
}

// The language and code a snippet is highlighted and cached by.
const snippet = (node: PMNode) => { const language = codeLanguage(node); return language === null ? null : `${language}\n${node.textContent}`; };

const key = new PluginKey<DecorationSet>('codeHighlight');

/**
 * Code highlighted while it is edited, with the same tokenizers and tok-*
 * classes as published pages: the server highlights each distinct snippet
 * once, and the result is laid over the text as decorations, so the document
 * and what saves stay plain code.
 */
export const CodeHighlight = Extension.create({
  name: 'codeHighlight',
  addProseMirrorPlugins() {
    const cache = new Map<string, Token[]>();
    const requested = new Set<string>();

    const missing = (doc: PMNode) => {
      const snippets: string[] = [];
      doc.descendants(node => {
        const key = snippet(node);
        if (key === null) return !['codeBlock', 'marqCode'].includes(node.type.name);
        if (!cache.has(key)) snippets.push(key);
        return false;
      });
      return snippets;
    };
    const build = (doc: PMNode) => {
      const decorations: Decoration[] = [];
      doc.descendants((node, pos) => {
        const key = snippet(node);
        if (key === null) return !['codeBlock', 'marqCode'].includes(node.type.name);
        for (const token of cache.get(key) ?? []) {
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
          const snippets = missing(view.state.doc).filter(key => !requested.has(key));
          if (snippets.length === 0) return;
          snippets.forEach(key => requested.add(key));
          void Promise.all(snippets.map(key => {
            const at = key.indexOf('\n'), language = key.slice(0, at), code = key.slice(at + 1);
            return api<{ html: string }>('highlight', { code, language })
              .then(({ html }) => { cache.set(key, tokens(html, code) ?? []); })
              .catch(() => { cache.set(key, []); })
              .finally(() => requested.delete(key));
          }))
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
