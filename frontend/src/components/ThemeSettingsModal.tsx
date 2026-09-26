import React, { useEffect, useMemo, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Globe, Image, Palette, Search, SlidersHorizontal, Type, X } from 'lucide-react';
import type { Project } from '../types';
import { filterSettingPages, settingPages } from '../settings';
import { Fields } from './Fields';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';

const pageIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  palette: Palette, type: Type, image: Image, globe: Globe, sliders: SlidersHorizontal,
};

function PageIcon({ name, className }: { name?: string; className?: string }) {
  const Icon: React.ComponentType<{ className?: string }> = (name ? pageIcons[name] : undefined) ?? SlidersHorizontal;
  return <Icon className={className} />;
}

const faviconField = [{ name: 'favicon', label: 'Favicon', type: 'image' }];

/** Shows a candidate favicon without saving; the theme's own icon links are restored on reset. */
function previewFavicon(originals: HTMLLinkElement[], href: string) {
  document.querySelectorAll('link[rel~="icon"]').forEach(link => link.remove());
  if (!href) { originals.forEach(link => document.head.append(link.cloneNode())); return; }
  const link = document.createElement('link'); link.rel = 'icon'; link.href = href; document.head.append(link);
}

function preview(project: Project, values: Record<string, string>) {
  for (const field of project.theme.settings) {
    const value = values[field.name] ?? field.default ?? '';
    if (field.type === 'color') document.documentElement.style.setProperty(`--marq-${field.name}`, value);
    if (field.type === 'number') document.documentElement.style.setProperty(`--marq-${field.name}`, `${value}${field.unit ?? 'px'}`);
  }
}

/** macOS-style theme settings: sidebar pages, sections, search, and live preview. */
export function ThemeSettingsModal({ project, open, setOpen, save, onError }: { project: Project; open: boolean; setOpen: (open: boolean) => void; save: (settings: Record<string, string>, favicon: string) => Promise<void>; onError: (message: string) => void }) {
  const [values, setValues] = useState(project.config.settings);
  const [favicon, setFavicon] = useState(project.config.favicon ?? '');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [originals] = useState(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map(link => link.cloneNode() as HTMLLinkElement));
  const reset = () => { setValues(project.config.settings); preview(project, project.config.settings); setFavicon(project.config.favicon ?? ''); previewFavicon(originals, project.config.favicon ?? ''); setQuery(''); setSelected(null); };
  useEffect(() => { if (!open) reset(); }, [open, project]);
  const dirty = JSON.stringify(values) !== JSON.stringify(project.config.settings) || favicon !== (project.config.favicon ?? '');
  const builtIn = !String(project.config.theme ?? '').includes('/');

  const pages = useMemo(() => {
    const themePages = settingPages(project.theme);
    return [...themePages, { id: 'site', label: 'Site', icon: 'globe', sections: [{ title: null as string | null, fields: faviconField }] }];
  }, [project.theme]);
  const visible = useMemo(() => filterSettingPages(pages, query), [pages, query]);
  const current = visible.find(page => page.id === selected) ?? visible[0];
  const change = (key: string, value: string) => { const next = { ...values, [key]: value }; setValues(next); preview(project, next); };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="marq-ui mq:fixed mq:inset-0 mq:z-[2147483000] mq:bg-black/40" />
        <DialogPrimitive.Content data-slot="theme-settings" aria-label="Theme settings" className="marq-ui mq:fixed mq:left-1/2 mq:top-1/2 mq:z-[2147483001] mq:grid mq:max-h-[90vh] mq:w-[min(960px,calc(100vw-32px))] mq:-translate-x-1/2 mq:-translate-y-1/2 mq:grid-rows-[auto_1fr_auto] mq:overflow-hidden mq:rounded-xl mq:border mq:border-border mq:bg-background mq:shadow-2xl mq:outline-none">
          <div className="mq:flex mq:items-start mq:justify-between mq:gap-4 mq:p-6 mq:pb-4">
            <div><DialogPrimitive.Title className="mq:text-lg mq:font-semibold">Theme settings</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mq:text-sm mq:text-muted-foreground">{project.theme.name} · {builtIn ? 'built-in theme' : `theme at ${project.config.theme}`}</DialogPrimitive.Description></div>
            <DialogPrimitive.Close className="mq:rounded-sm mq:opacity-70 mq:hover:opacity-100" aria-label="Close panel"><X className="mq:size-4" /></DialogPrimitive.Close>
          </div>
          <div className="mq:grid mq:min-h-0 mq:grid-cols-[220px_1fr]">
            <div className="mq:flex mq:min-h-0 mq:flex-col mq:gap-1 mq:border-r mq:border-border mq:p-3">
              <div className="mq:relative mq:mb-2">
                <Search className="mq:pointer-events-none mq:absolute mq:left-2.5 mq:top-1/2 mq:size-4 mq:-translate-y-1/2 mq:text-muted-foreground" />
                <Input aria-label="Search settings" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} className="mq:pl-8" />
              </div>
              <div role="listbox" aria-label="Settings pages" className="mq:flex mq:min-h-0 mq:flex-col mq:gap-0.5 mq:overflow-auto">
                {visible.map(page => (
                  <button key={page.id} role="option" aria-selected={current?.id === page.id} onClick={() => setSelected(page.id)}
                    className={cn('mq:flex mq:items-center mq:gap-2.5 mq:rounded-md mq:px-2.5 mq:py-2 mq:text-sm mq:text-left mq:hover:bg-muted', current?.id === page.id && 'mq:bg-muted mq:font-medium')}>
                    <PageIcon name={page.icon} className="mq:size-4 mq:shrink-0 mq:text-muted-foreground" />{page.label}
                  </button>
                ))}
                {visible.length === 0 && <p className="mq:px-2.5 mq:py-2 mq:text-sm mq:text-muted-foreground">No settings match “{query}”.</p>}
              </div>
              {builtIn && <p className="mq:mt-auto mq:rounded-md mq:bg-muted mq:p-3 mq:text-xs mq:text-muted-foreground">Settings are stored with your site, so they survive theme upgrades. To change templates, run <code className="mq:font-mono">marq eject-theme</code>.</p>}
            </div>
            <div className="mq:min-h-0 mq:overflow-auto mq:p-6 mq:pt-2">
              {current && <>
                <h2 className="mq:mb-4 mq:text-base mq:font-semibold">{current.label}</h2>
                {current.id === 'site' ? <>
                  <Fields fields={faviconField} value={{ favicon }} onError={onError} change={(_, value) => { setFavicon(value); previewFavicon(originals, value); }} />
                  <p className="mq:mt-3 mq:text-xs mq:text-muted-foreground">Kept with this site when the theme changes. Leave the favicon empty to use the theme's.</p>
                  {project.uploads && <p className="mq:mt-2 mq:text-xs mq:text-muted-foreground">Uploaded images go to <code className="mq:font-mono">public/{project.uploads}/</code>. Change <code className="mq:font-mono">uploads.images</code> in marqraft.jsonc to use another folder.</p>}
                </> : current.sections.map((section, index) => (
                  <div key={section.title ?? `ungrouped-${index}`} className="mq:mb-6">
                    {section.title && <><h3 className="mq:mb-3 mq:text-sm mq:font-semibold">{section.title}</h3><Separator className="mq:mb-3" /></>}
                    <Fields fields={section.fields} value={values} onError={onError} change={change} />
                  </div>
                ))}
              </>}
            </div>
          </div>
          <div className="mq:flex mq:justify-end mq:gap-2 mq:border-t mq:border-border mq:p-4">
            <Button variant="ghost" disabled={!dirty} onClick={reset}>Reset</Button>
            <Button disabled={!dirty || busy} onClick={async () => { setBusy(true); try { await save(Object.fromEntries(project.theme.settings.map(field => [field.name, values[field.name] ?? field.default ?? ''])), favicon); } catch (error) { onError(String((error as Error).message)); } finally { setBusy(false); } }}>Save theme settings</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
