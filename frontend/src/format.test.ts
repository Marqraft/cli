import { describe, it, expect } from 'vitest';
import { serialize, replaceBody } from './format';
describe('source serializer', () => {
  it('escapes literal code and attributes, preserving whitespace', () => {
    expect(serialize({ type: 'marqCode', attrs: { settings: { filename: 'a"<&.kex' } }, content: [{ type: 'text', text: '\n  <b>&quot;\n' }] })).toBe('<marqraft-code filename="a&quot;&lt;&amp;.kex">\n  &lt;b&gt;&amp;quot;\n</marqraft-code>');
  });
  it('preserves repeated area identity and unknown source', () => {
    const source = '<unknown a="b">body</unknown>';
    const text = serialize({ type: 'marqTabs', content: [{ type: 'marqArea', attrs: { settings: { id: 'stable', label: 'Ö' } }, content: [{ type: 'sourceBlock', attrs: { source } }] }] });
    expect(text).toContain('id="stable"'); expect(text).toContain(source);
  });
  it('leaves an empty body untouched when the editor is empty', () => {
    const source = '---\nid: a\ntitle: "Index"\n---\n';
    expect(replaceBody(source, '\n', { title: 'Index' })).toBe(source);
  });
  it('preserves unrelated frontmatter while editing title and body', () => {
    const source = '---\nid: a\ntitle: Before\ncustom:\n  preserved: yes\n---\nOld';
    expect(replaceBody(source, 'New', { title: 'After' })).toBe('---\nid: a\ntitle: "After"\ncustom:\n  preserved: yes\n---\nNew');
  });
  it('writes a version only when there is one', () => {
    const source = '---\nid: a\ntitle: "Guide"\n---\nBody';
    expect(replaceBody(source, 'Body', { title: 'Guide', version: '' })).toBe(source);
    const versioned = replaceBody(source, 'Body', { title: 'Guide', version: '0.4' });
    expect(versioned).toBe('---\nid: a\ntitle: "Guide"\nversion: "0.4"\n---\nBody');
    expect(replaceBody(versioned, 'Body', { title: 'Guide', version: '' })).toBe(source);
  });
});

describe('code fences', () => {
  it('writes the language first and filename and caption after it, as GitHub reads them', () => {
    const fence = (attrs: Record<string, string | null>, text: string) => serialize({ type: 'codeBlock', attrs, content: [{ type: 'text', text }] });
    expect(fence({ language: 'rust', filename: 'src/main.rs', caption: 'The "entry" point.' }, 'fn main() {}'))
      .toBe('```rust filename="src/main.rs" caption="The &quot;entry&quot; point."\nfn main() {}\n```');
    expect(fence({ language: 'kex', filename: '', caption: '' }, 'let x = 1')).toBe('```kex\nlet x = 1\n```');
    expect(fence({ language: null, filename: 'notes.txt', caption: '' }, '```')).toBe('```` filename="notes.txt"\n```\n````');
  });
});
