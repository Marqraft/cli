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
});
