export type Field = { name: string; label: string; type: string; default?: string; options?: string[]; min?: number; max?: number; unit?: string; page?: string; section?: string };
export type SettingsPageDef = { id: string; label: string; icon?: string };
export type BodyKind = 'none' | 'literal' | 'markdown' | 'areas';
export type ThemeBlock = { id: string; element: string; label: string; body: BodyKind; template?: string; editorHTML?: string; settings: Field[] };
export type Command = { id: string; label: string; aliases?: string[]; icon?: string; kind: string; block?: string; operation?: string; regions?: string[]; override?: boolean };
export type Page = { id: string; title: string; path: string; draft: boolean; template: string; version?: string; revision: string; file: string };
export type Doc = Page & { source: string; html: string; body: string };
export type Nav = { id: string; children: Nav[] };
export type MenuItem = { label: string; page?: string; url?: string };
export type Theme = { name: string; settings: Field[]; settingsPages?: SettingsPageDef[]; blocks: ThemeBlock[]; commands: Command[]; pageTemplates: { id: string; label: string }[]; menus?: { id: string; label: string }[] };
export type Project = {
  project: string; pages: Page[]; navigation: Nav[];
  /** Collections a mount generates: shown in the header, never edited or saved. */
  generatedCollections?: { id: string; title: string; path: string }[];
  navigationRevision: string; settingsRevision: string; themeRevision: string; themeName: string;
  menus: Record<string, MenuItem[]>; menusRevision: string;
  config: { title: string; theme?: string; favicon?: string; settings: Record<string, string> };
  uploads?: string;
  theme: Theme;
};
