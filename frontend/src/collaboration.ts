import { Extension } from '@tiptap/core';
import { redo, undo, yCursorPlugin, ySyncPlugin, yUndoPlugin, yUndoPluginKey } from 'y-prosemirror';
import type { EditorState } from '@tiptap/pm/state';
import type { PageSession } from './collab';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    coEditing: {
      /** Undoes this editor's own last change; other editors' changes stay. */
      undo: () => ReturnType;
      redo: () => ReturnType;
    };
  }
}

type Options = { session: PageSession | null };

/**
 * Binds the editor to a page's shared document, on upstream y-prosemirror:
 * the body syncs with every other editor on the page, their carets and
 * selections show named and coloured by their number on the page, and undo
 * covers only this editor's own changes.
 *
 * Not TipTap's Collaboration extensions: their @tiptap/y-tiptap fork
 * re-resolves the caret by content whenever another editor changed the same
 * paragraph, and put it one character back for each character they typed,
 * so concurrent typing in one paragraph came out reversed.
 */
export const CoEditing = Extension.create<Options>({
  name: 'coEditing',
  addOptions: () => ({ session: null }),

  addProseMirrorPlugins() {
    const { session } = this.options;
    if (!session) return [];
    return [
      ySyncPlugin(session.doc.getXmlFragment('body')),
      yCursorPlugin(session.awareness, { cursorBuilder: caret, selectionBuilder: highlight }),
      yUndoPlugin(),
    ];
  },

  // Yjs applies an undo to the document itself; TipTap must not dispatch its
  // own (by then stale) transaction on top of it.
  addCommands: () => ({
    undo: () => ({ tr, state, dispatch }) => {
      tr.setMeta('preventDispatch', true);
      if (stack(state, 'undoStack') === 0) return false;
      return dispatch ? undo(state) : true;
    },
    redo: () => ({ tr, state, dispatch }) => {
      tr.setMeta('preventDispatch', true);
      if (stack(state, 'redoStack') === 0) return false;
      return dispatch ? redo(state) : true;
    },
  }),

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Shift-Mod-z': () => this.editor.commands.redo(),
      'Mod-y': () => this.editor.commands.redo(),
    };
  },
});

const stack = (state: EditorState, which: 'undoStack' | 'redoStack') => yUndoPluginKey.getState(state)?.undoManager?.[which].length ?? 0;

// Another editor's caret: a coloured bar with their name above it.
function caret(user: { name?: string; color?: string }) {
  const bar = document.createElement('span');
  bar.className = 'collaboration-carets__caret';
  bar.style.borderColor = user.color ?? '#888';
  const label = document.createElement('div');
  label.className = 'collaboration-carets__label';
  label.style.backgroundColor = user.color ?? '#888';
  label.textContent = user.name ?? '';
  // Word joiners keep the caret from splitting the line it sits in.
  bar.append(document.createTextNode('⁠'), label, document.createTextNode('⁠'));
  return bar;
}

function highlight(user: { color?: string }) {
  return { class: 'collaboration-carets__selection', style: `background-color: ${user.color ?? '#888'}33` };
}
