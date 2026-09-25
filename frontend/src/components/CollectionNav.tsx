import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, MoreHorizontal, Plus } from 'lucide-react';
import type { Nav, Project } from '../types';
import { contains, shift } from '../navigation';
import { NewPageForm } from './NavigationTree';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

type Props = {
  project: Project; currentId: string;
  saveNavigation: (tree: Nav[]) => Promise<void>;
  createPage: (input: { title: string; path: string; template: string; parent: string }) => Promise<void>;
  navigate: (path: string) => void;
  setDraft: (id: string, draft: boolean) => void;
};

/**
 * The collections region: one link per top-level navigation entry, in the
 * theme's own ul/li/a markup. New collections are top-level pages, created
 * with the theme's landing template when it has one.
 */
export function CollectionNav({ project, currentId, saveNavigation, createPage, navigate, setDraft }: Props) {
  const [adding, setAdding] = useState(false);
  const apply = (tree: Nav[]) => { if (tree !== project.navigation) void saveNavigation(tree); };
  const template = project.theme.pageTemplates.some(option => option.id === 'landing') ? 'landing' : undefined;
  return (
    <ul>
      {project.navigation.map((node, index) => {
        const page = project.pages.find(candidate => candidate.id === node.id);
        if (!page) return null;
        const current = page.id === currentId ? 'page' : contains(node, currentId) ? 'true' : undefined;
        return (
          <li key={node.id} className="marq-menu-item mq:relative">
            <a href={page.path} aria-current={current} onClick={event => { if (event.metaKey || event.ctrlKey) return; event.preventDefault(); navigate(page.path); }}>
              {page.title || 'Untitled'}{page.draft && <small className="marq-draft">Draft</small>}
            </a>
            <span className="marq-ui marq-menu-actions marq-authoring-only mq:absolute mq:-right-1.5 mq:-top-2 mq:z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon-sm" className="mq:size-5 mq:rounded-full mq:[&_svg]:size-3" aria-label={`${page.title} collection options`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => setDraft(page.id, !page.draft)}>{page.draft ? <><Eye />Publish collection</> : <><EyeOff />Unpublish collection</>}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={index === 0} onSelect={() => apply(shift(project.navigation, node.id, 'up'))}><ArrowLeft />Move left</DropdownMenuItem>
                  <DropdownMenuItem disabled={index === project.navigation.length - 1} onSelect={() => apply(shift(project.navigation, node.id, 'down'))}><ArrowRight />Move right</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </li>
        );
      })}
      {(project.generatedCollections ?? []).map(collection => (
        <li key={collection.id}><a href={collection.path}>{collection.title}</a></li>
      ))}
      <li className="marq-ui marq-authoring-only mq:flex mq:items-center">
        <Popover open={adding} onOpenChange={setAdding}>
          <PopoverTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="New collection"><Plus /></Button></PopoverTrigger>
          <PopoverContent align="start" className="mq:w-80 mq:p-1">
            <NewPageForm project={project} noun="collection" template={template} onCancel={() => setAdding(false)}
              onCreate={async input => { await createPage(input); setAdding(false); }} />
          </PopoverContent>
        </Popover>
      </li>
    </ul>
  );
}
