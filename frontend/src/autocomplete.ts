import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { ySyncPluginKey } from 'y-prosemirror';
import { assist, blocksBefore } from './assist';
import { registry } from './registry';

/**
 * Suggests how the sentence goes on, as grey text after the caret, once the
 * author pauses at the end of a paragraph. Tab takes it; typing on or Escape
 * drops it. Off until turned on in the assistant panel, since each
 * suggestion is a request to the AI provider.
 */

type Suggestion = { text: string; pos: number } | null;
const key = new PluginKey<Suggestion>('marqAutocomplete');
const pause = 700, minimum = 20, context = 4000;

// Kept outside the editor: the extension list is built once per page.
let enabled = false;
const readSetting = () => { try { return localStorage.getItem('marq-autocomplete') === 'on'; } catch { return false; } };
enabled = readSetting();
export const autocompleteEnabled = () => enabled;
export function setAutocomplete(on: boolean) {
  enabled = on;
  try { localStorage.setItem('marq-autocomplete', on ? 'on' : 'off'); } catch { /* the setting just lasts for this page */ }
}

/** Where a suggestion may go: the caret at the end of a paragraph with enough text before it. */
function spot(state: EditorState) {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if ($from.parent.type.name !== 'paragraph' || $from.parentOffset !== $from.parent.content.size) return null;
  const typed = $from.parent.textContent;
  if (typed.trim().length < minimum) return null;
  const index = $from.index(0);
  const earlier = blocksBefore(state.doc, index);
  return { pos: $from.pos, before: (earlier ? earlier + '\n\n' : '') + typed };
}

const local = (tr: Transaction) => tr.docChanged && !tr.getMeta(ySyncPluginKey)?.isChangeOrigin;

export const Autocomplete = Extension.create({
  name: 'marqAutocomplete',
  addProseMirrorPlugins() {
    const editor = this.editor;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: AbortController | null = null;
    let typed = false;
    const cancel = () => { clearTimeout(timer); pending?.abort(); pending = null; };

    const request = (view: EditorView) => {
      const at = spot(view.state);
      if (!at || !enabled || !editor.isEditable || !registry.project?.assistant?.provider) return;
      const doc = view.state.doc, controller = new AbortController();
      pending = controller;
      assist<{ text: string }>({ task: 'complete', before: at.before.slice(-context), after: '' }, controller.signal)
        .then(({ text }) => {
          // Only while nothing moved since: the suggestion continues this exact text.
          if (controller.signal.aborted || view.state.doc !== doc || view.state.selection.from !== at.pos || !text.trim()) return;
          const spaced = /\s$/.test(at.before) || /^[\s.,;:!?)]/.test(text) ? text : ' ' + text;
          view.dispatch(view.state.tr.setMeta(key, { text: spaced, pos: at.pos }));
        })
        .catch(() => { /* a missed suggestion is not worth a message */ });
    };

    return [new Plugin<Suggestion>({
      key,
      state: {
        init: () => null,
        apply(tr, value) {
          const meta = tr.getMeta(key);
          if (meta !== undefined) return meta;
          if (!value) return null;
          // Anything else that changes the text or moves the caret drops it.
          return tr.docChanged || tr.selectionSet ? null : value;
        },
      },
      props: {
        decorations(state) {
          const suggestion = key.getState(state);
          if (!suggestion) return null;
          const ghost = () => {
            const span = document.createElement('span');
            span.className = 'marq-ghost'; span.textContent = suggestion.text;
            return span;
          };
          return DecorationSet.create(state.doc, [Decoration.widget(suggestion.pos, ghost, { side: 1, key: suggestion.text })]);
        },
        handleKeyDown(view, event) {
          const suggestion = key.getState(view.state);
          if (!suggestion) return false;
          if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(suggestion.text, suggestion.pos).setMeta(key, null));
            return true;
          }
          if (event.key === 'Escape') { view.dispatch(view.state.tr.setMeta(key, null)); return true; }
          return false;
        },
      },
      // Seen before the view updates: whether the author's own edit changed the page.
      appendTransaction(transactions) { typed = transactions.some(local); return null; },
      view: () => ({
        update(view, previous) {
          if (view.state.doc === previous.doc) return;
          cancel();
          // A co-editor's edit never prompts a suggestion here.
          if (typed) timer = setTimeout(() => request(view), pause);
        },
        destroy: cancel,
      }),
    })];
  },
});
