import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { ArrowDown, ArrowUp, Copy, GripVertical, Languages, MessageSquareText, PenLine, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { blockActions, blockMarkdown, languages, promptToWrite, proposeForBlock, setPrompting, tones } from '../assist';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from './ui/dropdown-menu';

type Hovered = { index: number; top: number; left: number };
type Gap = { index: number; top: number; left: number; width: number };

const startOf = (doc: Node, index: number) => { let pos = 0; for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize; return pos; };

/** Moves the top-level block at `from` into the gap before block `gap` (or after the last). */
function moveBlock(editor: Editor, from: number, gap: number) {
  const { doc } = editor.state;
  if (gap === from || gap === from + 1) return;
  const node = doc.child(from), pos = startOf(doc, from);
  const to = startOf(doc, gap) - (gap > from ? node.nodeSize : 0);
  editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize).insert(to, node).scrollIntoView());
}

/** The gap between top-level blocks nearest to a height on screen. */
function gapAt(editor: Editor, y: number): Gap | null {
  const { doc } = editor.state, box = editor.view.dom.getBoundingClientRect();
  let bottom = box.top;
  for (let index = 0; index < doc.childCount; index++) {
    const element = editor.view.nodeDOM(startOf(doc, index)) as HTMLElement | null;
    if (!element?.getBoundingClientRect) continue;
    const block = element.getBoundingClientRect();
    if (y < block.top + block.height / 2) return { index, top: (bottom + block.top) / 2 + window.scrollY, left: box.left + window.scrollX, width: box.width };
    bottom = block.bottom;
  }
  return { index: doc.childCount, top: bottom + 4 + window.scrollY, left: box.left + window.scrollX, width: box.width };
}

/**
 * The handle beside whichever top-level block the pointer is over — a
 * paragraph as much as a table or a theme block. Drag it to move the block
 * between two others; click it for a menu to move, duplicate or delete it,
 * or, with an `assistant`, to have it rewritten.
 */
export function BlockHandle({ editor, assistant }: { editor: Editor; assistant: boolean }) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [menu, setMenu] = useState(false);
  const [gap, setGap] = useState<Gap | null>(null);
  const overHandle = useRef(false);
  // The block being dragged: its index, and the node, to tell if it is still there.
  const dragged = useRef<{ index: number; node: Node } | null>(null);

  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const locate = (event: MouseEvent) => {
      // The block is the editor's direct child the pointer is in.
      let element = event.target as HTMLElement | null;
      while (element && element.parentElement !== dom) element = element.parentElement;
      if (!element) return;
      // Which top-level node that element renders, by ProseMirror's own account.
      const { doc } = editor.state;
      const at = Math.min(Math.max(editor.view.posAtDOM(element, 0), 0), doc.content.size);
      const index = doc.resolve(at).index(0);
      if (index >= doc.childCount) return;
      const box = element.getBoundingClientRect(), editorBox = dom.getBoundingClientRect();
      clearTimeout(hide);
      setHovered({ index, top: box.top + window.scrollY, left: editorBox.left + window.scrollX });
    };
    // Leaving the editor for the handle itself keeps it.
    const leave = () => { hide = setTimeout(() => { if (!overHandle.current && !menu && !dragged.current) setHovered(null); }, 250); };

    // A block dragged by its handle lands between blocks, never inside one:
    // these run before ProseMirror's own drop handling, which they replace.
    const over = (event: DragEvent) => {
      if (!dragged.current) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      setGap(gapAt(editor, event.clientY));
    };
    const drop = (event: DragEvent) => {
      const source = dragged.current;
      if (!source) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const target = gapAt(editor, event.clientY);
      if (target && editor.state.doc.maybeChild(source.index) === source.node) moveBlock(editor, source.index, target.index);
      end();
    };
    const end = () => { dragged.current = null; editor.view.dragging = null; setGap(null); setHovered(null); };

    dom.addEventListener('mousemove', locate);
    dom.addEventListener('mouseleave', leave);
    dom.addEventListener('dragover', over, true);
    dom.addEventListener('drop', drop, true);
    window.addEventListener('dragend', end);
    return () => {
      dom.removeEventListener('mousemove', locate); dom.removeEventListener('mouseleave', leave);
      dom.removeEventListener('dragover', over, true); dom.removeEventListener('drop', drop, true);
      window.removeEventListener('dragend', end);
      clearTimeout(hide);
    };
  }, [editor, menu]);

  const line = gap && <div className="marq-ui mq:pointer-events-none mq:absolute mq:z-20 mq:h-0.5 mq:rounded-full mq:bg-primary" style={{ top: gap.top - 1, left: gap.left, width: gap.width }} />;
  if (!hovered || !editor.isEditable || hovered.index >= editor.state.doc.childCount) return line;
  const { doc } = editor.state;
  const index = hovered.index;
  const node = doc.child(index);
  const pos = startOf(doc, index);

  const move = (by: -1 | 1) => { moveBlock(editor, index, by < 0 ? index - 1 : index + 2); setHovered(null); };
  const duplicate = () => editor.view.dispatch(editor.state.tr.insert(pos + node.nodeSize, node));
  const remove = () => { editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize)); setHovered(null); };
  // An empty paragraph has nothing to rewrite: the assistant writes into it instead.
  const empty = node.type.name === 'paragraph' && node.content.size === 0;
  const rewrite = (label: string, instruction: string) => proposeForBlock(label, 'replace', node, index, current => ({ task: 'rewrite', instruction, markdown: blockMarkdown(current) }));
  const custom = () => setPrompting({ anchor: node, index, placeholder: 'Tell AI what to do with this block…', submit: instruction => rewrite(instruction, instruction) });
  const write = () => { editor.commands.setTextSelection(pos + 1); promptToWrite(editor); };

  const dragStart = (event: React.DragEvent) => {
    const selection = NodeSelection.create(editor.state.doc, pos);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    const element = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (element) event.dataTransfer.setDragImage(element, 0, 0);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.textContent);
    dragged.current = { index, node };
    // Tells ProseMirror the drag is its own, should the drop land where the
    // handle's listeners don't (`node` is read there, though untyped).
    editor.view.dragging = { slice: selection.content(), move: true, node: selection } as typeof editor.view.dragging;
  };

  return (
    <>
      {line}
      <div data-marq-chrome className="marq-ui marq-authoring-only mq:absolute mq:z-20 mq:flex mq:items-center"
        style={{ top: hovered.top, left: hovered.left - 30 }}
        onMouseEnter={() => { overHandle.current = true; }} onMouseLeave={() => { overHandle.current = false; }}>
        <DropdownMenu open={menu} onOpenChange={open => { setMenu(open); if (!open) setHovered(null); }}>
          {/* The menu's trigger only anchors it: a trigger cancels the press,
              and a cancelled press never starts a drag. The grip opens the
              menu on click instead. */}
          <DropdownMenuTrigger asChild>
            <span aria-hidden tabIndex={-1} className="mq:pointer-events-none mq:absolute mq:inset-0" />
          </DropdownMenuTrigger>
          <Button variant="ghost" size="icon-sm" draggable onDragStart={dragStart} onClick={() => setMenu(true)}
            aria-label="Block options" aria-haspopup="menu" aria-expanded={menu} className="mq:size-6 mq:cursor-grab mq:text-muted-foreground">
            <GripVertical />
          </Button>
          <DropdownMenuContent align="start" side="left">
            {assistant && empty && <><DropdownMenuItem onSelect={write}><Sparkles />Write with AI…</DropdownMenuItem><DropdownMenuSeparator /></>}
            {assistant && !empty && <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Sparkles />Ask AI</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {blockActions.map(action => <DropdownMenuItem key={action.id} onSelect={() => rewrite(action.label, action.instruction)}><Wand2 />{action.label}</DropdownMenuItem>)}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><MessageSquareText />Change tone</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {tones.map(tone => <DropdownMenuItem key={tone} onSelect={() => rewrite(`${tone} tone`, `Rewrite it in a ${tone.toLowerCase()} tone.`)}>{tone}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><Languages />Translate</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {languages.map(language => <DropdownMenuItem key={language} onSelect={() => rewrite(`Translate to ${language}`, `Translate it into ${language}, keeping the Markdown formatting.`)}>{language}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={custom}><PenLine />Custom instruction…</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>}
            <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}><ArrowUp />Move up</DropdownMenuItem>
            <DropdownMenuItem disabled={index === doc.childCount - 1} onSelect={() => move(1)}><ArrowDown />Move down</DropdownMenuItem>
            <DropdownMenuItem onSelect={duplicate}><Copy />Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={remove}><Trash2 />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
