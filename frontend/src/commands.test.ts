import { describe, it, expect } from 'vitest';
import { slashCommands, filterCommands, blockContent } from './commands';
import type { ThemeBlock } from './types';

const code: ThemeBlock = { id: 'code', element: 'marqraft-code', label: 'Code', body: 'literal', settings: [{ name: 'language', label: 'Language', type: 'enum', default: 'kex' }] };
const callout: ThemeBlock = { id: 'callout', element: 'marqraft-callout', label: 'Callout', body: 'markdown', template: 'blocks/callout.html.ket', settings: [] };

describe('slash command registry', () => {
  it('replaces a built-in only through an explicit override', () => {
    const withOverride = slashCommands([{ id: 'code', label: 'Kex code', kind: 'insert', block: 'code', override: true }], [code], () => {});
    expect(withOverride.filter(item => item.id === 'code').map(item => item.label)).toEqual(['Kex code']);
    const without = slashCommands([{ id: 'code', label: 'Kex code', kind: 'insert', block: 'code' }], [code], () => {});
    expect(without.find(item => item.id === 'code')?.label).toBe('Code');
  });
  it('filters by label and alias, exact matches first', () => {
    const items = slashCommands([{ id: 'callout', label: 'Callout', aliases: ['note'], kind: 'insert', block: 'callout' }], [callout], () => {});
    expect(filterCommands(items, 'note')[0].id).toBe('callout');
    expect(filterCommands(items, 'h3')[0].id).toBe('subheading');
    expect(filterCommands(items, 'zzz')).toEqual([]);
  });
  it('starts blocks with content matching their body kind and default settings', () => {
    expect(blockContent(code)).toMatchObject({ type: 'codeBlock', attrs: { language: 'kex' } });
    expect(blockContent(callout)).toMatchObject({ type: 'theme_callout', content: [{ type: 'paragraph' }] });
  });
});
