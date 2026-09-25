import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CornerDownRight, Eye, EyeOff, IndentDecrease, IndentIncrease, MoreHorizontal, Plus } from 'lucide-react';
import type { Nav, Page, Project } from '../types';
import { addPage, find, moveNode, shift, suggestPath, validPath, type Placement } from '../navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { cn } from '../lib/utils';

type Props = {
  project: Project; currentId: string;
  /** Show and edit only the pages inside this collection (a top-level navigation entry). */
  root?: string;
  saveNavigation: (tree: Nav[]) => Promise<void>;
  createPage: (input: { title: string; path: string; template: string; parent: string }) => Promise<void>;
  navigate: (path: string) => void;
  setDraft: (id: string, draft: boolean) => void;
};

/**
 * The theme's own navigation list, made editable in place: the markup keeps the
 * theme's ul/li/a structure so its CSS applies, with controls layered on top.
 */
export function NavigationTree({ project, currentId, root, saveNavigation, createPage, navigate, setDraft }: Props) {
  const rootPage = root ? project.pages.find(page => page.id === root) : undefined;
  const nodes = root ? find(project.navigation, root)?.children ?? [] : project.navigation;
  const [adding, setAdding] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; placement: Placement } | null>(null);
  const listed = new Set<string>();
  const collect = (nodes: Nav[]) => nodes.forEach(node => { listed.add(node.id); collect(node.children); });
  collect(project.navigation);
  // The home page (/) is never in the navigation, so it is not "missing" from it.
  const unlisted = project.pages.filter(page => !listed.has(page.id) && page.path !== '/');

  const apply = (tree: Nav[]) => { if (tree !== project.navigation) void saveNavigation(tree); };
  const placementFor = (event: React.DragEvent, element: HTMLElement): Placement => {
    const box = element.getBoundingClientRect(), offset = (event.clientY - box.top) / box.height;
    return offset < 0.3 ? 'before' : offset > 0.7 ? 'after' : 'inside';
  };

  const item = (node: Nav, index: number, siblings: Nav[], depth: number): React.ReactNode => {
    const page = project.pages.find(candidate => candidate.id === node.id);
    if (!page) return null;
    const isDrop = drop?.id === node.id;
    return (
      <li key={node.id}>
        <div
          className={cn('marq-nav-row mq:relative', isDrop && `marq-nav-drop-${drop!.placement}`, dragging === node.id && 'mq:opacity-40')}
          draggable onDragStart={event => { event.dataTransfer.setData('text/x-marq-page', node.id); event.dataTransfer.effectAllowed = 'move'; setDragging(node.id); }}
          onDragEnd={() => { setDragging(null); setDrop(null); }}
          onDragOver={event => { if (!dragging || dragging === node.id) return; event.preventDefault(); setDrop({ id: node.id, placement: placementFor(event, event.currentTarget) }); }}
          onDragLeave={() => setDrop(current => current?.id === node.id ? null : current)}
          onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/x-marq-page'); if (id && drop) apply(moveNode(project.navigation, id, node.id, drop.placement)); setDragging(null); setDrop(null); }}>
          <a href={page.path} draggable={false} aria-current={page.id === currentId ? 'page' : undefined} className="mq:pr-9"
            onClick={event => { if (event.metaKey || event.ctrlKey) return; event.preventDefault(); navigate(page.path); }}>
            {page.title || 'Untitled'}{page.draft && <small className="marq-draft">Draft</small>}
          </a>
          <div className="marq-ui marq-nav-actions marq-authoring-only mq:absolute mq:right-1 mq:top-1/2 mq:-translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="mq:size-6" aria-label={`${page.title} options`}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right">
                <DropdownMenuItem onSelect={() => setAdding(node.id)}><CornerDownRight />Add subpage</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDraft(page.id, !page.draft)}>{page.draft ? <><Eye />Publish</> : <><EyeOff />Unpublish</>}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={index === 0} onSelect={() => apply(shift(project.navigation, node.id, 'up'))}><ArrowUp />Move up</DropdownMenuItem>
                <DropdownMenuItem disabled={index === siblings.length - 1} onSelect={() => apply(shift(project.navigation, node.id, 'down'))}><ArrowDown />Move down</DropdownMenuItem>
                <DropdownMenuItem disabled={index === 0} onSelect={() => apply(shift(project.navigation, node.id, 'indent'))}><IndentIncrease />Nest under previous</DropdownMenuItem>
                <DropdownMenuItem disabled={depth === 0} onSelect={() => apply(shift(project.navigation, node.id, 'outdent'))}><IndentDecrease />Move out a level</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {(node.children.length > 0 || adding === node.id) && <ul>
          {node.children.map((child, childIndex) => item(child, childIndex, node.children, depth + 1))}
          {adding === node.id && <li><NewPageForm project={project} parent={page} onCancel={() => setAdding(null)} onCreate={async input => { await createPage(input); setAdding(null); }} /></li>}
        </ul>}
      </li>
    );
  };

  return (
    <>
      <ul>{nodes.map((node, index) => item(node, index, nodes, 0))}</ul>
      {unlisted.length > 0 && <div className="marq-ui marq-authoring-only mq:mt-3 mq:rounded-md mq:border mq:border-dashed mq:border-border mq:p-2">
        <div className="mq:mb-1 mq:text-xs mq:text-muted-foreground">Not in navigation</div>
        {unlisted.map(page => <div key={page.id} className="mq:flex mq:items-center mq:justify-between mq:gap-2">
          <a href={page.path} className="mq:truncate mq:text-sm">{page.title}</a>
          <Button variant="ghost" size="sm" onClick={() => apply(addPage(project.navigation, page.id, rootPage?.id))}>Add</Button>
        </div>)}
      </div>}
      {adding === '' ? <NewPageForm project={project} parent={rootPage} onCancel={() => setAdding(null)} onCreate={async input => { await createPage(input); setAdding(null); }} />
        : <Button variant="ghost" size="sm" className="marq-authoring-only mq:mt-2 mq:w-full mq:justify-start mq:text-muted-foreground" onClick={() => setAdding('')}><Plus />New page</Button>}
    </>
  );
}

export function NewPageForm({ project, parent, onCancel, onCreate, template: preferred, noun = 'page' }: { project: Project; parent?: Page; onCancel: () => void; onCreate: (input: { title: string; path: string; template: string; parent: string }) => Promise<void>; template?: string; noun?: string }) {
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [pathEdited, setPathEdited] = useState(false);
  const [template, setTemplate] = useState(project.theme.pageTemplates.find(option => option.id === preferred)?.id ?? project.theme.pageTemplates[0]?.id ?? 'page');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const taken = project.pages.map(page => page.path);
  const effectivePath = pathEdited ? path : suggestPath(parent?.path ?? '/', title, taken);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError('Give the page a title.');
    if (!validPath(effectivePath)) return setError('Use a path like /guide/intro/ with letters, digits, - and _.');
    if (taken.some(other => other.toLowerCase() === effectivePath.toLowerCase())) return setError('Another page already uses that path.');
    setBusy(true); setError('');
    try { await onCreate({ title: title.trim(), path: effectivePath, template, parent: parent?.id ?? '' }); }
    catch (failure) { setError(String((failure as Error).message ?? failure)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape') onCancel(); }} aria-label={parent ? `New ${noun} in ${parent.title}` : `New ${noun}`}
      className="marq-ui mq:my-2 mq:flex mq:flex-col mq:gap-2 mq:rounded-lg mq:border mq:border-border mq:bg-background mq:p-2 mq:shadow-sm">
      <Input ref={input} aria-label="Page title" placeholder={noun === 'collection' ? 'Collection title' : parent ? `Page in ${parent.title}` : 'Page title'} value={title} onChange={event => setTitle(event.target.value)} />
      <div className="mq:flex mq:items-center mq:gap-1">
        <span className="mq:text-xs mq:text-muted-foreground">URL</span>
        <Input aria-label="URL path" className="mq:h-7 mq:font-mono mq:text-xs" value={effectivePath} onChange={event => { setPathEdited(true); setPath(event.target.value); }} />
      </div>
      {project.theme.pageTemplates.length > 1 && <Select value={template} onValueChange={setTemplate}>
        <SelectTrigger aria-label="Page template" className="mq:h-7 mq:text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{project.theme.pageTemplates.map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
      </Select>}
      {error && <p role="alert" className="mq:text-xs mq:text-destructive">{error}</p>}
      <div className="mq:flex mq:items-center mq:justify-between mq:gap-2">
        <span className="mq:text-[11px] mq:text-muted-foreground">Starts as a draft</span>
        <span className="mq:flex mq:gap-1"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" disabled={busy}>Create</Button></span>
      </div>
    </form>
  );
}

export { find as findNavigation };
