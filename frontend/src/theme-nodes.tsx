import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Node, type Editor, type NodeViewRendererProps } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plus } from 'lucide-react';
import type { ThemeBlock } from './types';
export type { ThemeBlock } from './types';
import { BlockBar } from './components/BlockBar';
import { Button } from './components/ui/button';
import { token } from './api';
import { defaults } from './registry';

function rootOf(html: string): HTMLElement {
  const template = document.createElement('template'); template.innerHTML = html.trim();
  if (template.content.children.length !== 1) throw new Error('Block templates must render one root element');
  return template.content.firstElementChild as HTMLElement;
}

/** Keeps the editable subtree attached while refreshing only template chrome. */
export function updateChrome(target: HTMLElement, fresh: HTMLElement, slot?: HTMLElement) {
  if (target === slot) return;
  for (const attribute of [...target.attributes]) if (!fresh.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  for (const attribute of [...fresh.attributes]) target.setAttribute(attribute.name, attribute.value);
  const oldNodes = [...target.childNodes], newNodes = [...fresh.childNodes];
  const branch = oldNodes.findIndex(node => node === slot || (node instanceof HTMLElement && slot && node.contains(slot)));
  if (branch < 0) { target.replaceChildren(...newNodes); return; }
  if (oldNodes.length !== newNodes.length || !(newNodes[branch] instanceof HTMLElement)) throw new Error('Settings changed the editable slot structure');
  oldNodes.forEach((child, index) => {
    if (index === branch) updateChrome(child as HTMLElement, newNodes[index] as HTMLElement, slot);
    else child.replaceWith(newNodes[index]);
  });
}

/**
 * A theme block rendered by its Kex template. The template's data-marq-slot
 * element becomes ProseMirror's content DOM; everything else is chrome that is
 * re-rendered by the backend when settings change.
 */
function view(definition: ThemeBlock, props: NodeViewRendererProps) {
  const editor = props.editor as Editor;
  const dom = document.createElement('div'); dom.className = 'marq-theme-node marq-block';
  const shell = rootOf(definition.editorHTML!);
  if (definition.body !== 'none' && definition.body !== 'areas' && !shell.querySelector('[data-marq-slot]')) throw new Error('Block template has no editable slot');
  const contentDOM = definition.body === 'none' ? undefined : shell.querySelector<HTMLElement>('[data-marq-slot]') ?? undefined;
  if (contentDOM) contentDOM.replaceChildren();
  const bar = document.createElement('div');
  dom.append(bar, shell);
  const root: Root = createRoot(bar);
  let node = props.node as PMNode;
  const addArea = () => { const pos = props.getPos(); if (pos !== undefined) editor.commands.insertContentAt(pos + node.nodeSize - 1, { type: 'marqArea', attrs: { settings: { id: crypto.randomUUID(), label: `Area ${node.childCount + 1}` } }, content: [{ type: 'paragraph' }] }); };
  const renderBar = () => root.render(
    <BlockBar editor={editor} getPos={props.getPos} label={definition.label} fields={definition.settings} settings={{ ...defaults(definition.settings), ...node.attrs.settings }}>
      {definition.body === 'areas' && <Button variant="ghost" size="sm" onClick={addArea}><Plus />Add area</Button>}
    </BlockBar>);
  renderBar();
  let latest = JSON.stringify(node.attrs.settings), generation = 0, destroyed = false;
  async function refresh(value: Record<string, string>) {
    const request = ++generation;
    try {
      const response = await fetch('/__marqraft/block', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Marqraft-Session': token }, body: JSON.stringify({ id: definition.id, settings: value }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Block preview failed');
      if (!destroyed && request === generation) updateChrome(shell, rootOf(result.html), contentDOM);
      delete dom.dataset.error;
    } catch (error) { if (!destroyed) { dom.dataset.error = String(error); } }
  }
  void refresh(node.attrs.settings);
  return {
    dom, contentDOM,
    update(next: PMNode) {
      if (next.type !== node.type) return false;
      node = next; renderBar();
      const value = JSON.stringify(next.attrs.settings);
      if (value !== latest) { latest = value; void refresh(next.attrs.settings); }
      return true;
    },
    ignoreMutation(mutation: { target: globalThis.Node; type: string }) { return mutation.type !== 'selection' && (!contentDOM || !contentDOM.contains(mutation.target)); },
    stopEvent(event: Event) { return bar.contains(event.target as globalThis.Node); },
    destroy() { destroyed = true; queueMicrotask(() => root.unmount()); },
  };
}

export function themeNodes(definitions: ThemeBlock[]) {
  return definitions.filter(def => def.template && def.editorHTML).map(def => Node.create({
    name: `theme_${def.id}`, group: 'block', defining: true, isolating: true, draggable: true,
    content: def.body === 'none' ? undefined : def.body === 'literal' ? 'text*' : def.body === 'areas' ? 'marqArea*' : 'block+',
    atom: def.body === 'none', marks: def.body === 'literal' ? '' : undefined,
    addAttributes: () => ({
      settings: { default: defaults(def.settings), parseHTML: element => JSON.parse(element.getAttribute('data-marq-settings') ?? '{}') },
      element: { default: def.element }, bodyKind: { default: def.body }, blockId: { default: def.id },
      original: { default: null, parseHTML: element => element.getAttribute('data-marq-original') }, baseline: { default: null },
    }),
    parseHTML: () => [{ tag: `[data-marq-block="${def.id}"]`, contentElement: '[data-marq-slot]', preserveWhitespace: def.body === 'literal' ? 'full' : undefined }],
    renderHTML: () => ['div', {}, 0],
    addNodeView: () => props => view(def, props),
  }));
}
