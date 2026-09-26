import type { Field, Theme } from './types';

export type SettingSection = { title: string | null; fields: Field[] };
export type SettingPage = { id: string; label: string; icon?: string; sections: SettingSection[] };

const fallbackPage = { id: 'general', label: 'General' };

/** Groups theme settings into sidebar pages and sections. Fields without a
 *  `page` fall into the first declared page (or General); fields naming an
 *  undeclared page get their own page labeled with that id. */
export function settingPages(theme: Theme): SettingPage[] {
  const declared = theme.settingsPages ?? [];
  const pages = new Map<string, SettingPage>();
  const idOf = (field: Field) => field.page ?? declared[0]?.id ?? fallbackPage.id;
  for (const field of theme.settings) {
    const id = idOf(field);
    let page = pages.get(id);
    if (!page) {
      const def = declared.find(entry => entry.id === id);
      page = { id, label: def?.label ?? (declared.length > 0 ? id : fallbackPage.label), icon: def?.icon, sections: [] };
      pages.set(id, page);
    }
    const section = page.sections.find(entry => entry.title === (field.section ?? null));
    if (section) section.fields.push(field);
    else page.sections.push({ title: field.section ?? null, fields: [field] });
  }
  const ordered = [...declared.map(def => pages.get(def.id)).filter((page): page is SettingPage => Boolean(page))];
  for (const page of pages.values()) if (!ordered.includes(page)) ordered.push(page);
  return ordered.length > 0 ? ordered : [{ ...fallbackPage, sections: [] }];
}

/** Narrows pages to a search query. A page-label match keeps the whole page;
 *  otherwise only matching fields (by label, name, or section) survive. */
export function filterSettingPages(pages: SettingPage[], query: string): SettingPage[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return pages;
  const result: SettingPage[] = [];
  for (const page of pages) {
    if (page.label.toLowerCase().includes(needle)) { result.push(page); continue; }
    const sections = page.sections.map(section => ({
      ...section,
      fields: section.fields.filter(field =>
        field.label.toLowerCase().includes(needle) || field.name.toLowerCase().includes(needle) ||
        (section.title?.toLowerCase().includes(needle) ?? false)),
    })).filter(section => section.fields.length > 0);
    if (sections.length > 0) result.push({ ...page, sections });
  }
  return result;
}
