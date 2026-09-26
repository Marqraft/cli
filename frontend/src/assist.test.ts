// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SourceSlices } from './nodes';
import { anchorIndex, applyProposal, currentProposals, dropProposals, outline, putProposal, blockMarkdown, safePreview, type Proposal } from './assist';

const editor = (html: string) => new Editor({ extensions: [StarterKit.configure({ trailingNode: false, undoRedo: false }), SourceSlices], content: html });
const proposal = (e: Editor, index: number, change: Partial<Proposal>): Proposal =>
  ({ id: crypto.randomUUID(), label: 'test', op: 'replace', anchor: e.state.doc.child(index), index, state: 'ready', source: 'block', ...change });

afterEach(() => { dropProposals('block'); dropProposals('chat'); });

describe('assistant proposals', () => {
  it('numbers the page from 1, one block each, as Markdown', () => {
    const e = editor('<h2>Intro</h2><p>Some <strong>bold</strong> text</p><ul><li><p>one</p></li></ul>');
    expect(outline(e.state.doc)).toBe('[1] ## Intro\n\n[2] Some **bold** text\n\n[3] - one');
    expect(blockMarkdown(e.state.doc.child(1))).toBe('Some **bold** text');
  });

  it('replaces, inserts after and deletes the block it is about, keeping the Markdown it came as', () => {
    const e = editor('<p>first</p><p>second</p>');
    expect(applyProposal(e, proposal(e, 1, { html: '<h2 data-marq-original="## Second, better">Second, better</h2>' }))).toBe(true);
    expect(e.getHTML()).toBe('<p>first</p><h2>Second, better</h2>');
    expect(e.state.doc.child(1).attrs.original).toBe('## Second, better');
    expect(applyProposal(e, proposal(e, 0, { op: 'insert_after', html: '<p>between</p>' }))).toBe(true);
    expect(e.getHTML()).toBe('<p>first</p><p>between</p><h2>Second, better</h2>');
    expect(applyProposal(e, proposal(e, 1, { op: 'delete' }))).toBe(true);
    expect(e.getHTML()).toBe('<p>first</p><h2>Second, better</h2>');
  });

  it('follows its block when others change, and goes stale when the block itself does', () => {
    const e = editor('<p>first</p><p>second</p>');
    const later = proposal(e, 1, { html: '<p>SECOND</p>' });
    // Someone adds a block above: the proposal's block moved, but is the same.
    e.commands.insertContentAt(0, '<p>new top</p>');
    expect(anchorIndex(e.state.doc, later)).toBe(2);
    // Someone edits the block itself: accepting would drop their change.
    e.commands.insertContentAt(e.state.doc.content.size - 1, '!');
    expect(anchorIndex(e.state.doc, later)).toBe(-1);
    expect(applyProposal(e, later)).toBe(false);
    expect(e.getHTML()).toBe('<p>new top</p><p>first</p><p>second!</p>');
  });

  it('keeps one proposal per block from the block menu, and drops it once accepted', () => {
    const e = editor('<p>first</p><p>second</p>');
    putProposal(proposal(e, 0, { id: 'a' }));
    putProposal(proposal(e, 0, { id: 'b' }));
    putProposal(proposal(e, 1, { id: 'c', source: 'chat' }));
    expect(currentProposals().map(item => item.id)).toEqual(['b', 'c']);
    applyProposal(e, currentProposals()[0]);
    expect(currentProposals().map(item => item.id)).toEqual(['c']);
  });

  it('shows a published preview without anything that runs', () => {
    const holder = document.createElement('div');
    holder.append(safePreview('<p onclick="x()">Hi <a href="javascript:alert(1)">there</a></p><script>alert(1)</script><figure class="marq-code"><pre class="code"><code><span class="tok-keyword">let</span></code></pre></figure><iframe src="/"></iframe>'));
    expect(holder.innerHTML).toBe('<p>Hi <a>there</a></p><figure class="marq-code"><pre class="code"><code><span class="tok-keyword">let</span></code></pre></figure>');
  });
});
