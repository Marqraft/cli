import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Check, Loader2, Send, Trash2 } from 'lucide-react';
import { anchorIndex, applyProposal, assist, dropProposals, outline, putProposal, startOf, useProposals, type ChatMessage, type Edit, type Proposal } from '../assist';
import { ProposalActions, ProposalPreview, useLayoutTick } from './Proposal';
import { Button } from './ui/button';
import { Textarea } from './ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { autocompleteEnabled, setAutocomplete } from '../autocomplete';

type Turn = ChatMessage & { proposals?: string[]; failed?: boolean };

const describeEdit = (edit: Pick<Edit, 'op' | 'block'>) =>
  edit.op === 'delete' ? `Delete block ${edit.block}` : edit.op === 'insert_after' ? `Insert after block ${edit.block}` : `Rewrite block ${edit.block}`;

/** Scrolls to a proposal's block and outlines it for a moment. */
function reveal(editor: Editor, proposal: Proposal) {
  const index = anchorIndex(editor.state.doc, proposal);
  if (index < 0) return;
  const element = editor.view.nodeDOM(startOf(editor.state.doc, index)) as HTMLElement | null;
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element?.classList.add('marq-ai-target');
  setTimeout(() => element?.classList.remove('marq-ai-target'), 1600);
}

function EditCard({ editor, proposal }: { editor: Editor; proposal: Proposal }) {
  const stale = anchorIndex(editor.state.doc, proposal) < 0;
  return (
    <div className="mq:flex mq:flex-col mq:gap-2 mq:rounded-md mq:border mq:border-border mq:p-2">
      <button type="button" className="mq:text-left mq:text-xs mq:font-medium mq:text-muted-foreground mq:hover:text-foreground" onClick={() => reveal(editor, proposal)}>
        {proposal.label}{stale && ' · block changed since'}
      </button>
      {proposal.op === 'delete'
        ? <div className="mq:text-xs mq:text-muted-foreground mq:line-through">{proposal.anchor.textContent.slice(0, 200)}</div>
        : !stale && <div className="mq:max-h-60 mq:overflow-auto mq:rounded mq:border mq:border-dashed mq:border-border mq:px-2"><ProposalPreview editor={editor} html={proposal.html ?? ''} preview={proposal.preview} /></div>}
      <ProposalActions editor={editor} proposal={proposal} stale={stale} />
    </div>
  );
}

/**
 * A conversation about the page: questions are answered from the page as it
 * is, and changes come back as proposed edits to its blocks, each accepted
 * or discarded on its own.
 */
export function AssistantPanel({ editor, open, setOpen }: { editor: Editor; open: boolean; setOpen: (open: boolean) => void }) {
  useLayoutTick(editor);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(autocompleteEnabled);
  const pending = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const proposals = useProposals().filter(proposal => proposal.source === 'chat');
  // Braces: newer browsers return a promise from scrollIntoView, which React would take for a cleanup.
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [turns, busy]);

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    const messages: ChatMessage[] = [...turns.filter(turn => !turn.failed).map(({ role, content: said }) => ({ role, content: said })), { role: 'user', content }];
    setTurns(current => [...current, { role: 'user', content }]); setText(''); setBusy(true);
    // Edits name blocks by their number in the page as it was sent.
    const doc = editor.state.doc;
    const controller = new AbortController(); pending.current = controller;
    try {
      const reply = await assist<{ answer: string; edits: Edit[] }>({ task: 'chat', messages, outline: outline(doc), blocks: doc.childCount }, controller.signal);
      const ids = reply.edits.map(edit => {
        const id = crypto.randomUUID(), index = edit.block - 1;
        putProposal({ id, label: describeEdit(edit), op: edit.op, anchor: doc.child(index), index, state: 'ready', html: edit.html, preview: edit.preview, source: 'chat' });
        return id;
      });
      setTurns(current => [...current, { role: 'assistant', content: reply.answer || (ids.length ? 'Here are the changes:' : ''), proposals: ids }]);
    } catch (error) {
      if (!controller.signal.aborted) setTurns(current => [...current, { role: 'assistant', content: (error as Error).message, failed: true }]);
    } finally { setBusy(false); pending.current = null; }
  };
  const clear = () => { pending.current?.abort(); setTurns([]); dropProposals('chat'); setBusy(false); };
  const applyAll = (ids: string[]) => {
    // Last block first: an insertion never shifts a block still to be changed.
    const chosen = proposals.filter(proposal => ids.includes(proposal.id)).sort((a, b) => b.index - a.index);
    for (const proposal of chosen) applyProposal(editor, proposal);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent aria-describedby={undefined} className="mq:w-96 mq:gap-3">
        <div className="mq:pr-6">
          <SheetTitle>Ask AI</SheetTitle>
          <SheetDescription>About this page. Suggested changes wait for you to accept them.</SheetDescription>
        </div>
        <div className="mq:flex mq:items-center mq:justify-between mq:gap-2">
          <Label htmlFor="marq-autocomplete" className="mq:text-xs">Suggest the next words while typing <span className="mq:text-muted-foreground">(Tab accepts)</span></Label>
          <Switch id="marq-autocomplete" checked={suggesting} onCheckedChange={on => { setAutocomplete(on); setSuggesting(on); }} />
        </div>
        <div className="mq:flex mq:flex-1 mq:flex-col mq:gap-3 mq:overflow-auto mq:text-sm" aria-live="polite">
          {turns.length === 0 && <div className="mq:text-muted-foreground">Try "Summarize this page", "Suggest a better structure" or "Make the intro friendlier".</div>}
          {turns.map((turn, index) => {
            const open = proposals.filter(proposal => turn.proposals?.includes(proposal.id));
            return <div key={index} className={turn.role === 'user' ? 'mq:self-end mq:max-w-[85%] mq:rounded-lg mq:bg-muted mq:px-3 mq:py-2' : 'mq:flex mq:flex-col mq:gap-2'}>
              {turn.content && <div className={`mq:whitespace-pre-wrap ${turn.failed ? 'mq:text-destructive' : ''}`}>{turn.content}</div>}
              {open.map(proposal => <EditCard key={proposal.id} editor={editor} proposal={proposal} />)}
              {open.length > 1 && <Button size="sm" variant="outline" className="mq:self-start" onClick={() => applyAll(open.map(proposal => proposal.id))}><Check />Accept all {open.length}</Button>}
            </div>;
          })}
          {busy && <div className="mq:flex mq:items-center mq:gap-2 mq:text-muted-foreground"><Loader2 className="mq:size-4 mq:animate-spin" />Thinking…</div>}
          <div ref={bottom} />
        </div>
        <form className="mq:flex mq:flex-col mq:gap-2" onSubmit={event => { event.preventDefault(); void send(); }}>
          <Textarea value={text} onChange={event => setText(event.target.value)} placeholder="Ask about this page, or ask for changes…" aria-label="Message"
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} />
          <div className="mq:flex mq:justify-between">
            <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!turns.length}><Trash2 />Clear</Button>
            <Button type="submit" size="sm" disabled={busy || !text.trim()}><Send />Send</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
