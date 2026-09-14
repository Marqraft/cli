import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MenuItem, Project } from '../types';
import { menuHref, moveItem, validMenuUrl } from '../menu';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';

type Props = {
  project: Project; menuId: string; currentId: string;
  save: (menus: Record<string, MenuItem[]>) => Promise<void>;
  navigate: (path: string) => void;
};

/**
 * A theme menu edited where it is rendered. The list keeps the theme's markup
 * (ul.marq-menu > li > a), so the header looks as published; controls float
 * over each link and are hidden in preview.
 */
export function MenuEditor({ project, menuId, currentId, save, navigate }: Props) {
  const items = project.menus?.[menuId] ?? [];
  const name = project.theme.menus?.find(menu => menu.id === menuId)?.label ?? 'Menu';
  const update = (next: MenuItem[]) => save({ ...project.menus, [menuId]: next });
  return (
    <ul className="marq-menu">
      {items.map((item, index) => {
        const href = menuHref(item, project.pages);
        const page = item.page ? project.pages.find(candidate => candidate.id === item.page) : undefined;
        return (
          <li key={`${index}-${item.label}`} className="marq-menu-item mq:relative">
            <a href={href ?? '#'} aria-current={page && page.id === currentId ? 'page' : undefined}
              onClick={event => { if (!page || event.metaKey || event.ctrlKey) return; event.preventDefault(); navigate(page.path); }}>
              {item.label}{page?.draft && <small className="marq-draft">Draft</small>}
            </a>
            <span className="marq-ui marq-menu-actions marq-authoring-only mq:absolute mq:-right-1.5 mq:-top-2 mq:z-10">
              <ItemPopover project={project} title={`Edit “${item.label}”`} initial={item}
                trigger={<Button variant="outline" size="icon-sm" className="mq:size-5 mq:rounded-full mq:[&_svg]:size-3" aria-label={`Edit ${item.label} link`}><Pencil /></Button>}
                onSubmit={next => update(items.map((other, position) => position === index ? next : other))}
                extra={close => <div className="mq:flex mq:gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Move left" disabled={index === 0} onClick={() => { void update(moveItem(items, index, -1)); close(); }}><ArrowLeft /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move right" disabled={index === items.length - 1} onClick={() => { void update(moveItem(items, index, 1)); close(); }}><ArrowRight /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove link" onClick={() => { void update(items.filter((_, position) => position !== index)); close(); }}><Trash2 /></Button>
                </div>} />
            </span>
          </li>
        );
      })}
      <li className="marq-ui marq-authoring-only mq:flex mq:items-center">
        <ItemPopover project={project} title={`Add to ${name}`} submitLabel="Add link"
          initial={{ label: '', page: project.pages[0]?.id }}
          trigger={<Button variant="ghost" size="icon-sm" aria-label={`Add ${name} link`}><Plus /></Button>}
          onSubmit={next => update([...items, next])} />
      </li>
    </ul>
  );
}

function ItemPopover({ project, title, initial, trigger, onSubmit, extra, submitLabel = 'Save' }: {
  project: Project; title: string; initial: MenuItem; trigger: React.ReactElement; submitLabel?: string;
  onSubmit: (item: MenuItem) => Promise<void> | void; extra?: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(initial.label);
  const [kind, setKind] = useState<'page' | 'url'>(initial.url !== undefined && !initial.page ? 'url' : 'page');
  const [page, setPage] = useState(initial.page ?? project.pages[0]?.id ?? '');
  const [url, setUrl] = useState(initial.url ?? '');
  const [error, setError] = useState('');
  const reset = () => { setLabel(initial.label); setKind(initial.url !== undefined && !initial.page ? 'url' : 'page'); setPage(initial.page ?? project.pages[0]?.id ?? ''); setUrl(initial.url ?? ''); setError(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const pageTitle = project.pages.find(candidate => candidate.id === page)?.title ?? '';
    const text = label.trim() || (kind === 'page' ? pageTitle : '');
    if (!text) return setError('Give the link a label.');
    if (kind === 'url' && !validMenuUrl(url.trim())) return setError('Use https://…, mailto:… or a path like /prelude/.');
    if (kind === 'page' && !page) return setError('Choose a page.');
    try { await onSubmit(kind === 'page' ? { label: text, page } : { label: text, url: url.trim() }); setOpen(false); }
    catch (failure) { setError(String((failure as Error).message ?? failure)); }
  };
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) reset(); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="mq:w-72">
        <form onSubmit={submit} className="mq:flex mq:flex-col mq:gap-3" aria-label={title}>
          <div className="mq:flex mq:items-center mq:justify-between mq:gap-2"><span className="mq:text-sm mq:font-semibold">{title}</span>{extra?.(() => setOpen(false))}</div>
          <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-menu-label">Label</Label>
            <Input id="marq-menu-label" aria-label="Link label" autoFocus value={label} placeholder={kind === 'page' ? project.pages.find(candidate => candidate.id === page)?.title : 'Label'} onChange={event => setLabel(event.target.value)} /></div>
          <div className="mq:grid mq:grid-cols-2 mq:gap-1 mq:rounded-md mq:bg-muted mq:p-0.5" role="radiogroup" aria-label="Link to">
            {(['page', 'url'] as const).map(option => <button key={option} type="button" role="radio" aria-checked={kind === option}
              className={cn('mq:rounded-sm mq:py-1 mq:text-xs mq:font-medium', kind === option ? 'mq:bg-background mq:shadow-xs' : 'mq:text-muted-foreground')}
              onClick={() => setKind(option)}>{option === 'page' ? 'Page' : 'URL'}</button>)}
          </div>
          {kind === 'page'
            ? <Select value={page} onValueChange={setPage}><SelectTrigger aria-label="Linked page"><SelectValue placeholder="Choose a page" /></SelectTrigger>
                <SelectContent>{project.pages.map(candidate => <SelectItem key={candidate.id} value={candidate.id}>{candidate.title} <span className="mq:text-muted-foreground">{candidate.path}</span></SelectItem>)}</SelectContent></Select>
            : <Input aria-label="Link URL" className="mq:font-mono" placeholder="https://kex.run" value={url} onChange={event => setUrl(event.target.value)} />}
          {error && <p role="alert" className="mq:text-xs mq:text-destructive">{error}</p>}
          <div className="mq:flex mq:justify-end mq:gap-2"><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" size="sm">{submitLabel}</Button></div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
