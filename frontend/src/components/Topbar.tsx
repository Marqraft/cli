import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Eye, FileText, Loader2, Palette, PenLine, RotateCw, Settings2 } from 'lucide-react';
import marqraftIcon from '../assets/marqraft-icon.png';
import type { SaveState } from '../save';
import type { Doc, Project } from '../types';
import { validPath } from '../navigation';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type Props = {
  project: Project; doc: Doc; state: SaveState; mode: 'edit' | 'preview';
  setMode: (mode: 'edit' | 'preview') => void; retry: () => void; openTheme: () => void;
  applyMetadata: (field: 'title' | 'description' | 'path' | 'template' | 'draft' | 'version', value: string | boolean) => void;
};

function Status({ state, retry }: { state: SaveState; retry: () => void }) {
  const content = {
    saved: <><Check className="mq:size-3.5 mq:text-success" />Saved</>,
    saving: <><Loader2 className="mq:size-3.5 mq:animate-spin" />Saving…</>,
    pending: <><span className="mq:size-1.5 mq:rounded-full mq:bg-warning" />Unsaved</>,
    error: <><AlertTriangle className="mq:size-3.5 mq:text-destructive" />Not saved</>,
    conflict: <><AlertTriangle className="mq:size-3.5 mq:text-destructive" />Conflict</>,
  }[state];
  return <span className="mq:flex mq:items-center mq:gap-1.5">
    <span role="status" className="mq:flex mq:items-center mq:gap-1.5 mq:text-xs mq:text-muted-foreground">{content}</span>
    {state === 'error' && <Button variant="outline" size="sm" onClick={retry}><RotateCw />Retry</Button>}
  </span>;
}

export function Topbar({ project, doc, state, mode, setMode, retry, openTheme, applyMetadata }: Props) {
  const [path, setPath] = useState(doc.path);
  useEffect(() => setPath(doc.path), [doc.path]);
  const pathTaken = project.pages.some(page => page.id !== doc.id && page.path.toLowerCase() === path.toLowerCase());
  const pathError = !validPath(path) ? 'Use a path like /guide/intro/.' : pathTaken ? 'Another page uses this path.' : '';
  const commitPath = () => { if (!pathError && path !== doc.path) applyMetadata('path', path); };
  return (
    <header className="marq-ui mq:fixed mq:inset-x-0 mq:top-0 mq:z-[2147482500] mq:flex mq:h-12 mq:items-center mq:gap-2 mq:border-b mq:border-border mq:bg-background/95 mq:px-3 mq:backdrop-blur">
      <img src={marqraftIcon} alt="Marqraft" width={30} height={30} className="mq:mr-0.5 mq:size-[30px] mq:shrink-0 mq:rounded-[7px]" />
      <span className="mq:hidden mq:max-w-40 mq:truncate mq:text-sm mq:font-medium mq:md:inline">{project.config.title}</span>
      <span className="mq:hidden mq:text-muted-foreground mq:md:inline">/</span>
      <span className="mq:flex mq:min-w-0 mq:items-center mq:gap-2">
        <FileText className="mq:size-4 mq:shrink-0 mq:text-muted-foreground" />
        <span className="mq:truncate mq:text-sm">{doc.title || 'Untitled'}</span>
        {doc.draft && <Badge variant="warning">Draft</Badge>}
      </span>
      <Separator orientation="vertical" />
      <Status state={state} retry={retry} />
      <span className="mq:ml-auto mq:flex mq:items-center mq:gap-1">
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="sm"><Settings2 />Page</Button></PopoverTrigger>
          <PopoverContent align="end" className="mq:w-80">
            <div className="mq:flex mq:flex-col mq:gap-4">
              <div><div className="mq:text-sm mq:font-semibold">Page settings</div><div className="mq:font-mono mq:text-[11px] mq:text-muted-foreground">{doc.file}</div></div>
              <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-page-title">Title</Label>
                <Input id="marq-page-title" value={doc.title} onChange={event => applyMetadata('title', event.target.value)} /></div>
              <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-page-description">Description</Label>
                <Input id="marq-page-description" placeholder="None" value={doc.description ?? ''} onChange={event => applyMetadata('description', event.target.value)} />
                <p className="mq:text-xs mq:text-muted-foreground">Used for search results and link previews, and shown by themes that display one.</p></div>
              <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-page-path">URL path</Label>
                <Input id="marq-page-path" aria-invalid={Boolean(pathError)} className="mq:font-mono" value={path} onChange={event => setPath(event.target.value)} onBlur={commitPath} onKeyDown={event => { if (event.key === 'Enter') commitPath(); }} />
                <p className={pathError ? 'mq:text-xs mq:text-destructive' : 'mq:text-xs mq:text-muted-foreground'}>{pathError || 'Renaming or moving a page never changes its URL.'}</p></div>
              <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-page-version">Version</Label>
                <Input id="marq-page-version" className="mq:font-mono" placeholder="None" value={doc.version ?? ''} onChange={event => applyMetadata('version', event.target.value.trim())} />
                <p className="mq:text-xs mq:text-muted-foreground">Shown by themes that display a version. Pages without one use their collection's.</p></div>
              {project.theme.pageTemplates.length > 1 && <div className="mq:flex mq:flex-col mq:gap-1.5"><Label>Template</Label>
                <Select value={doc.template} onValueChange={value => applyMetadata('template', value)}>
                  <SelectTrigger aria-label="Template"><SelectValue /></SelectTrigger>
                  <SelectContent>{project.theme.pageTemplates.map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="mq:text-xs mq:text-muted-foreground">Reload to see a template change.</p></div>}
              <div className="mq:flex mq:items-center mq:justify-between"><Label htmlFor="marq-page-draft">Draft</Label>
                <Switch id="marq-page-draft" aria-label="Draft" checked={doc.draft} onCheckedChange={checked => applyMetadata('draft', checked)} /></div>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" onClick={openTheme}><Palette />Theme</Button>
        <Separator orientation="vertical" />
        {mode === 'edit'
          ? <Button variant="ghost" size="sm" onClick={() => setMode('preview')}><Eye />Preview</Button>
          : <Button variant="ghost" size="sm" onClick={() => setMode('edit')}><PenLine />Edit</Button>}
        {doc.draft
          ? <Button size="sm" onClick={() => applyMetadata('draft', false)}>Publish</Button>
          : <Button variant="outline" size="sm" onClick={() => applyMetadata('draft', true)}>Unpublish</Button>}
      </span>
    </header>
  );
}

/** The bar over a generated page: the same frame as the editor's, with nothing to edit. */
export function ReadOnlyBar({ project, title }: { project: Project; title: string }) {
  return (
    <header className="marq-ui mq:fixed mq:inset-x-0 mq:top-0 mq:z-[2147482500] mq:flex mq:h-12 mq:items-center mq:gap-2 mq:border-b mq:border-border mq:bg-background/95 mq:px-3 mq:backdrop-blur">
      <img src={marqraftIcon} alt="Marqraft" width={30} height={30} className="mq:mr-0.5 mq:size-[30px] mq:shrink-0 mq:rounded-[7px]" />
      <span className="mq:hidden mq:max-w-40 mq:truncate mq:text-sm mq:font-medium mq:md:inline">{project.config.title}</span>
      <span className="mq:hidden mq:text-muted-foreground mq:md:inline">/</span>
      <span className="mq:flex mq:min-w-0 mq:items-center mq:gap-2">
        <FileText className="mq:size-4 mq:shrink-0 mq:text-muted-foreground" />
        <span className="mq:truncate mq:text-sm">{title || 'Untitled'}</span>
        <Badge variant="secondary">Generated · read-only</Badge>
      </span>
    </header>
  );
}
