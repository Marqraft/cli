import { useCallback, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { filterCommands, type SlashItem } from './commands';
import type { SlashState } from './components/SlashMenu';

/**
 * The block menu a "/" opens while typing. Its callbacks are stable and read
 * the latest state through refs, because the editor keeps the handlers it was
 * created with.
 */
export function useSlashMenu(commands: SlashItem[], editorRef: RefObject<Editor | null>) {
  const [slash, setSlash] = useState<SlashState | null>(null);
  const slashRef = useRef(slash); slashRef.current = slash;
  const matches = slash ? filterCommands(commands, slash.query) : [];
  const matchesRef = useRef(matches); matchesRef.current = matches;

  const close = useCallback(() => { if (slashRef.current) setSlash(null); }, []);

  // Opens, follows or closes the menu as the caret moves through "/query".
  const update = useCallback((editor: Editor) => {
    const { $from, empty } = editor.state.selection;
    if (!empty || !editor.isEditable || $from.parent.type.spec.code) { close(); return; }
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const found = /(?:^|\s)\/([\w-]{0,24})$/.exec(before);
    if (!found) { close(); return; }
    const from = $from.pos - found[1].length - 1;
    const coords = editor.view.coordsAtPos(from);
    setSlash(previous => ({ from, to: $from.pos, query: found[1], left: coords.left, top: coords.top, index: previous && previous.from === from ? Math.min(previous.index, 50) : 0 }));
  }, [close]);

  const choose = useCallback((item: SlashItem) => {
    const editor = editorRef.current, current = slashRef.current;
    if (!editor || !current) return;
    // A plain delete of the typed "/query": deleteRange would also remove the paragraph
    // once it is empty, moving the cursor, and the command, into the next block.
    editor.chain().focus().command(({ tr }) => { tr.delete(current.from, current.to); return true; }).run();
    setSlash(null);
    item.run(editor);
  }, [editorRef]);

  /** Arrow keys, Enter and Escape while the menu is open; false lets the editor handle the key. */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const current = slashRef.current, items = matchesRef.current;
    if (!current) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSlash({ ...current, index: (current.index + step + Math.max(items.length, 1)) % Math.max(items.length, 1) });
      return true;
    }
    if (event.key === 'Enter' && items[current.index]) { choose(items[current.index]); return true; }
    if (event.key === 'Escape') { setSlash(null); return true; }
    return false;
  }, [choose]);

  const hover = useCallback((index: number) => setSlash(current => current && { ...current, index }), []);

  return { slash, matches, update, choose, close, handleKeyDown, hover };
}
