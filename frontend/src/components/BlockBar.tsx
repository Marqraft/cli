import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Field } from '../types';
import { Fields } from './Fields';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip } from './ui/tooltip';

type Props = {
  editor: Editor; getPos: () => number | undefined; label: string; fields: Field[];
  settings: Record<string, string>; children?: React.ReactNode;
};

/** Hover chrome for a block: its name, generated settings, delete. It is moved with the BlockHandle every block has. Hidden in preview and output. */
export function BlockBar({ editor, getPos, label, fields, settings, children }: Props) {
  const [open, setOpen] = useState(false);
  const update = (key: string, value: string) => {
    const pos = getPos(); if (pos === undefined) return;
    const node = editor.state.doc.nodeAt(pos); if (!node) return;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, settings: { ...node.attrs.settings, [key]: value } }));
  };
  const remove = () => { const pos = getPos(); if (pos === undefined) return; const node = editor.state.doc.nodeAt(pos); if (node) editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run(); };
  return (
    <div contentEditable={false} data-marq-chrome className="marq-ui marq-block-bar marq-authoring-only mq:absolute mq:-top-3.5 mq:right-2 mq:z-20 mq:flex mq:items-center mq:gap-0.5 mq:rounded-md mq:border mq:border-border mq:bg-background mq:p-0.5 mq:shadow-sm" data-open={open}>
      <span className="mq:px-1 mq:text-xs mq:font-medium mq:text-muted-foreground">{label}</span>
      {children}
      {fields.length > 0 && <Popover open={open} onOpenChange={setOpen}>
        <Tooltip label="Settings"><PopoverTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`${label} settings`}><SlidersHorizontal /></Button></PopoverTrigger></Tooltip>
        <PopoverContent align="end" className="mq:w-72" onOpenAutoFocus={event => event.preventDefault()}>
          <div className="mq:mb-3 mq:text-sm mq:font-semibold">{label} settings</div>
          <Fields fields={fields} value={settings} change={update} />
        </PopoverContent>
      </Popover>}
      <Tooltip label="Delete"><Button variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} onClick={remove}><Trash2 /></Button></Tooltip>
    </div>
  );
}
