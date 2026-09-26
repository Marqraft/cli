import type { JSONContent } from '@tiptap/core';

export const escapeHTML = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const attributes = (value: Record<string, unknown>) => Object.entries(value).map(([key, val]) => ` ${key}="${escapeHTML(String(val ?? ''))}"`).join('');
const plain = (value: string) => value.replace(/([\\`*_\[\]<>])/g, '\\$1');

function inline(node: JSONContent): string {
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'image') return `![${plain(node.attrs?.alt ?? '')}](${node.attrs?.src ?? ''})`;
  let text = plain(node.text ?? '');
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') text = `**${text}**`;
    if (mark.type === 'italic') text = `*${text}*`;
    if (mark.type === 'strike') text = `~~${text}~~`;
    if (mark.type === 'code') {
      const raw = node.text ?? '';
      const fence = '`'.repeat(Math.max(1, ...[...raw.matchAll(/`+/g)].map(m => m[0].length + 1)));
      text = `${fence}${raw.includes('`') ? ' ' : ''}${raw}${raw.includes('`') ? ' ' : ''}${fence}`;
    }
    if (mark.type === 'link') text = `[${text}](${mark.attrs?.href ?? ''})`;
  }
  return text;
}

export function serialize(node: JSONContent): string {
  if (node.attrs?.original != null && node.attrs?.baseline === fingerprint(node)) return node.attrs.original;
  const children = node.content ?? [];
  const prose = () => children.map(inline).join('');
  const blocks = () => children.map(serialize).join('\n\n');
  switch (node.type) {
    case 'doc': return blocks() + '\n';
    case 'paragraph': return prose();
    case 'heading': return '#'.repeat(node.attrs?.level ?? 2) + ' ' + prose();
    case 'blockquote': return blocks().split('\n').map(line => '> ' + line).join('\n');
    case 'marqAlert': {
      const kind = String(node.attrs?.settings?.kind ?? 'note').toUpperCase();
      const known = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'].includes(kind) ? kind : 'NOTE';
      return [`[!${known}]`, ...blocks().split('\n')].map(line => line ? '> ' + line : '>').join('\n');
    }
    case 'bulletList': case 'orderedList': return children.map((item, index) => {
      const marker = node.type === 'orderedList' ? `${(node.attrs?.start ?? 1) + index}. ` : '- ';
      return serialize(item).split('\n').map((line, n) => (n ? ' '.repeat(marker.length) : marker) + line).join('\n');
    }).join('\n');
    case 'listItem': return blocks();
    case 'horizontalRule': return '---';
    case 'image': return inline(node);
    case 'codeBlock': {
      const text = children.map(n => n.text ?? '').join('');
      const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1)));
      // The language first, as GitHub reads it; filename and caption after it, when set.
      const extras = Object.fromEntries((['filename', 'caption'] as const).filter(key => node.attrs?.[key]).map(key => [key, node.attrs![key]]));
      return `${fence}${node.attrs?.language ?? ''}${attributes(extras)}\n${text}\n${fence}`;
    }
    case 'marqCode': return `<marqraft-code${attributes(node.attrs?.settings ?? {})}>${escapeHTML(children.map(n => n.text ?? '').join(''))}</marqraft-code>`;
    case 'marqTabs': return `<marqraft-tabs${attributes(node.attrs?.settings ?? {})}>\n${children.map(serialize).join('\n')}\n</marqraft-tabs>`;
    case 'marqArea': return `<marqraft-area${attributes(node.attrs?.settings ?? {})}>\n${blocks()}\n</marqraft-area>`;
    case 'sourceBlock': return node.attrs?.source ?? '';
    case 'table': {
      const rows = children.map(row => '| ' + (row.content ?? []).map(cell => serialize(cell).replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ') + ' |');
      if (rows.length) rows.splice(1, 0, '| ' + (children[0].content ?? []).map(() => '---').join(' | ') + ' |');
      return rows.join('\n');
    }
    case 'tableHeader': case 'tableCell': return blocks();
    default: {
      if (node.type?.startsWith('theme_')) {
        const tag = node.attrs?.element;
        if (!/^[a-z][a-z0-9-]*-[a-z0-9-]+$/.test(tag)) throw new Error('Invalid theme element name');
        const body = node.attrs?.bodyKind === 'literal' ? escapeHTML(children.map(n => n.text ?? '').join('')) : node.attrs?.bodyKind === 'none' ? '' : '\n' + blocks() + '\n';
        return `<${tag}${attributes(node.attrs?.settings ?? {})}>${body}</${tag}>`;
      }
      throw new Error(`Cannot serialize unsupported editor node: ${node.type}`);
    }
  }
}

export function fingerprint(node: JSONContent): string {
  const copy = structuredClone(node);
  const strip = (item: JSONContent) => {
    if (item.attrs) { delete item.attrs.original; delete item.attrs.baseline; }
    item.content?.forEach(strip);
  };
  strip(copy); return JSON.stringify(copy);
}
export function preserveSlices(node: JSONContent): JSONContent {
  const copy = structuredClone(node);
  copy.content = copy.content?.map(preserveSlices);
  if (copy.attrs?.original != null) copy.attrs.baseline = fingerprint(copy);
  return copy;
}

const optionalFields = new Set(['version', 'description']);

export function replaceBody(source: string, body: string, metadata: Record<string, string | boolean>): string {
  const match = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/);
  if (!match) throw new Error('The document has no valid frontmatter');
  // An empty editor still holds one empty paragraph; that must not rewrite an empty body.
  const existing = source.slice(match[0].length);
  if (body.trim() === '' && existing.trim() === '') body = existing;
  const lines = match[2].split(/\r?\n/);
  for (const [key, value] of Object.entries(metadata)) {
    const line = `${key}: ${JSON.stringify(value)}`;
    const index = lines.findIndex(item => item.startsWith(`${key}:`));
    // An optional field left empty is not written: no `version: ""` on every page.
    if (value === '' && optionalFields.has(key)) { if (index >= 0) lines.splice(index, 1); }
    else if (index < 0) lines.push(line); else lines[index] = line;
  }
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
