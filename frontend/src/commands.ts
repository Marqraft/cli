import type { Editor } from '@tiptap/core';
import type { Command, ThemeBlock } from './types';
import { defaults } from './registry';

export type SlashItem = { id: string; label: string; description: string; aliases: string[]; icon: string; group: 'AI' | 'Text' | 'Insert' | 'Theme'; run: (editor: Editor) => void };

const newArea = (label: string) => ({ type: 'marqArea', attrs: { settings: { id: crypto.randomUUID(), label } }, content: [{ type: 'paragraph' }] });

export function builtInCommands(pickImage: () => void): SlashItem[] {
  return [
    { id: 'paragraph', label: 'Text', description: 'Plain paragraph', aliases: ['p'], icon: 'text', group: 'Text', run: e => e.chain().focus().setParagraph().run() },
    { id: 'heading', label: 'Heading', description: 'Section heading', aliases: ['h2', 'title'], icon: 'heading2', group: 'Text', run: e => e.chain().focus().setHeading({ level: 2 }).run() },
    { id: 'subheading', label: 'Subheading', description: 'Smaller heading', aliases: ['h3'], icon: 'heading3', group: 'Text', run: e => e.chain().focus().setHeading({ level: 3 }).run() },
    { id: 'list', label: 'Bulleted list', description: 'Unordered list', aliases: ['ul', 'bullet'], icon: 'list', group: 'Text', run: e => e.chain().focus().toggleBulletList().run() },
    { id: 'numbered', label: 'Numbered list', description: 'Ordered list', aliases: ['ol'], icon: 'listOrdered', group: 'Text', run: e => e.chain().focus().toggleOrderedList().run() },
    { id: 'quote', label: 'Quote', description: 'Blockquote', aliases: ['blockquote'], icon: 'quote', group: 'Text', run: e => e.chain().focus().toggleBlockquote().run() },
    { id: 'callout', label: 'Callout', description: 'Note, tip, warning…', aliases: ['note', 'tip', 'important', 'warning', 'caution', 'alert'], icon: 'callout', group: 'Insert', run: e => {
      // Wrapping the current paragraph keeps the cursor inside the new callout.
      if (!e.chain().focus().wrapIn('marqAlert', { settings: { kind: 'note' } }).run())
        e.chain().focus().insertContent({ type: 'marqAlert', attrs: { settings: { kind: 'note' } }, content: [{ type: 'paragraph' }] }).run();
    } },
    { id: 'code', label: 'Code', description: 'Markdown code fence', aliases: ['fence'], icon: 'code', group: 'Insert', run: e => e.chain().focus().toggleCodeBlock().run() },
    { id: 'image', label: 'Image', description: 'Upload an image', aliases: ['picture', 'photo'], icon: 'image', group: 'Insert', run: () => pickImage() },
    { id: 'table', label: 'Table', description: '3 × 3 table', aliases: ['grid'], icon: 'table', group: 'Insert', run: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'divider', label: 'Divider', description: 'Horizontal rule', aliases: ['hr', 'rule'], icon: 'minus', group: 'Insert', run: e => e.chain().focus().setHorizontalRule().run() },
    { id: 'source', label: 'Source', description: 'Raw custom markup', aliases: ['html', 'raw'], icon: 'braces', group: 'Insert', run: e => e.chain().focus().insertContent({ type: 'sourceBlock', attrs: { source: '<custom-element></custom-element>' } }).run() },
  ];
}

/** Content a theme block starts with, matching its declared body kind. */
export function blockContent(block: ThemeBlock) {
  // The built-in code block is a Markdown fence; the theme's definition gives its default language.
  if (block.id === 'code' && !block.template) return { type: 'codeBlock', attrs: { language: defaults(block.settings).language || null } };
  if (block.id === 'tabs' && !block.template) return { type: 'marqTabs', attrs: { settings: {} }, content: [newArea('Tab 1')] };
  const content = block.body === 'markdown' ? [{ type: 'paragraph' }] : block.body === 'areas' ? [newArea('Area 1')] : undefined;
  return { type: `theme_${block.id}`, attrs: { settings: defaults(block.settings) }, content };
}

/**
 * Merges built-in and theme commands into one registry. A theme command may
 * replace a built-in only when it declares `override`; the backend rejects
 * implicit collisions, and duplicates here keep the built-in.
 */
export function slashCommands(commands: Command[], blocks: ThemeBlock[], pickImage: () => void, extra: SlashItem[] = []): SlashItem[] {
  const items = [...builtInCommands(pickImage), ...extra];
  for (const command of commands) {
    const block = blocks.find(item => item.id === command.block);
    if (command.kind !== 'insert' || !block) continue;
    const item: SlashItem = { id: command.id, label: command.label, description: `${block.label} block`, aliases: command.aliases ?? [], icon: command.icon ?? 'blocks', group: 'Theme', run: e => e.chain().focus().insertContent(blockContent(block)).run() };
    const existing = items.findIndex(other => other.id === command.id);
    if (existing < 0) items.push(item);
    else if (command.override) items[existing] = item;
  }
  return items;
}

export function filterCommands(items: SlashItem[], query: string): SlashItem[] {
  const text = query.trim().toLowerCase();
  if (!text) return items;
  const score = (item: SlashItem) => {
    const names = [item.id, item.label.toLowerCase(), ...item.aliases];
    if (names.some(name => name === text)) return 0;
    if (names.some(name => name.startsWith(text))) return 1;
    if (names.some(name => name.includes(text))) return 2;
    return -1;
  };
  return items.map(item => [item, score(item)] as const).filter(([, s]) => s >= 0).sort((a, b) => a[1] - b[1]).map(([item]) => item);
}
