import { describe, it, expect } from 'vitest';
import { menuHref, moveItem, validMenuUrl } from './menu';
import type { Page } from './types';

const pages = [{ id: 'g', title: 'Guide', path: '/guide/', draft: false, template: 'page', revision: '', file: '' }] as Page[];

describe('menu helpers', () => {
  it('moves items within bounds without mutating the input', () => {
    const items = [{ label: 'A', url: '/a/' }, { label: 'B', url: '/b/' }];
    expect(moveItem(items, 1, -1).map(item => item.label)).toEqual(['B', 'A']);
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(items[0].label).toBe('A');
  });
  it('resolves page links through the current page path', () => {
    expect(menuHref({ label: 'Guide', page: 'g' }, pages)).toBe('/guide/');
    expect(menuHref({ label: 'Gone', page: 'missing' }, pages)).toBeNull();
    expect(menuHref({ label: 'Site', url: 'https://kex.run' }, pages)).toBe('https://kex.run');
  });
  it('accepts only safe link targets', () => {
    expect(validMenuUrl('/prelude/')).toBe(true);
    expect(validMenuUrl('https://kex.run/docs')).toBe(true);
    expect(validMenuUrl('javascript:alert(1)')).toBe(false);
    expect(validMenuUrl('//evil.example')).toBe(false);
    expect(validMenuUrl('/with space/')).toBe(false);
  });
});
