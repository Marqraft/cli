import { describe, expect, it } from 'vitest';
import { filterSettingPages, settingPages } from './settings';
import type { Theme } from './types';

const field = (name: string, label: string, extra?: { page?: string; section?: string }) => ({ name, label, type: 'text', default: '', ...extra });
const theme = (settings: ReturnType<typeof field>[], settingsPages?: Theme['settingsPages']): Theme =>
  ({ name: 'T', settings, settingsPages, blocks: [], commands: [], pageTemplates: [] });

describe('settingPages', () => {
  it('puts ungrouped fields on one General page', () => {
    const pages = settingPages(theme([field('a', 'A'), field('b', 'B')]));
    expect(pages.map(page => page.id)).toEqual(['general']);
    expect(pages[0].sections.map(section => section.fields.map(f => f.name))).toEqual([['a', 'b']]);
  });

  it('orders declared pages and groups sections in field order', () => {
    const pages = settingPages(theme([
      field('accent', 'Accent', { page: 'look', section: 'Colors' }),
      field('logo', 'Logo', { page: 'brand', section: 'Identity' }),
      field('width', 'Width', { page: 'look', section: 'Layout' }),
      field('plain', 'Plain', { page: 'look' }),
    ], [{ id: 'brand', label: 'Brand' }, { id: 'look', label: 'Look' }]));
    expect(pages.map(page => page.id)).toEqual(['brand', 'look']);
    expect(pages[1].sections.map(section => section.title)).toEqual(['Colors', 'Layout', null]);
  });

  it('sends unassigned fields to the first declared page', () => {
    const pages = settingPages(theme([field('x', 'X')], [{ id: 'first', label: 'First' }]));
    expect(pages.map(page => page.id)).toEqual(['first']);
  });

  it('gives fields on undeclared pages their own page', () => {
    const pages = settingPages(theme([field('x', 'X', { page: 'nope' })], [{ id: 'first', label: 'First' }]));
    expect(pages.map(page => page.id)).toEqual(['nope']);
  });
});

describe('filterSettingPages', () => {
  const pages = settingPages(theme([
    field('accent', 'Accent color', { page: 'look', section: 'Colors' }),
    field('width', 'Content width', { page: 'look', section: 'Layout' }),
    field('logo', 'Site logo', { page: 'brand' }),
  ], [{ id: 'look', label: 'Appearance' }, { id: 'brand', label: 'Brand' }]));

  it('returns everything on an empty query', () => {
    expect(filterSettingPages(pages, '  ')).toHaveLength(2);
  });

  it('matches field labels and names', () => {
    const found = filterSettingPages(pages, 'accent');
    expect(found.map(page => page.id)).toEqual(['look']);
    expect(found[0].sections[0].fields.map(f => f.name)).toEqual(['accent']);
  });

  it('keeps a whole page on a page-label match', () => {
    const found = filterSettingPages(pages, 'brand');
    expect(found.map(page => page.id)).toEqual(['brand']);
    expect(found[0].sections[0].fields).toHaveLength(1);
  });

  it('matches section titles', () => {
    const found = filterSettingPages(pages, 'layout');
    expect(found[0].sections.map(section => section.title)).toEqual(['Layout']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterSettingPages(pages, 'zzz')).toEqual([]);
  });
});
