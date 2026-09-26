import React from 'react';
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { ArrowDown, ArrowUp, BetweenHorizontalStart, BetweenVerticalStart, Columns3, PanelTop, Plus, Rows3, TableProperties, X } from 'lucide-react';
import { Table } from '@tiptap/extension-table';
import type { Editor } from '@tiptap/core';
import { BlockBar } from './components/BlockBar';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Tooltip } from './components/ui/tooltip';
import { blockDefinition } from './registry';

const settings = (element: HTMLElement, name: string) => {
  try { return JSON.parse(element.getAttribute(name) ?? '{}'); } catch { return {}; }
};

export const SourceSlices = Extension.create({
  name: 'sourceSlices',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'codeBlock', 'horizontalRule', 'table', 'image', 'marqCode', 'marqTabs', 'sourceBlock', 'marqAlert'],
    attributes: {
      original: { default: null, parseHTML: element => element.getAttribute('data-marq-original'), renderHTML: () => ({}) },
      baseline: { default: null, renderHTML: () => ({}) },
    },
  }],
});

const newArea = (label: string) => ({ type: 'marqArea', attrs: { settings: { id: crypto.randomUUID(), label } }, content: [{ type: 'paragraph' }] });

function CodeView(props: NodeViewProps) {
  const data = props.node.attrs.settings as Record<string, string>;
  const fields = blockDefinition('code')?.settings ?? [];
  return <NodeViewWrapper as="figure" className="marq-code marq-block" data-testid="code-block">
    <BlockBar editor={props.editor} getPos={props.getPos} label="Code" fields={fields} settings={data} />
    <figcaption contentEditable={false}>{data.filename || data.language || 'Code'}</figcaption>
    <pre><NodeViewContent as={'code' as 'div'} /></pre>
    {data.caption && <small contentEditable={false}>{data.caption}</small>}
  </NodeViewWrapper>;
}

function TabsView(props: NodeViewProps) {
  const add = () => {
    const pos = props.getPos(); if (pos === undefined) return;
    props.editor.commands.insertContentAt(pos + props.node.nodeSize - 1, newArea(`Tab ${props.node.childCount + 1}`));
  };
  return <NodeViewWrapper className="marq-tabs marq-block">
    <BlockBar editor={props.editor} getPos={props.getPos} label="Tabs" fields={blockDefinition('tabs')?.settings ?? []} settings={props.node.attrs.settings}>
      <Button variant="ghost" size="sm" onClick={add}><Plus />Add tab</Button>
    </BlockBar>
    <NodeViewContent />
  </NodeViewWrapper>;
}

export function AreaView(props: NodeViewProps) {
  const move = (direction: number) => {
    const pos = props.getPos(); if (pos === undefined) return;
    const $pos = props.editor.state.doc.resolve(pos), parent = $pos.parent;
    const index = $pos.index(), target = index + direction;
    if (target < 0 || target >= parent.childCount) return;
    const other = parent.child(target), tr = props.editor.state.tr;
    const destination = direction < 0 ? pos - other.nodeSize : pos + other.nodeSize;
    tr.delete(pos, pos + props.node.nodeSize).insert(destination, props.node);
    props.editor.view.dispatch(tr.scrollIntoView());
  };
  const label = props.node.attrs.settings.label ?? '';
  return <NodeViewWrapper as="section" className="marq-area">
    <div contentEditable={false} className="marq-ui mq:flex mq:items-center mq:gap-1 mq:pt-2">
      <input aria-label="Tab label" value={label} placeholder="Label"
        className="mq:min-w-0 mq:flex-1 mq:rounded-sm mq:bg-transparent mq:px-1 mq:py-0.5 mq:text-xs mq:font-semibold mq:uppercase mq:tracking-wider mq:text-muted-foreground mq:outline-none mq:hover:bg-accent mq:focus:bg-accent"
        onChange={event => props.updateAttributes({ settings: { ...props.node.attrs.settings, label: event.target.value } })} />
      <span className="marq-authoring-only mq:flex mq:gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={() => move(-1)} aria-label="Move tab up"><ArrowUp /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => move(1)} aria-label="Move tab down"><ArrowDown /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => props.deleteNode()} aria-label="Delete tab"><X /></Button>
      </span>
    </div>
    <NodeViewContent className="marq-area-body" />
  </NodeViewWrapper>;
}

export const alertKinds = ['note', 'tip', 'important', 'warning', 'caution'] as const;
const alertFields = [{ name: 'kind', label: 'Kind', type: 'enum', default: 'note', options: [...alertKinds] }];
const alertKind = (element: HTMLElement) => alertKinds.find(kind => element.classList.contains(`markdown-alert-${kind}`)) ?? 'note';

/** A GitHub alert (> [!NOTE]): Markdown in the file, a styled callout on the page. */
function AlertView(props: NodeViewProps) {
  const kind = alertKinds.includes(props.node.attrs.settings?.kind) ? props.node.attrs.settings.kind : 'note';
  return <NodeViewWrapper className={`markdown-alert markdown-alert-${kind} marq-block`}>
    <BlockBar editor={props.editor} getPos={props.getPos} label="Callout" fields={alertFields} settings={{ kind }} />
    <p className="markdown-alert-title" contentEditable={false}>{kind[0].toUpperCase() + kind.slice(1)}</p>
    <NodeViewContent className="markdown-alert-body" />
  </NodeViewWrapper>;
}

function SourceView(props: NodeViewProps) {
  return <NodeViewWrapper className="marq-block marq-ui mq:my-4 mq:rounded-lg mq:border mq:border-dashed mq:border-amber-400 mq:bg-amber-50 mq:p-3" contentEditable={false}>
    <div className="mq:mb-2 mq:flex mq:items-center mq:gap-2"><Badge variant="warning">Source</Badge><span className="mq:text-xs mq:text-muted-foreground">Kept exactly as written. Edit the markup directly.</span></div>
    <textarea aria-label="Source block" value={props.node.attrs.source} spellCheck={false}
      className="mq:block mq:min-h-24 mq:w-full mq:resize-y mq:bg-transparent mq:font-mono mq:text-xs mq:leading-5 mq:text-foreground mq:outline-none"
      onChange={event => props.updateAttributes({ source: event.target.value })} />
  </NodeViewWrapper>;
}

// A table as a block: the same hover bar as other blocks, with the rows and
// columns around the cursor added or removed from it. The table sits in the
// same .table-scroll wrapper published pages use, so the theme styles both.
function TableView(props: NodeViewProps) {
  const { editor, getPos } = props;
  // Rows and columns change around the cursor; a cursor outside this table
  // is moved into its first cell first.
  const run = (change: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
    const pos = getPos(); if (pos === undefined) return;
    const { $from } = editor.state.selection;
    const inside = Array.from({ length: $from.depth }, (_, index) => index + 1).some(depth => $from.node(depth).type.name === 'table' && $from.before(depth) === pos);
    let chain = editor.chain().focus();
    if (!inside) chain = chain.setTextSelection(pos + 4);
    change(chain).run();
  };
  const item = (label: string, icon: React.ReactNode, change: Parameters<typeof run>[0]) =>
    <DropdownMenuItem onSelect={() => run(change)}>{icon}{label}</DropdownMenuItem>;
  return <NodeViewWrapper className="marq-block" data-testid="table-block">
    <BlockBar editor={editor} getPos={getPos} label="Table" fields={[]} settings={{}}>
      <DropdownMenu>
        <Tooltip label="Rows and columns"><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Rows and columns"><TableProperties /></Button></DropdownMenuTrigger></Tooltip>
        <DropdownMenuContent align="end">
          {item('Row above', <BetweenHorizontalStart />, chain => chain.addRowBefore())}
          {item('Row below', <Rows3 />, chain => chain.addRowAfter())}
          {item('Column left', <BetweenVerticalStart />, chain => chain.addColumnBefore())}
          {item('Column right', <Columns3 />, chain => chain.addColumnAfter())}
          <DropdownMenuSeparator />
          {item('Delete row', <Rows3 />, chain => chain.deleteRow())}
          {item('Delete column', <Columns3 />, chain => chain.deleteColumn())}
          <DropdownMenuSeparator />
          {item('Header row', <PanelTop />, chain => chain.toggleHeaderRow())}
        </DropdownMenuContent>
      </DropdownMenu>
    </BlockBar>
    <div className="table-scroll"><NodeViewContent as={'table' as 'div'} /></div>
  </NodeViewWrapper>;
}

// The rows go into a tbody: TipTap puts a node view's content in an element
// of this tag inside NodeViewContent (a div by default, invalid in a table).
export const MarqTable = Table.extend({ addNodeView: () => ReactNodeViewRenderer(TableView, { contentDOMElementTag: 'tbody' }) });

export const MarqCode = Node.create({
  name: 'marqCode', group: 'block', content: 'text*', marks: '', code: true, defining: true, draggable: true,
  addAttributes: () => ({ settings: { default: {}, parseHTML: e => settings(e, 'data-marq-code') } }),
  parseHTML: () => [{ tag: 'figure[data-marq-code]', contentElement: 'code', preserveWhitespace: 'full' }],
  renderHTML: ({ HTMLAttributes }) => ['figure', { class: 'marq-code', 'data-marq-code': JSON.stringify(HTMLAttributes.settings) }, ['pre', ['code', 0]]],
  addNodeView: () => ReactNodeViewRenderer(CodeView),
});
export const MarqTabs = Node.create({
  name: 'marqTabs', group: 'block', content: 'marqArea*', defining: true, isolating: true, draggable: true,
  addAttributes: () => ({ settings: { default: {}, parseHTML: e => settings(e, 'data-marq-tabs') } }),
  parseHTML: () => [{ tag: 'div[data-marq-tabs]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { class: 'marq-tabs', 'data-marq-tabs': JSON.stringify(HTMLAttributes.settings) }, 0],
  addNodeView: () => ReactNodeViewRenderer(TabsView),
});
export const MarqArea = Node.create({
  name: 'marqArea', content: 'block+', defining: true, isolating: true,
  addAttributes: () => ({ settings: { default: {}, parseHTML: e => settings(e, 'data-marq-area') } }),
  parseHTML: () => [{ tag: 'section[data-marq-area]', contentElement: '.marq-area-body' }],
  renderHTML: ({ HTMLAttributes }) => ['section', { class: 'marq-area', 'data-marq-area': JSON.stringify(HTMLAttributes.settings) }, ['div', { class: 'marq-area-body' }, 0]],
  addNodeView: () => ReactNodeViewRenderer(AreaView),
});
export const MarqAlert = Node.create({
  name: 'marqAlert', group: 'block', content: 'block+', defining: true, draggable: true,
  addAttributes: () => ({ settings: { default: { kind: 'note' }, parseHTML: element => ({ kind: alertKind(element) }) } }),
  parseHTML: () => [{ tag: 'div.markdown-alert', contentElement: '.markdown-alert-body', priority: 60 }],
  renderHTML: ({ HTMLAttributes }) => ['div', { class: `markdown-alert markdown-alert-${HTMLAttributes.settings?.kind ?? 'note'}` }, ['div', { class: 'markdown-alert-body' }, 0]],
  addNodeView: () => ReactNodeViewRenderer(AlertView),
});
export const SourceBlock = Node.create({
  name: 'sourceBlock', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ source: { default: '', parseHTML: element => element.getAttribute('data-marq-source') } }),
  parseHTML: () => [{ tag: 'pre[data-marq-source]', priority: 100 }],
  renderHTML: ({ HTMLAttributes }) => ['pre', mergeAttributes({ 'data-marq-source': HTMLAttributes.source }), HTMLAttributes.source],
  addNodeView: () => ReactNodeViewRenderer(SourceView),
});
