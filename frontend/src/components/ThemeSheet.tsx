import React, { useEffect, useState } from 'react';
import type { Project } from '../types';
import { Fields } from './Fields';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet';
import { Separator } from './ui/separator';

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

export function ThemeSheet({ project, open, setOpen, save, onError }: { project: Project; open: boolean; setOpen: (open: boolean) => void; save: (settings: Record<string, string>, favicon: string) => Promise<void>; onError: (message: string) => void }) {
  const [values, setValues] = useState(project.config.settings);
  const [favicon, setFavicon] = useState(project.config.favicon ?? '');
  const [busy, setBusy] = useState(false);
  const [originals] = useState(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map(link => link.cloneNode() as HTMLLinkElement));
  const reset = () => { setValues(project.config.settings); preview(project, project.config.settings); setFavicon(project.config.favicon ?? ''); previewFavicon(originals, project.config.favicon ?? ''); };
  useEffect(() => { if (!open) reset(); }, [open, project]);
  const dirty = JSON.stringify(values) !== JSON.stringify(project.config.settings) || favicon !== (project.config.favicon ?? '');
  // Built-in themes are referenced by name; project and external themes by path.
  const builtIn = !String(project.config.theme ?? '').includes('/');
  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent aria-describedby={undefined}>
        <div><SheetTitle>Theme</SheetTitle>
          <SheetDescription>{project.theme.name} · {builtIn ? 'built-in theme' : `theme at ${project.config.theme}`}</SheetDescription></div>
        <Separator />
        <Fields fields={project.theme.settings} value={values} onError={onError} change={(key, value) => { const next = { ...values, [key]: value }; setValues(next); preview(project, next); }} />
        <Separator />
        <div className="mq:flex mq:flex-col mq:gap-3">
          <div><div className="mq:text-sm mq:font-semibold">Site</div>
            <div className="mq:text-xs mq:text-muted-foreground">Kept with this site when the theme changes. Leave the favicon empty to use the theme's.</div></div>
          <Fields fields={faviconField} value={{ favicon }} onError={onError} change={(_, value) => { setFavicon(value); previewFavicon(originals, value); }} />
          {project.uploads && <p className="mq:text-xs mq:text-muted-foreground">Uploaded images go to <code className="mq:font-mono">public/{project.uploads}/</code>. Change <code className="mq:font-mono">uploads.images</code> in marqraft.jsonc to use another folder.</p>}
        </div>
        <div className="mq:mt-auto mq:flex mq:flex-col mq:gap-3">
          {builtIn && <p className="mq:rounded-md mq:bg-muted mq:p-3 mq:text-xs mq:text-muted-foreground">Settings are stored with your site, so they survive theme upgrades. To change templates, run <code className="mq:font-mono">marq eject-theme</code>.</p>}
          <div className="mq:flex mq:justify-end mq:gap-2">
            <Button variant="ghost" disabled={!dirty} onClick={reset}>Reset</Button>
            <Button disabled={!dirty || busy} onClick={async () => { setBusy(true); try { await save(Object.fromEntries(project.theme.settings.map(field => [field.name, values[field.name] ?? field.default ?? ''])), favicon); } catch (error) { onError(String((error as Error).message)); } finally { setBusy(false); } }}>Save theme settings</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
