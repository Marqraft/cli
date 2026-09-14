import type { MenuItem, Page } from './types';

export function moveItem(items: MenuItem[], index: number, delta: number): MenuItem[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Where an item points now: a page link follows the page's current path. */
export function menuHref(item: MenuItem, pages: Page[]): string | null {
  if (item.page) return pages.find(page => page.id === item.page)?.path ?? null;
  return item.url ?? null;
}

/** Mirrors the server: http(s), mailto, or a path within the site. */
export function validMenuUrl(url: string): boolean {
  if (/\s/.test(url)) return false;
  if (/^\/(?!\/)/.test(url)) return true;
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol); } catch { return false; }
}
