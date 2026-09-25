// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { tokens } from './highlight';

describe('Kex highlight tokens', () => {
  it('maps classed spans to offsets in the code, entities decoded', () => {
    const code = 'let s = "a<b"';
    const html = '<span class="tok-keyword">let</span> s <span class="tok-op">=</span> <span class="tok-string">&quot;a&lt;b&quot;</span>';
    expect(tokens(html, code)).toEqual([
      { from: 0, to: 3, className: 'tok-keyword' },
      { from: 6, to: 7, className: 'tok-op' },
      { from: 8, to: 13, className: 'tok-string' },
    ]);
  });
  it('lets a nested span win over its parent', () => {
    expect(tokens('<span class="tok-string">"${<span class="tok-interp">x</span>}"</span>', '"${x}"')).toEqual([
      { from: 0, to: 3, className: 'tok-string' },
      { from: 3, to: 4, className: 'tok-interp' },
      { from: 4, to: 6, className: 'tok-string' },
    ]);
  });
  it('refuses HTML whose text is not the code', () => {
    expect(tokens('<span class="tok-keyword">let</span>', 'var')).toBeNull();
  });
});
