import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Bold, ChevronDown, Code, Heading2, Heading3, Heading4, Image, Italic, Link2, List, ListOrdered, Minus,
  Pilcrow, Plus, Quote, Redo2, Strikethrough, Table, Undo2, Unlink,
} from 'lucide-react';
import type { SlashItem } from '../commands';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Tooltip } from './ui/tooltip';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { CommandIcon } from './CommandIcon';

function Tool({ label, shortcut, active, disabled, onClick, children }: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Tooltip label={shortcut ? `${label}  ${shortcut}` : label}>
    <Button variant="ghost" size="icon-sm" aria-label={label} aria-pressed={active} data-active={active} disabled={disabled} onClick={onClick}>{children}</Button>
  </Tooltip>;
}

const blockTypes = [
  { id: 'paragraph', label: 'Text', icon: Pilcrow },
  { id: 'h2', label: 'Heading', icon: Heading2 },
  { id: 'h3', label: 'Subheading', icon: Heading3 },
  { id: 'h4', label: 'Small heading', icon: Heading4 },
] as const;

/** The persistent formatting toolbar, docked above the page content in the theme's own column. */
export function EditorToolbar({ editor, commands, pickImage }: { editor: Editor; commands: SlashItem[]; pickImage: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'), code: e.isActive('code'), link: e.isActive('link'),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }), h4: e.isActive('heading', { level: 4 }),
      canUndo: e.can().undo(), canRedo: e.can().redo(), href: String(e.getAttributes('link').href ?? ''),
      inCode: e.isActive('codeBlock') || e.isActive('marqCode'),
    }),
  });
  const [href, setHref] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const chain = () => editor.chain().focus();
  const current = blockTypes.find(type => type.id !== 'paragraph' && state[type.id]) ?? blockTypes[0];
  const setBlock = (id: string) => {
    if (id === 'paragraph') chain().setParagraph().run();
    else chain().setHeading({ level: Number(id.slice(1)) as 2 | 3 | 4 }).run();
  };
  const theme = commands.filter(item => item.group === 'Theme');
  return (
    <div role="toolbar" aria-label="Formatting" data-marq-chrome
      className="marq-ui marq-authoring-only mq:sticky mq:top-[var(--marq-toolbar-top,56px)] mq:z-[2147481000] mq:mb-8 mq:flex mq:flex-wrap mq:items-center mq:gap-0.5 mq:rounded-lg mq:border mq:border-border mq:bg-background/95 mq:p-1 mq:shadow-sm mq:backdrop-blur"
      onMouseDown={event => { if ((event.target as HTMLElement).closest('button')) event.preventDefault(); }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="mq:w-32 mq:justify-between" aria-label="Block type" disabled={state.inCode}>
            <span className="mq:flex mq:items-center mq:gap-1.5"><current.icon />{current.label}</span><ChevronDown className="mq:opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={event => { event.preventDefault(); editor.commands.focus(); }}>
          {blockTypes.map(type => <DropdownMenuItem key={type.id} onSelect={() => setBlock(type.id)}><type.icon />{type.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" />
      <Tool label="Bold" shortcut="⌘B" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold /></Tool>
      <Tool label="Italic" shortcut="⌘I" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic /></Tool>
      <Tool label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough /></Tool>
      <Tool label="Inline code" shortcut="⌘E" active={state.code} onClick={() => chain().toggleCode().run()}><Code /></Tool>
      <Popover open={linkOpen} onOpenChange={open => { setLinkOpen(open); if (open) setHref(state.href); }}>
        <Tooltip label="Link"><PopoverTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Link" data-active={state.link}><Link2 /></Button></PopoverTrigger></Tooltip>
        <PopoverContent align="start" className="mq:w-80 mq:p-2">
          <form className="mq:flex mq:gap-2" onSubmit={event => { event.preventDefault(); if (href) chain().extendMarkRange('link').setLink({ href }).run(); else chain().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>
            <Input autoFocus aria-label="Link URL" placeholder="https:// or /path/" value={href} onChange={event => setHref(event.target.value)} />
            <Button type="submit" size="sm">Apply</Button>
            {state.link && <Button variant="ghost" size="icon-sm" aria-label="Remove link" onClick={() => { chain().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}><Unlink /></Button>}
          </form>
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" />
      <Tool label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}><List /></Tool>
      <Tool label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered /></Tool>
      <Tool label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}><Quote /></Tool>
      <Separator orientation="vertical" />
      <Tool label="Image" onClick={pickImage}><Image /></Tool>
      <Tool label="Table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table /></Tool>
      <Tool label="Divider" onClick={() => chain().setHorizontalRule().run()}><Minus /></Tool>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label="Insert block"><Plus />Insert<ChevronDown className="mq:opacity-50" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={event => event.preventDefault()}>
          {theme.length > 0 && <><DropdownMenuLabel>Theme blocks</DropdownMenuLabel>{theme.map(item => <DropdownMenuItem key={item.id} onSelect={() => item.run(editor)}><CommandIcon name={item.icon} />{item.label}</DropdownMenuItem>)}<DropdownMenuSeparator /></>}
          {commands.filter(item => item.group === 'Insert').map(item => <DropdownMenuItem key={item.id} onSelect={() => item.run(editor)}><CommandIcon name={item.icon} />{item.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="mq:ml-auto mq:flex mq:items-center mq:gap-0.5">
        <Tool label="Undo" shortcut="⌘Z" disabled={!state.canUndo} onClick={() => chain().undo().run()}><Undo2 /></Tool>
        <Tool label="Redo" shortcut="⇧⌘Z" disabled={!state.canRedo} onClick={() => chain().redo().run()}><Redo2 /></Tool>
      </span>
    </div>
  );
}
