import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { anchorIndex, applyProposal, contentFrom, dropProposal, safePreview, setPrompting, startOf, usePrompting, useProposals, type Proposal } from '../assist';
import { bodyHost } from '../hosts';
import { Button } from './ui/button';
import { Input } from './ui/input';

/** Redraws on every editor change and resize: cards follow the blocks they are about. */
export function useLayoutTick(editor: Editor) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    editor.on('transaction', tick);
    window.addEventListener('resize', tick);
    return () => { editor.off('transaction', tick); window.removeEventListener('resize', tick); };
  }, [editor]);
}

/** The block's element and where a card below it goes, on the page. */
function place(editor: Editor, index: number) {
  const { doc } = editor.state;
  if (index < 0 || index >= doc.childCount) return null;
  const element = editor.view.nodeDOM(startOf(doc, index)) as HTMLElement | null;
  if (!element?.getBoundingClientRect) return null;
  const block = element.getBoundingClientRect(), box = editor.view.dom.getBoundingClientRect();
  return { element, top: block.bottom + 6 + window.scrollY, left: box.left + window.scrollX, width: box.width };
}

/** Outlines the block a proposal or prompt concerns, while it is shown. */
function useTarget(element: HTMLElement | undefined) {
  useEffect(() => {
    element?.classList.add('marq-ai-target');
    return () => element?.classList.remove('marq-ai-target');
  }, [element]);
}

/**
 * The proposed content as the page will show it: the published rendering,
 * inside an element like the one the theme puts the page body in, so the
 * theme's prose and code styles apply. Without one, the editor's schema
 * draws it.
 */
export function ProposalPreview({ editor, html, preview }: { editor: Editor; html: string; preview?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = ref.current;
    if (!target) return;
    try {
      const container = bodyHost?.parentElement;
      const frame = document.createElement(container && container !== document.body ? container.tagName : 'div');
      if (container && container !== document.body) frame.className = container.className;
      frame.classList.add('marq-ai-frame');
      frame.append(preview ? safePreview(preview) : DOMSerializer.fromSchema(editor.schema).serializeFragment(contentFrom(editor, html)));
      target.replaceChildren(frame);
    } catch { target.textContent = 'This proposal cannot be shown.'; }
  }, [editor, html, preview]);
  return <div ref={ref} className="marq-ai-preview" />;
}

/** Accept, retry and discard, for one proposal; `stale` when its block changed since. */
export function ProposalActions({ editor, proposal, stale }: { editor: Editor; proposal: Proposal; stale: boolean }) {
  const retry = () => {
    const { doc } = editor.state;
    const index = stale ? Math.min(proposal.index, doc.childCount - 1) : anchorIndex(doc, proposal);
    proposal.retry?.(doc.child(index), index);
  };
  const verb = proposal.op === 'delete' ? 'Delete' : proposal.op === 'insert_after' ? 'Insert' : 'Replace';
  return <div className="mq:flex mq:items-center mq:gap-1">
    {proposal.state === 'ready' && !stale && <Button size="sm" onClick={() => applyProposal(editor, proposal)}><Check />{verb}</Button>}
    {proposal.retry && proposal.state !== 'loading' && <Button size="sm" variant="ghost" onClick={retry}><RotateCcw />Try again</Button>}
    <Button size="sm" variant="ghost" onClick={() => dropProposal(proposal.id)}><X />Discard</Button>
  </div>;
}

function ProposalCard({ editor, proposal }: { editor: Editor; proposal: Proposal }) {
  const index = anchorIndex(editor.state.doc, proposal);
  const stale = index < 0 && proposal.state !== 'loading';
  const spot = place(editor, index < 0 ? Math.min(proposal.index, editor.state.doc.childCount - 1) : index);
  useTarget(stale ? undefined : spot?.element);
  if (!spot) return null;
  return (
    <div data-marq-chrome role="dialog" aria-label={`AI: ${proposal.label}`}
      className="marq-ui marq-authoring-only mq:absolute mq:z-30 mq:flex mq:flex-col mq:gap-2 mq:rounded-lg mq:border mq:border-border mq:bg-background mq:p-3 mq:text-sm mq:shadow-lg"
      style={{ top: spot.top, left: spot.left, width: spot.width }}>
      <div className="mq:flex mq:items-center mq:gap-2 mq:text-xs mq:font-medium mq:text-muted-foreground">
        {proposal.state === 'loading' ? <Loader2 className="mq:size-3.5 mq:animate-spin" /> : <Sparkles className="mq:size-3.5" />}
        <span className="mq:truncate">{proposal.label}</span>
      </div>
      {proposal.state === 'loading' && <div className="mq:text-muted-foreground">Writing…</div>}
      {proposal.state === 'failed' && <div role="alert" className="mq:text-destructive">{proposal.error}</div>}
      {proposal.state === 'ready' && stale && <div className="mq:text-muted-foreground">The block changed since you asked. Try again to rewrite it as it is now.</div>}
      {proposal.state === 'ready' && !stale && proposal.html && <div className="mq:max-h-96 mq:overflow-auto mq:rounded-md mq:border mq:border-dashed mq:border-border mq:px-3"><ProposalPreview editor={editor} html={proposal.html} preview={proposal.preview} /></div>}
      <ProposalActions editor={editor} proposal={proposal} stale={stale} />
    </div>
  );
}

/** The box to tell the assistant what to write or do, under the block it is about. */
function PromptBox({ editor }: { editor: Editor }) {
  const prompting = usePrompting();
  const [text, setText] = useState('');
  useEffect(() => { setText(''); }, [prompting]);
  const index = prompting ? anchorIndex(editor.state.doc, prompting) : -1;
  const spot = prompting ? place(editor, index < 0 ? prompting.index : index) : null;
  useTarget(spot?.element);
  if (!prompting || !spot) return null;
  const close = () => { setPrompting(null); editor.commands.focus(); };
  const submit = () => { if (!text.trim()) return; prompting.submit(text.trim()); setPrompting(null); };
  return (
    <form data-marq-chrome onSubmit={event => { event.preventDefault(); submit(); }}
      className="marq-ui marq-authoring-only mq:absolute mq:z-30 mq:flex mq:items-center mq:gap-2 mq:rounded-lg mq:border mq:border-border mq:bg-background mq:p-2 mq:shadow-lg"
      style={{ top: spot.top, left: spot.left, width: spot.width }}>
      <Sparkles className="mq:size-4 mq:shrink-0 mq:text-muted-foreground" />
      <Input autoFocus value={text} onChange={event => setText(event.target.value)} placeholder={prompting.placeholder} aria-label="Ask AI"
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }} className="mq:border-0 mq:shadow-none mq:focus-visible:ring-0" />
      <Button type="submit" size="sm" disabled={!text.trim()}>Ask</Button>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={close}><X /></Button>
    </form>
  );
}

/** Every open proposal beside its block, and the prompt box. */
export function ProposalLayer({ editor }: { editor: Editor }) {
  useLayoutTick(editor);
  const proposals = useProposals().filter(proposal => proposal.source === 'block');
  return <>
    {proposals.map(proposal => <ProposalCard key={proposal.id} editor={editor} proposal={proposal} />)}
    <PromptBox editor={editor} />
  </>;
}
