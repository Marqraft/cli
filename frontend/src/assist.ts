import { useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/core';
import { DOMParser, Fragment, type Node } from '@tiptap/pm/model';
import { api } from './api';
import { preserveSlices, serialize } from './format';
import type { SlashItem } from './commands';

/**
 * The writing assistant, as the editor sees it: tasks go to the server, which
 * asks whichever AI provider is set up, and answers come back as proposals.
 * A proposal is shown beside the block it concerns and changes nothing until
 * the author accepts it; then it is applied as one ordinary edit, which
 * co-editors receive and the saver saves like any other.
 */

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Task =
  | { task: 'rewrite'; instruction: string; markdown: string }
  | { task: 'generate'; instruction: string; context: string }
  | { task: 'continue'; before: string }
  | { task: 'complete'; before: string; after: string }
  | { task: 'chat'; messages: ChatMessage[]; outline: string; blocks: number };
export type Edit = { op: 'replace' | 'insert_after' | 'delete'; block: number; markdown?: string; html: string };
export type Answer = { markdown: string; html: string };

export const assist = <T = Answer>(task: Task, signal?: AbortSignal) => api<T>('assist', { ...task, title: pageTitle() }, signal);

// The title is edited in the theme's own title element, not the editor.
const pageTitle = () => document.querySelector<HTMLElement>('[data-marq-title]')?.textContent?.trim() ?? '';

/** A top-level block as the page's source holds it. */
export function blockMarkdown(node: Node): string {
  try { return serialize(node.toJSON()); } catch { return node.textContent; }
}

/** The page as numbered blocks, the way a chat refers to them. */
export function outline(doc: Node): string {
  const lines: string[] = [];
  doc.forEach((node, _, index) => lines.push(`[${index + 1}] ${blockMarkdown(node)}`));
  return lines.join('\n\n');
}

/** The blocks before one, as Markdown: what "continue" and "generate" read. */
export function blocksBefore(doc: Node, index: number): string {
  const parts: string[] = [];
  for (let i = 0; i < index; i++) parts.push(blockMarkdown(doc.child(i)));
  return parts.join('\n\n');
}

export const startOf = (doc: Node, index: number) => { let pos = 0; for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize; return pos; };

/** Server-rendered authoring HTML as editor content, keeping each block's source. */
export function contentFrom(editor: Editor, html: string): Fragment {
  // An inert document: nothing in the HTML runs or loads while it is parsed.
  const body = new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const json = preserveSlices(DOMParser.fromSchema(editor.schema).parse(body).toJSON());
  return Fragment.fromJSON(editor.schema, json.content ?? []);
}

export type Proposal = {
  id: string;
  label: string;
  /** What accepting does to the anchor block. */
  op: Edit['op'];
  /**
   * The block the proposal is about, as it was when asked. Edits elsewhere
   * leave a block's node as it is, so finding this node again finds the
   * block; if it is gone, the block changed and the proposal is stale.
   */
  anchor: Node;
  /** Where the anchor was, to try again once it changed. */
  index: number;
  state: 'loading' | 'ready' | 'failed';
  html?: string;
  error?: string;
  /** Asks again, about the block as it is now. */
  retry?: (anchor: Node, index: number) => void;
  /** A chat's proposals are listed in the chat, not beside their blocks. */
  source: 'block' | 'chat';
};

let proposals: Proposal[] = [];
const listeners = new Set<() => void>();
const publish = (next: Proposal[]) => { proposals = next; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const useProposals = () => useSyncExternalStore(subscribe, () => proposals);
export const currentProposals = () => proposals;

export function putProposal(proposal: Proposal) {
  const others = proposals.filter(item => item.id !== proposal.id && !(item.source === 'block' && proposal.source === 'block' && item.anchor === proposal.anchor));
  publish([...others, proposal]);
}
export const updateProposal = (id: string, change: Partial<Proposal>) => publish(proposals.map(item => item.id === id ? { ...item, ...change } : item));
export const dropProposal = (id: string) => publish(proposals.filter(item => item.id !== id));
export const dropProposals = (source: Proposal['source']) => publish(proposals.filter(item => item.source !== source));

/** Where the proposal's block is now, or -1 when it changed or went away. */
export function anchorIndex(doc: Node, target: { anchor: Node; index: number }): number {
  if (doc.maybeChild(target.index) === target.anchor) return target.index;
  for (let index = 0; index < doc.childCount; index++) if (doc.child(index) === target.anchor) return index;
  return -1;
}

/** Applies an accepted proposal as one edit; false when its block changed meanwhile. */
export function applyProposal(editor: Editor, proposal: Proposal): boolean {
  const { doc } = editor.state;
  const index = anchorIndex(doc, proposal);
  if (index < 0) return false;
  const from = startOf(doc, index), to = from + proposal.anchor.nodeSize;
  const tr = editor.state.tr;
  if (proposal.op === 'delete') tr.delete(from, to);
  else {
    const content = contentFrom(editor, proposal.html ?? '');
    if (!content.childCount) return false;
    if (proposal.op === 'replace') tr.replaceWith(from, to, content);
    else tr.insert(to, content);
  }
  editor.view.dispatch(tr.scrollIntoView());
  dropProposal(proposal.id);
  return true;
}

/**
 * Asks for a new version of a block, or for blocks to go in its place (an
 * empty paragraph) or after it, and shows the answer as a proposal.
 */
export function proposeForBlock(label: string, op: 'replace' | 'insert_after', anchor: Node, index: number, task: (anchor: Node, index: number) => Task) {
  const id = crypto.randomUUID();
  const ask = (current: Node, at: number) => {
    putProposal({ id, label, op, anchor: current, index: at, state: 'loading', source: 'block', retry: ask });
    assist(task(current, at))
      .then(answer => updateProposal(id, { state: 'ready', html: answer.html }))
      .catch(error => updateProposal(id, { state: 'failed', error: error.message }));
  };
  ask(anchor, index);
}

/** The quick instructions a block's menu offers. */
export const blockActions: { id: string; label: string; instruction: string }[] = [
  { id: 'improve', label: 'Improve writing', instruction: 'Improve the writing: clearer, tighter and more readable, keeping the meaning.' },
  { id: 'fix', label: 'Fix spelling & grammar', instruction: 'Fix spelling, grammar and punctuation only; change nothing else.' },
  { id: 'shorten', label: 'Make shorter', instruction: 'Make it about half as long, keeping what matters.' },
  { id: 'expand', label: 'Make longer', instruction: 'Expand it with more detail and explanation, in the same voice.' },
  { id: 'simplify', label: 'Simplify language', instruction: 'Rewrite it in plain, simple language a newcomer understands.' },
];
export const tones = ['Professional', 'Friendly', 'Confident', 'Casual', 'Academic'];
export const languages = ['English', 'German', 'French', 'Spanish', 'Hungarian', 'Japanese'];

/** A request typed by the author, waiting to be sent. */
export type Prompting = { anchor: Node; index: number; placeholder: string; submit: (text: string) => void };
let prompting: Prompting | null = null;
const promptListeners = new Set<() => void>();
export const setPrompting = (next: Prompting | null) => { prompting = next; promptListeners.forEach(listener => listener()); };
export const usePrompting = () => useSyncExternalStore(listener => { promptListeners.add(listener); return () => { promptListeners.delete(listener); }; }, () => prompting);

/** Where new text goes from the caret: in place of an empty paragraph, else after the block. */
export function writingSpot(editor: Editor) {
  const { doc, selection } = editor.state;
  const index = Math.min(selection.$from.index(0), doc.childCount - 1);
  const anchor = doc.child(index);
  const empty = anchor.type.name === 'paragraph' && anchor.content.size === 0;
  return { anchor, index, op: empty ? 'replace' as const : 'insert_after' as const, context: (at: number) => blocksBefore(editor.state.doc, empty ? at : at + 1) };
}

/** Opens the box to type what to write at the caret. */
export function promptToWrite(editor: Editor) {
  const spot = writingSpot(editor);
  setPrompting({ anchor: spot.anchor, index: spot.index, placeholder: 'Ask AI to write… (e.g. "an intro to installing marq")', submit: instruction =>
    proposeForBlock(instruction, spot.op, spot.anchor, spot.index, (_, at) => ({ task: 'generate', instruction, context: spot.context(at) })) });
}

/** Continues the page from the caret's block. */
export function continueWriting(editor: Editor) {
  const spot = writingSpot(editor);
  proposeForBlock('Continue writing', spot.op, spot.anchor, spot.index, (_, at) => ({ task: 'continue', before: spot.context(at) }));
}

/** What the assistant adds to the slash menu. */
export const assistantCommands: SlashItem[] = [
  { id: 'ai', label: 'Ask AI to write', description: 'Draft text from a request', aliases: ['write', 'generate', 'draft'], icon: 'sparkles', group: 'AI', run: e => promptToWrite(e) },
  { id: 'continue', label: 'Continue writing', description: 'AI continues from here', aliases: ['more', 'next'], icon: 'penLine', group: 'AI', run: e => continueWriting(e) },
];
