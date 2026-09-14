import type { Nav } from './types';

export type Placement = 'before' | 'after' | 'inside';

const clone = (tree: Nav[]): Nav[] => structuredClone(tree);

export function contains(node: Nav, id: string): boolean {
  return node.id === id || node.children.some(child => contains(child, id));
}

export function find(tree: Nav[], id: string): Nav | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = find(node.children, id);
    if (found) return found;
  }
  return undefined;
}

/** Returns the sibling list holding `id` (the root list for top-level pages). */
export function siblingsOf(tree: Nav[], id: string): Nav[] | undefined {
  if (tree.some(node => node.id === id)) return tree;
  for (const node of tree) {
    const found = siblingsOf(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function parentOf(tree: Nav[], id: string, parent: Nav | null = null): Nav | null | undefined {
  for (const node of tree) {
    if (node.id === id) return parent;
    const found = parentOf(node.children, id, node);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Moves a page relative to another. Dropping a page into its own subtree is a no-op. */
export function moveNode(tree: Nav[], id: string, target: string, placement: Placement): Nav[] {
  const moving = find(tree, id);
  if (!moving || id === target || contains(moving, target)) return tree;
  const next = clone(tree);
  const from = siblingsOf(next, id)!;
  const [node] = from.splice(from.findIndex(item => item.id === id), 1);
  if (placement === 'inside') {
    find(next, target)!.children.push(node);
    return next;
  }
  const to = siblingsOf(next, target)!;
  const index = to.findIndex(item => item.id === target);
  to.splice(placement === 'before' ? index : index + 1, 0, node);
  return next;
}

export function shift(tree: Nav[], id: string, action: 'up' | 'down' | 'indent' | 'outdent'): Nav[] {
  const siblings = siblingsOf(tree, id);
  if (!siblings) return tree;
  const index = siblings.findIndex(item => item.id === id);
  if (action === 'up') return index > 0 ? moveNode(tree, id, siblings[index - 1].id, 'before') : tree;
  if (action === 'down') return index + 1 < siblings.length ? moveNode(tree, id, siblings[index + 1].id, 'after') : tree;
  if (action === 'indent') return index > 0 ? moveNode(tree, id, siblings[index - 1].id, 'inside') : tree;
  const parent = parentOf(tree, id);
  return parent ? moveNode(tree, id, parent.id, 'after') : tree;
}

export function slugify(title: string): string {
  return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Suggests a URL below the parent page; authors may still edit it explicitly. */
export function suggestPath(parentPath: string, title: string, taken: string[]): string {
  const base = (parentPath.endsWith('/') ? parentPath : parentPath + '/') + (slugify(title) || 'page');
  const used = new Set(taken.map(path => path.toLowerCase()));
  let candidate = `${base}/`, counter = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base}-${counter++}/`;
  return candidate;
}

export function validPath(path: string): boolean {
  return path === '/' || /^\/(?!__marqraft)([A-Za-z0-9_-]+\/)+$/.test(path);
}

/** The top-level entry (collection) whose subtree holds the page. */
export function collectionOf(tree: Nav[], id: string): Nav | undefined {
  return tree.find(node => contains(node, id));
}

/** Appends a page that is not yet in the tree under a parent, or at the top level. */
export function addPage(tree: Nav[], id: string, parent?: string): Nav[] {
  if (find(tree, id)) return tree;
  const next = clone(tree);
  const node = { id, children: [] };
  const target = parent ? find(next, parent) : undefined;
  if (target) target.children.push(node); else next.push(node);
  return next;
}
