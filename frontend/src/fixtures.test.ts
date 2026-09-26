// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generateJSON, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { MarqAlert, MarqArea, MarqCode, MarqFence, MarqTabs, SourceBlock, SourceSlices } from './nodes';
import { preserveSlices, serialize } from './format';
import source from '../../fixtures/content/round-trip.md?raw';
import html from '../../fixtures/content/round-trip.html?raw';

const extensions = [StarterKit.configure({ trailingNode: false, codeBlock: false }), MarqFence, TableKit, Image.configure({ inline: true }), MarqCode, MarqTabs, MarqArea, MarqAlert, SourceBlock, SourceSlices];
const load = () => preserveSlices(generateJSON(html, extensions));

describe('shared round-trip fixture', () => {
  it('serializes untouched Kex-rendered content back to the original source', () => {
    expect(serialize(load())).toBe(source);
  });
  it('re-serializes only the edited block, escaping what changed', () => {
    const doc = load();
    const tabs = doc.content!.find(node => node.type === 'marqTabs')!;
    const area = tabs.content![1] as JSONContent;
    area.attrs = { ...area.attrs, settings: { ...area.attrs!.settings, label: 'Tab "two" <b>' } };
    const output = serialize(doc);
    expect(output).toContain('<marqraft-area id="two" label="Tab &quot;two&quot; &lt;b&gt;">');
    expect(output).toContain('id="one" label="Première"');
    expect(output.startsWith(source.slice(0, source.indexOf('<marqraft-tabs>')))).toBe(true);
    expect(output).toContain('<unknown-widget data-x="1">kept <b>verbatim</b></unknown-widget>');
    expect(output.endsWith('<marqraft-tabs><marqraft-area id="broken" label="x">unclosed</marqraft-tabs>\n')).toBe(true);
  });
  it('reads GitHub alerts and writes a changed kind back as Markdown', () => {
    const doc = load();
    const alert = doc.content!.find(node => node.type === 'marqAlert')!;
    expect(alert.attrs!.settings.kind).toBe('warning');
    alert.attrs = { ...alert.attrs, settings: { kind: 'caution' } };
    expect(serialize(doc)).toContain('> [!CAUTION]\n> Check **this** first.\n>\n> - then this\n\n');
  });
  it('keeps an image paragraph as one image, so saving does not duplicate it', () => {
    const doc = load();
    const images = JSON.stringify(doc).match(/"type":"image"/g) ?? [];
    expect(images).toHaveLength(1);
    const paragraph = doc.content!.find(node => node.content?.some(child => child.type === 'image'))!;
    paragraph.content = [...paragraph.content!, { type: 'text', text: ' caption' }];
    expect(serialize(doc).match(/!\[A photo\]\(\/images\/photo\.png\)/g)).toHaveLength(1);
  });
  it('keeps literal code text exact, including entities and indentation', () => {
    const code = load().content!.find(node => node.type === 'marqCode')!;
    expect(code.content!.map(node => node.text).join('')).toBe('\nlet html = "<p>&amp;</p>"\n  indented   line\n');
  });
});
