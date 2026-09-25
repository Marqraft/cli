import { useRef, useState } from 'react';
import { api } from './api';
import type { Doc, MenuItem, Nav, Project } from './types';

const errorText = (error: unknown) => String((error as Error).message ?? error);

/**
 * The site around the open page: its pages, navigation, menus and theme
 * settings, and the saves that change them. Structure saves run one at a
 * time, each with the revision the previous one returned, so quick
 * successive edits are not rejected as stale.
 */
export function useProject(initial: Project, setMessage: (message: string) => void) {
  const [project, setProject] = useState(initial);
  const projectRef = useRef(project); projectRef.current = project;

  const refresh = async () => { const next = await api<Project>('project'); setProject(next); return next; };
  const failed = async (error: unknown) => { setMessage(errorText(error)); await refresh().catch(() => {}); };

  const structureSaves = useRef<Promise<unknown>>(Promise.resolve());
  const serially = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = structureSaves.current.then(task, task);
    structureSaves.current = run.catch(() => {});
    return run;
  };

  const saveNavigation = (tree: Nav[]) => {
    setProject(current => ({ ...current, navigation: tree }));
    return serially(async () => {
      const result = await api<{ revision: string }>('navigation', { revision: projectRef.current.navigationRevision, navigation: tree });
      projectRef.current = { ...projectRef.current, navigationRevision: result.revision };
      setProject(current => ({ ...current, navigationRevision: result.revision }));
    }).catch(failed);
  };

  const saveMenus = (menus: Record<string, MenuItem[]>) => {
    setProject(current => ({ ...current, menus }));
    return serially(async () => {
      const result = await api<{ revision: string }>('menus', { revision: projectRef.current.menusRevision, menus });
      projectRef.current = { ...projectRef.current, menusRevision: result.revision };
      setProject(current => ({ ...current, menusRevision: result.revision }));
    }).catch(async error => { await failed(error); throw error; });
  };

  /** Publishes or unpublishes a page other than the open one: only its draft line changes on the server. */
  const setDraftElsewhere = (id: string, draft: boolean) => {
    setProject(current => ({ ...current, pages: current.pages.map(page => page.id === id ? { ...page, draft } : page) }));
    void api('publish', { id, draft }).then(refresh).catch(failed);
  };

  const createPage = async (input: { title: string; path: string; template: string; parent: string }) => {
    const created = await api<Doc>('operation', { id: 'create-page', input });
    await refresh();
    return created;
  };

  const saveTheme = async (settings: Record<string, string>, favicon: string) => {
    await api('settings', { revision: projectRef.current.settingsRevision, settings, favicon });
    await refresh();
    setMessage('Theme settings saved.');
  };

  return { project, setProject, projectRef, refresh, saveNavigation, saveMenus, setDraftElsewhere, createPage, saveTheme };
}
