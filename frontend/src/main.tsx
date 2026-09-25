import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { generateJSON, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { X } from 'lucide-react';
import { MarqAlert, MarqCode, MarqTabs, MarqArea, SourceBlock, SourceSlices } from './nodes';
import { KexHighlight } from './highlight';
import { replaceBody, serialize, preserveSlices } from './format';
import { SaveQueue, type SaveState } from './save';
import { themeNodes } from './theme-nodes';
import { api, pageID, upload } from './api';
import { registry } from './registry';
import { filterCommands, slashCommands, type SlashItem } from './commands';
import type { Doc, MenuItem, Nav, Project } from './types';
import { EditorToolbar } from './components/EditorToolbar';
import { SlashMenu, type SlashState } from './components/SlashMenu';
import { NavigationTree } from './components/NavigationTree';
import { MenuEditor } from './components/MenuEditor';
import { CollectionNav } from './components/CollectionNav';
import { ReadOnlyBar, Topbar } from './components/Topbar';
import { ThemeSheet } from './components/ThemeSheet';
import { ConflictDialog } from './components/ConflictDialog';
import { TooltipProvider } from './components/ui/tooltip';
import { Button } from './components/ui/button';
import './style.css';

type Metadata = { title: string; path: string; draft: boolean; template: string };
type Mode = 'edit' | 'preview';

// Edit or preview is a per-viewer choice that follows the author from page to
// page and across reloads. It lives in the browser, never in project files.
const modeKey = (project: string) => `marqraft:${project}:mode`;
function storedMode(project: string): Mode {
  try { return localStorage.getItem(modeKey(project)) === 'preview' ? 'preview' : 'edit'; } catch { return 'edit'; }
}
function rememberMode(project: string, mode: Mode) {
  try { localStorage.setItem(modeKey(project), mode); } catch { /* storage unavailable: the mode lasts for this page */ }
}

const bodyHost = document.querySelector<HTMLElement>('[data-marq-body]');
const titleHost = document.querySelector<HTMLElement>('[data-marq-title]');
// A template may render navigation several times: collections in a header, the
// current collection in a sidebar, a contents list. The first region of each
// scope is editable; later regions of the same scope keep their rendered links.
const navigationHosts = [...document.querySelectorAll<HTMLElement>('[data-marq-navigation]')]
  .filter((host, index, all) => all.findIndex(other => (other.dataset.marqScope ?? '') === (host.dataset.marqScope ?? '')) === index)
  // A page outside every collection, such as the home page, has no collection
  // to edit: its region stays as rendered (empty) rather than showing the whole tree.
  .filter(host => host.dataset.marqScope !== 'collection' || Boolean(host.dataset.marqCollection));
const menuHosts = [...document.querySelectorAll<HTMLElement>('[data-marq-menu]')];

/** A host for the toolbar, placed in the theme's content column above the title. */
function toolbarHost(): HTMLElement | null {
  if (!bodyHost) return null;
  const host = document.createElement('div');
  // Without its own box the toolbar stays sticky within the whole content column.
  host.style.display = 'contents';
  const anchor = titleHost && titleHost.parentElement === bodyHost.parentElement ? titleHost : bodyHost;
  anchor.parentElement!.insertBefore(host, anchor);
  return host;
}

function Author({ initial, initialProject, toolbarElement }: { initial: Doc; initialProject: Project; toolbarElement: HTMLElement | null }) {
  const [project, setProject] = useState(initialProject);
  const [doc, setDoc] = useState(initial);
  const [state, setState] = useState<SaveState>('saved');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<Mode>(() => storedMode(initialProject.project));
  const [themeOpen, setThemeOpen] = useState(false);
  const [disk, setDisk] = useState<Doc | null>(null);
  const [recovery, setRecovery] = useState<{ source: string; revision: string } | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);

  const metadata = useRef<Metadata>({ title: initial.title, path: initial.path, draft: initial.draft, template: initial.template });
  const original = useRef(initial.source);
  const queue = useRef<SaveQueue | null>(null);
  const composing = useRef(false);
  const projectRef = useRef(project); projectRef.current = project;
  const slashRef = useRef(slash); slashRef.current = slash;
  const imageInput = useRef<HTMLInputElement>(null);
  const key = `marqraft:${project.project}:${initial.id}`;

  registry.blocks = project.theme.blocks; registry.project = project;
  const pickImage = useCallback(() => imageInput.current?.click(), []);
  const commands = useMemo(() => slashCommands(project.theme.commands, project.theme.blocks, pickImage), [project.theme, pickImage]);
  const commandsRef = useRef(commands); commandsRef.current = commands;
  const matches = slash ? filterCommands(commands, slash.query) : [];
  const matchesRef = useRef(matches); matchesRef.current = matches;

  // The schema is fixed for the life of the page; theme block changes reload it.
  const extensions = useMemo(() => [
    StarterKit.configure({ link: { openOnClick: false }, trailingNode: false }),
    // Markdown images are inline: as a block node, an image inside a rendered <p> was split
    // out on parse, leaving an empty paragraph that still saved the image's source.
    TableKit, Image.configure({ inline: true }), MarqCode, MarqTabs, MarqArea, MarqAlert, SourceBlock, SourceSlices, KexHighlight,
    Placeholder.configure({ placeholder: 'Write something, or type / for blocks' }),
    ...themeNodes(initialProject.theme.blocks),
  ], []);

  const editorRef = useRef<Editor | null>(null);
  const changed = useCallback(() => {
    const current = editorRef.current; if (!current || composing.current) return;
    try { queue.current?.edit(replaceBody(original.current, serialize(current.getJSON()), metadata.current)); }
    catch (error) { setMessage(String(error)); }
  }, []);

  const updateSlash = useCallback((editor: Editor) => {
    const { selection } = editor.state;
    const { $from, empty } = selection;
    if (!empty || !editor.isEditable || $from.parent.type.spec.code) { if (slashRef.current) setSlash(null); return; }
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const found = /(?:^|\s)\/([\w-]{0,24})$/.exec(before);
    if (!found) { if (slashRef.current) setSlash(null); return; }
    const from = $from.pos - found[1].length - 1;
    const coords = editor.view.coordsAtPos(from);
    setSlash(previous => ({ from, to: $from.pos, query: found[1], left: coords.left, top: coords.top, index: previous && previous.from === from ? Math.min(previous.index, 50) : 0 }));
  }, []);

  const choose = useCallback((item: SlashItem) => {
    const editor = editorRef.current, current = slashRef.current;
    if (!editor || !current) return;
    // A plain delete of the typed "/query": deleteRange would also remove the paragraph
    // once it is empty, moving the cursor, and the command, into the next block.
    editor.chain().focus().command(({ tr }) => { tr.delete(current.from, current.to); return true; }).run();
    setSlash(null);
    item.run(editor);
  }, []);

  const editor = useEditor({
    extensions,
    content: preserveSlices(generateJSON(initial.html, extensions)),
    editable: storedMode(initialProject.project) === 'edit',
    editorProps: {
      attributes: { 'aria-label': 'Page content', class: 'marq-document' },
      handleKeyDown: (_view, event) => {
        const current = slashRef.current, items = matchesRef.current;
        if (!current) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          setSlash({ ...current, index: (current.index + step + Math.max(items.length, 1)) % Math.max(items.length, 1) });
          return true;
        }
        if (event.key === 'Enter' && items[current.index]) { choose(items[current.index]); return true; }
        if (event.key === 'Escape') { setSlash(null); return true; }
        return false;
      },
      handleDOMEvents: {
        compositionstart: () => { composing.current = true; return false; },
        compositionend: () => { composing.current = false; queueMicrotask(changed); return false; },
      },
    },
    onUpdate: ({ editor: e }) => { if (!composing.current) changed(); updateSlash(e); },
    onSelectionUpdate: ({ editor: e }) => updateSlash(e),
    onBlur: () => setTimeout(() => { if (!document.activeElement?.closest('[data-marq-chrome]')) setSlash(null); }, 100),
  });
  editorRef.current = editor;

  // Save queue, local recovery and unload protection.
  useEffect(() => {
    queue.current = new SaveQueue(initial.source, initial.revision,
      async (source, revision) => {
        const result = await api<Doc>('save', { id: initial.id, source, revision });
        setProject(current => ({ ...current, pages: current.pages.map(page => page.id === result.id ? { ...page, ...result } : page) }));
        return result;
      },
      (next, error) => { setState(next); if (error) setMessage(error); },
      (source, revision) => { try { localStorage.setItem(key, JSON.stringify({ source, revision })); } catch { setMessage('Browser recovery storage is unavailable. Keep this tab open until saved.'); } },
      () => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } });
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (saved?.source && saved.source !== initial.source) { setRecovery(saved); queue.current.conflict(); }
    } catch { /* malformed local recovery does not affect the document */ }
    const beforeUnload = (event: BeforeUnloadEvent) => { if (queue.current?.dirty || queue.current?.state === 'conflict') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { queue.current?.dispose(); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);

  // Edit versus preview: preview shows the page as readers will see it.
  useEffect(() => {
    editor?.setEditable(mode === 'edit');
    document.body.classList.toggle('marq-previewing', mode === 'preview');
    rememberMode(initialProject.project, mode);
    if (titleHost) titleHost.contentEditable = mode === 'edit' ? 'true' : 'false';
    if (mode === 'preview') setSlash(null);
  }, [mode, editor]);

  // The page title is edited in place, inside the theme's own heading.
  useEffect(() => {
    if (!titleHost || !editor) return;
    titleHost.setAttribute('aria-label', 'Page title'); titleHost.spellcheck = true;
    const input = () => { const title = titleHost.textContent ?? ''; metadata.current.title = title; setDoc(d => ({ ...d, title })); changed(); };
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); editor.commands.focus('start'); } };
    const paste = (event: ClipboardEvent) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData?.getData('text/plain').replace(/\s+/g, ' ') ?? ''); };
    titleHost.addEventListener('input', input); titleHost.addEventListener('keydown', keydown); titleHost.addEventListener('paste', paste);
    return () => { titleHost.removeEventListener('input', input); titleHost.removeEventListener('keydown', keydown); titleHost.removeEventListener('paste', paste); };
  }, [editor]);

  // External changes: reload clean documents, keep both versions when edits overlap.
  useEffect(() => {
    let stopped = false, running = false;
    const timer = setInterval(async () => {
      if (running) return; running = true;
      try {
        const fresh = await api<Project>('project'); if (stopped) return;
        const page = fresh.pages.find(p => p.id === initial.id);
        const q = queue.current;
        if (page && q && page.revision !== q.revision && q.state !== 'saving') {
          const external = await api<Doc>(`document/${initial.id}`);
          // Metadata can have been read before a save that finished during this poll.
          if (external.revision !== q.revision && external.source !== q.source && (q.state as SaveState) !== 'saving') {
            if (q.dirty || q.state === 'conflict' || editorRef.current?.isFocused) { q.conflict(); setDisk(external); }
            else {
              original.current = external.source; q.source = external.source; q.revision = external.revision;
              metadata.current = { title: external.title, path: external.path, draft: external.draft, template: external.template };
              editorRef.current?.commands.setContent(preserveSlices(generateJSON(external.html, extensions)), { emitUpdate: false });
              if (titleHost) titleHost.textContent = external.title;
              setDoc(external);
            }
          }
        }
        if (fresh.themeRevision !== projectRef.current.themeRevision) {
          if (q?.dirty || composing.current || q?.state === 'conflict') setMessage('The theme changed. Your edits are kept; reload after they are saved to apply it.');
          else window.location.reload();
        }
        setProject(fresh);
      } catch (error) { if (!stopped) setMessage(`Cannot check for external changes: ${String((error as Error).message ?? error)}`); }
      finally { running = false; }
    }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  const applyMetadata = (field: keyof Metadata, value: string | boolean) => {
    metadata.current = { ...metadata.current, [field]: value };
    setDoc(d => ({ ...d, [field]: value }));
    if (field === 'title' && titleHost && titleHost.textContent !== value) titleHost.textContent = String(value);
    changed();
    if (field !== 'title') void queue.current?.flush();
  };

  const refresh = async () => { const next = await api<Project>('project'); setProject(next); return next; };
  const navigate = async (path: string) => {
    await queue.current?.flush();
    if (!queue.current?.dirty && queue.current?.state !== 'conflict') window.location.href = path;
    else setMessage('Resolve unsaved changes before leaving this page.');
  };
  // Structure saves run one at a time, each with the revision the previous one returned,
  // so quick successive edits are not rejected as stale.
  const structureSaves = useRef<Promise<unknown>>(Promise.resolve());
  const serially = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = structureSaves.current.then(task, task);
    structureSaves.current = run.catch(() => {});
    return run;
  };
  const failed = async (error: unknown) => { setMessage(String((error as Error).message ?? error)); await refresh().catch(() => {}); };
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
  // Publishing from a list: the open page goes through autosave like the top bar
  // button; any other page has only its draft line changed on the server.
  const setDraft = (id: string, draft: boolean) => {
    if (id === initial.id) { applyMetadata('draft', draft); return; }
    setProject(current => ({ ...current, pages: current.pages.map(page => page.id === id ? { ...page, draft } : page) }));
    void api('publish', { id, draft }).then(refresh).catch(async error => { setMessage(String((error as Error).message ?? error)); await refresh().catch(() => {}); });
  };
  const createPage = async (input: { title: string; path: string; template: string; parent: string }) => {
    const created = await api<Doc>('operation', { id: 'create-page', input });
    await refresh();
    await navigate(created.path);
  };
  const saveTheme = async (settings: Record<string, string>, favicon: string) => {
    await api('settings', { revision: projectRef.current.settingsRevision, settings, favicon });
    await refresh();
    setMessage('Theme settings saved.');
  };

  // The sidebar reflects this page's unsaved title and draft state as they change.
  const liveProject = useMemo(() => ({ ...project, pages: project.pages.map(page => page.id === doc.id ? { ...page, title: doc.title, draft: doc.draft, path: doc.path } : page) }), [project, doc.id, doc.title, doc.draft, doc.path]);
  const conflictOpen = state === 'conflict' || Boolean(recovery);
  const localSource = recovery?.source ?? queue.current?.source ?? '';
  const clearRecovery = () => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };

  return <TooltipProvider delayDuration={400}>
    <Topbar project={project} doc={doc} state={state} mode={mode} setMode={setMode} retry={() => void queue.current?.flush()} openTheme={() => setThemeOpen(true)} applyMetadata={applyMetadata} />
    {editor && toolbarElement && createPortal(<EditorToolbar editor={editor} commands={commands} pickImage={pickImage} />, toolbarElement)}
    {editor && bodyHost && createPortal(<EditorContent editor={editor} />, bodyHost)}
    {navigationHosts.map(host => createPortal(host.dataset.marqScope === 'collections'
      ? <CollectionNav project={liveProject} currentId={initial.id} saveNavigation={saveNavigation} createPage={createPage} navigate={path => void navigate(path)} setDraft={setDraft} />
      : <NavigationTree project={liveProject} currentId={initial.id} root={host.dataset.marqScope === 'collection' ? host.dataset.marqCollection || undefined : undefined} saveNavigation={saveNavigation} createPage={createPage} navigate={path => void navigate(path)} setDraft={setDraft} />,
      host, `navigation-${host.dataset.marqScope ?? 'all'}`))}
    {menuHosts.map(host => createPortal(<MenuEditor project={liveProject} menuId={host.dataset.marqMenu ?? ''} currentId={initial.id} save={saveMenus} navigate={path => void navigate(path)} />, host, host.dataset.marqMenu))}
    {slash && mode === 'edit' && <SlashMenu state={slash} items={matches} choose={choose} hover={index => setSlash(current => current && { ...current, index })} />}
    <ThemeSheet project={project} open={themeOpen} setOpen={setThemeOpen} save={saveTheme} onError={setMessage} />
    <ConflictDialog open={conflictOpen} recovering={Boolean(recovery)} local={localSource} disk={disk?.source ?? doc.source}
      editLocal={source => { if (recovery) setRecovery({ ...recovery, source }); else queue.current?.edit(source); }}
      useDisk={() => { clearRecovery(); window.location.reload(); }}
      saveLocal={async () => {
        try { const current = await api<Doc>(`document/${initial.id}`); await api('save', { id: initial.id, revision: current.revision, source: localSource }); clearRecovery(); window.location.reload(); }
        catch (error) { setMessage(String((error as Error).message)); }
      }}
      download={() => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([localSource], { type: 'text/markdown' })); link.download = 'recovered.md'; link.click(); URL.revokeObjectURL(link.href); }} />
    <input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) void upload(file).then(src => editor?.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run()).catch(error => setMessage(error.message));
    }} />
    {message && <div role="alert" className="marq-ui mq:fixed mq:bottom-4 mq:left-4 mq:z-[2147483200] mq:flex mq:max-w-md mq:items-start mq:gap-3 mq:rounded-lg mq:border mq:border-border mq:bg-background mq:p-3 mq:text-sm mq:shadow-lg">
      <span className="mq:flex-1">{message}</span>
      <Button variant="ghost" size="icon-sm" onClick={() => setMessage('')} aria-label="Dismiss message"><X /></Button>
    </div>}
  </TooltipProvider>;
}

// A generated page (a mount's output) is rendered, never edited: it gets the
// bar and nothing else, instead of failing to load a document it has none of.
const generatedTitle = document.querySelector<HTMLMetaElement>('meta[name="marq-generated"]')?.content;

async function main() {
  if (generatedTitle !== undefined) {
    const project = await api<Project>('project');
    createRoot(document.getElementById('marq-chrome')!).render(<ReadOnlyBar project={project} title={generatedTitle} />);
    return;
  }
  const [project, doc] = await Promise.all([api<Project>('project'), api<Doc>(`document/${pageID}`)]);
  if (!bodyHost) throw new Error('The theme has no editable body region (<marqraft-content source="body">).');
  // Apply preview before the first render, so a previewing author never sees edit chrome flash.
  document.body.classList.toggle('marq-previewing', storedMode(project.project) === 'preview');
  bodyHost.innerHTML = '';
  for (const host of navigationHosts) host.innerHTML = '';
  for (const host of menuHosts) host.innerHTML = '';
  createRoot(document.getElementById('marq-chrome')!).render(<Author initial={doc} initialProject={project} toolbarElement={toolbarHost()} />);
}

void main().catch(error => {
  const root = document.getElementById('marq-chrome');
  if (root) root.innerHTML = `<div class="marq-ui" role="alert" style="position:fixed;top:0;inset-inline:0;height:48px;box-sizing:border-box;display:flex;align-items:center;padding:0 16px;background:#fef2f2;color:#991b1b;font:13px system-ui;z-index:2147483647">Authoring could not start: ${String(error.message).replace(/[<&>]/g, c => `&#${c.charCodeAt(0)};`)}</div>`;
});
