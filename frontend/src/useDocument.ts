import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { generateJSON, type AnyExtension, type Editor } from '@tiptap/core';
import { api } from './api';
import { preserveSlices, replaceBody, serialize } from './format';
import { SaveQueue, type SaveState } from './save';
import { titleHost } from './hosts';
import type { Doc, Project } from './types';

type Metadata = { title: string; path: string; draft: boolean; template: string; version: string };

type Options = {
  initial: Doc;
  editorRef: RefObject<Editor | null>;
  extensions: AnyExtension[];
  setMessage: (message: string) => void;
  setProject: Dispatch<SetStateAction<Project>>;
  projectRef: MutableRefObject<Project>;
};

/**
 * The open page: its source as the editor changes it, autosave with local
 * recovery, its frontmatter (title, path, draft, template), and what happens
 * when the file changes on disk — clean documents reload in place,
 * overlapping edits keep both versions for the author to choose.
 */
export function useDocument({ initial, editorRef, extensions, setMessage, setProject, projectRef }: Options) {
  const [doc, setDoc] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [disk, setDisk] = useState<Doc | null>(null);
  const [recovery, setRecovery] = useState<{ source: string; revision: string } | null>(null);

  const metadata = useRef<Metadata>({ title: initial.title, path: initial.path, draft: initial.draft, template: initial.template, version: initial.version ?? '' });
  const original = useRef(initial.source);
  const queue = useRef<SaveQueue | null>(null);
  const composing = useRef(false);
  const key = `marqraft:${projectRef.current.project}:${initial.id}`;

  const changed = useCallback(() => {
    const current = editorRef.current; if (!current || composing.current) return;
    try { queue.current?.edit(replaceBody(original.current, serialize(current.getJSON()), metadata.current)); }
    catch (error) { setMessage(String(error)); }
  }, []);

  // IME composition: the source is only read once a composed character is committed.
  const composition = {
    start: () => { composing.current = true; return false; },
    end: () => { composing.current = false; queueMicrotask(changed); return false; },
  };

  // Save queue, local recovery and unload protection.
  useEffect(() => {
    queue.current = new SaveQueue(initial.source, initial.revision,
      async (source, revision) => {
        const result = await api<Doc>('save', { id: initial.id, source, revision });
        setProject(current => ({ ...current, pages: current.pages.map(page => page.id === result.id ? { ...page, ...result } : page) }));
        return result;
      },
      (next, error) => { setSaveState(next); if (error) setMessage(error); },
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
              metadata.current = { title: external.title, path: external.path, draft: external.draft, template: external.template, version: external.version ?? '' };
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

  /** The title as typed in the theme's own heading. */
  const editTitle = (title: string) => { metadata.current.title = title; setDoc(d => ({ ...d, title })); changed(); };

  /** Leaves for another page once everything is saved. */
  const navigate = async (path: string) => {
    await queue.current?.flush();
    if (!queue.current?.dirty && queue.current?.state !== 'conflict') window.location.href = path;
    else setMessage('Resolve unsaved changes before leaving this page.');
  };

  const retry = () => void queue.current?.flush();

  // A conflict (or a recovered local copy) shows both versions: keep editing
  // the local one, take the disk's, save the local one over it, or download it.
  const local = recovery?.source ?? queue.current?.source ?? '';
  const clearRecovery = () => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };
  const conflict = {
    open: saveState === 'conflict' || Boolean(recovery),
    recovering: Boolean(recovery),
    local,
    disk: disk?.source ?? doc.source,
    editLocal: (source: string) => { if (recovery) setRecovery({ ...recovery, source }); else queue.current?.edit(source); },
    useDisk: () => { clearRecovery(); window.location.reload(); },
    saveLocal: async () => {
      try { const current = await api<Doc>(`document/${initial.id}`); await api('save', { id: initial.id, revision: current.revision, source: local }); clearRecovery(); window.location.reload(); }
      catch (error) { setMessage(String((error as Error).message)); }
    },
    download: () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([local], { type: 'text/markdown' })); link.download = 'recovered.md'; link.click(); URL.revokeObjectURL(link.href); },
  };

  return { doc, saveState, changed, composition, applyMetadata, editTitle, navigate, retry, conflict };
}

/** The page title is edited in place, inside the theme's own heading. */
export function useTitleEditing(editor: Editor | null, editTitle: (title: string) => void) {
  const editTitleRef = useRef(editTitle); editTitleRef.current = editTitle;
  useEffect(() => {
    const host = titleHost;
    if (!host || !editor) return;
    host.setAttribute('aria-label', 'Page title'); host.spellcheck = true;
    const input = () => editTitleRef.current(host.textContent ?? '');
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); editor.commands.focus('start'); } };
    const paste = (event: ClipboardEvent) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData?.getData('text/plain').replace(/\s+/g, ' ') ?? ''); };
    host.addEventListener('input', input); host.addEventListener('keydown', keydown); host.addEventListener('paste', paste);
    return () => { host.removeEventListener('input', input); host.removeEventListener('keydown', keydown); host.removeEventListener('paste', paste); };
  }, [editor]);
}
