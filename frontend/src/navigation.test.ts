import { describe, it, expect } from 'vitest';
import { addPage, collectionOf, moveNode, shift, suggestPath, validPath } from './navigation';

const tree = () => [{ id: 'a', children: [{ id: 'a1', children: [] }] }, { id: 'b', children: [] }, { id: 'c', children: [] }];

describe('navigation tree operations', () => {
  it('moves pages before, after and inside others without changing the input', () => {
    const original = tree();
    expect(moveNode(original, 'c', 'a', 'before').map(n => n.id)).toEqual(['c', 'a', 'b']);
    expect(moveNode(original, 'a1', 'b', 'inside')[1].children.map(n => n.id)).toEqual(['a1']);
    expect(original[0].children).toHaveLength(1);
  });
  it('refuses to move a page into its own subtree', () => {
    const original = tree();
    expect(moveNode(original, 'a', 'a1', 'inside')).toBe(original);
  });
  it('indents under the previous sibling and outdents after the parent', () => {
    const indented = shift(tree(), 'b', 'indent');
    expect(indented[0].children.map(n => n.id)).toEqual(['a1', 'b']);
    expect(shift(indented, 'b', 'outdent').map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(shift(tree(), 'a', 'up').map(n => n.id)).toEqual(['a', 'b', 'c']);
  });
  it('finds the collection holding a page and adds pages inside it', () => {
    expect(collectionOf(tree(), 'a1')?.id).toBe('a');
    expect(collectionOf(tree(), 'b')?.id).toBe('b');
    expect(collectionOf(tree(), 'zzz')).toBeUndefined();
    expect(addPage(tree(), 'n', 'a')[0].children.map(n => n.id)).toEqual(['a1', 'n']);
    expect(addPage(tree(), 'n').map(n => n.id)).toEqual(['a', 'b', 'c', 'n']);
    const original = tree();
    expect(addPage(original, 'b', 'a')).toBe(original);
  });
  it('suggests unique nested URLs that the backend accepts', () => {
    expect(suggestPath('/tutorial/', 'Déjà vu: Variables!', [])).toBe('/tutorial/deja-vu-variables/');
    expect(suggestPath('/', 'Intro', ['/intro/'])).toBe('/intro-2/');
    expect(validPath('/tutorial/deja-vu/')).toBe(true);
    expect(validPath('/guide/0.4/en/')).toBe(true);
    expect(validPath('/prelude/0.4.0-beta.4/')).toBe(true);
    expect(validPath('/guide/../x/')).toBe(false);
    expect(validPath('/./')).toBe(false);
    expect(validPath('/__marqraft/x/')).toBe(false);
    expect(validPath('/no-trailing')).toBe(false);
  });
});
