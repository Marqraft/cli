import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { generateJSON, type AnyExtension, type Editor } from '@tiptap/core';
import { api } from './api';
import { preserveSlices, replaceBody, serialize } from './format';
import { SaveQueue, type SaveState } from './save';
import { descriptionHost, titleHost } from './hosts';
import { onSiteChange } from './live';
import type { PageSession } from './collab';
import type { Doc, Project } from './types';

type Metadata = { title: string; description: string; path: string; draft: boolean; template: string; version: string };
const metadataFields: (keyof Metadata)[] = ['title', 'description', 'path', 'draft', 'template', 'version'];

type Options = {
  initial: Doc;
  session: PageSession;
  editorRef: RefObject<Editor | null>;
  extensions: AnyExtension[];
  setMessage: (message: string) => void;
  setProject: Dispatch<SetStateAction<Project>>;
  projectRef: MutableRefObject<Project>;
};

const metadataOf = (page: Doc): Metadata => ({ title: page.title, description: page.description ?? '', path: page.path, draft: page.draft, template: page.template, version: page.version ?? '' });

/**
 * The open page, edited together with every other editor that has it open
 * (see PageSession): its body and frontmatter live in the shared document,
 * and one editor — the page's saver — writes them to disk with autosave and
 * local recovery. A save rejected because the file changed on disk keeps
 * both versions for the author to choose.
 */
export function useDocument({ initial, session, editorRef, extensions, setMessage, setProject, projectRef }: Options) {
  const [doc, setDoc] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [disk, setDisk] = useState<Doc | null>(null);
  const [recovery, setRecovery] = useState<{ source: string; revision: string } | null>(null);
  const [saver, setSaver] = useState(session.saver);

  const metadata = useRef<Metadata>(metadataOf(initial));
  const original = useRef(initial.source);
  const queue = useRef<SaveQueue | null>(null);
  const composing = useRef(false);
  const key = `marqraft:${projectRef.current.project}:${initial.id}`;

  // The saver writes the shared document; every other editor leaves it be.
  // Nothing is written while the document takes on the file as it is on disk.
  const fromDisk = useRef(false);
  const changed = useCallback(() => {
    const current = editorRef.current; if (!current || composing.current || !queue.current || fromDisk.current) return;
    try { queue.current.edit(replaceBody(original.current, serialize(current.getJSON()), metadata.current)); }
    catch (error) { setMessage(String(error)); }
  }, []);

  // IME composition: the source is only read once a composed character is committed.
  const composition = {
    start: () => { composing.current = true; return false; },
    end: () => { composing.current = false; queueMicrotask(changed); return false; },
  };

  // Becoming the page's saver. The editor that seeded the page holds it
  // exactly as saved, so opening a page never rewrites it; one that takes
  // over later reloads the file and saves what the others changed since.
  const seededHere = useRef(false);
  const startSaving = useCallback(async () => {
    if (queue.current) return;
    const seeded = seededHere.current;
    const onDisk = seeded ? initial : await api<Doc>(`document/${initial.id}`);
    original.current = onDisk.source;
    queue.current = new SaveQueue(onDisk.source, onDisk.revision,
      async (source, revision) => {
        const result = await api<Doc>('save', { id: initial.id, source, revision });
        setProject(current => ({ ...current, pages: current.pages.map(page => page.id === result.id ? { ...page, ...result } : page) }));
        session.compact();
        return result;
      },
      (next, error) => { setSaveState(next); if (error) setMessage(error); },
      (source, revision) => { try { localStorage.setItem(key, JSON.stringify({ source, revision })); } catch { setMessage('Browser recovery storage is unavailable. Keep this tab open until saved.'); } },
      () => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } });
    if (!seeded) changed();
  }, []);

  // The session: seed it if this editor is first, follow the frontmatter
  // everyone edits, and save when this editor is the saver.
  useEffect(() => {
    const applyMeta = () => {
      const next = { ...metadata.current };
      for (const field of metadataFields) {
        const value = session.meta.get(field);
        if (value !== undefined) (next as Record<string, unknown>)[field] = value;
      }
      metadata.current = next;
      setDoc(d => ({ ...d, ...next }));
      showText(titleHost, next.title);
      showText(descriptionHost, next.description);
      changed();
    };
    session.meta.observe(applyMeta);
    session.on('seed', () => {
      // A local copy from an interrupted session in this browser can only be
      // restored while nobody else is editing the page.
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (saved?.source && saved.source !== initial.source) setRecovery(saved);
      } catch { /* malformed local recovery does not affect the document */ }
      session.doc.transact(() => { for (const field of metadataFields) session.meta.set(field, metadata.current[field]); });
      editorRef.current?.commands.setContent(preserveSlices(generateJSON(initial.html, extensions)));
      session.markSeeded();
      seededHere.current = true;
    });
    session.on('saver', isSaver => { setSaver(isSaver); if (isSaver) void startSaving(); });
    const beforeUnload = (event: BeforeUnloadEvent) => { if (queue.current?.dirty || queue.current?.state === 'conflict') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { session.meta.unobserve(applyMeta); queue.current?.dispose(); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);

  // Changes to the site as the server announces them: navigation, other
  // pages, the theme, and this page's file changed on disk by something other
  // than the session — another program, or a regenerated file. The saver, who
  // knows what it last wrote, deals with the latter: a session with nothing
  // unsaved takes on the file, for every editor on the page; one with unsaved
  // changes keeps both versions for the author to choose.
  useEffect(() => {
    let stopped = false, running = false;
    const takeOnDisk = (external: Doc) => {
      const q = queue.current!;
      fromDisk.current = true;
      try {
        original.current = external.source; q.source = external.source; q.revision = external.revision;
        session.doc.transact(() => { for (const field of metadataFields) session.meta.set(field, metadataOf(external)[field]); });
        editorRef.current?.commands.setContent(preserveSlices(generateJSON(external.html, extensions)), { emitUpdate: false });
      } finally { fromDisk.current = false; }
      setDoc(external);
    };
    const check = async () => {
      if (running) return; running = true;
      try {
        const fresh = await api<Project>('project'); if (stopped) return;
        const q = queue.current;
        const page = fresh.pages.find(p => p.id === initial.id);
        if (session.saver && page && q && page.revision !== q.revision && q.state !== 'saving') {
          const external = await api<Doc>(`document/${initial.id}`);
          // Metadata can have been read before a save that finished during this poll.
          if (external.revision !== q.revision && external.source !== q.source && (q.state as SaveState) !== 'saving') {
            if (q.dirty || q.state === 'conflict') { q.conflict(); setDisk(external); }
            else takeOnDisk(external);
          }
        }
        if (fresh.themeRevision !== projectRef.current.themeRevision) {
          if (q?.dirty || composing.current || q?.state === 'conflict') setMessage('The theme changed. Your edits are kept; reload after they are saved to apply it.');
          else window.location.reload();
        }
        setProject(fresh);
      } catch (error) { if (!stopped) setMessage(`Cannot check for external changes: ${String((error as Error).message ?? error)}`); }
      finally { running = false; }
    };
    const stop = onSiteChange(() => void check());
    return () => { stopped = true; stop(); };
  }, []);

  /** Title, description, path, draft, template or version, for every editor on the page. */
  const applyMetadata = (field: keyof Metadata, value: string | boolean) => {
    session.meta.set(field, value);
    if (field === 'title') showText(titleHost, String(value), true);
    if (field === 'description') showText(descriptionHost, String(value), true);
    if (field !== 'title' && field !== 'description') void queue.current?.flush();
  };

  /** The title and description as typed in place, in the theme's own elements. */
  const editTitle = (title: string) => session.meta.set('title', title);
  const editDescription = (description: string) => session.meta.set('description', description);

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

  return { doc, saveState, saver, changed, composition, applyMetadata, editTitle, editDescription, navigate, retry, conflict, setDisk };
}

/** Shows a field's text in its host, unless the author is typing there (or `force`). */
function showText(host: HTMLElement | null, text: string, force = false) {
  if (host && (force || document.activeElement !== host) && host.textContent !== text) host.textContent = text;
}

/**
 * Plain text edited in place, inside the theme's own element: the title's
 * heading, or the element showing the description. Enter moves on to the body.
 */
export function useInlineText(host: HTMLElement | null, label: string, editor: Editor | null, edit: (text: string) => void) {
  const editRef = useRef(edit); editRef.current = edit;
  useEffect(() => {
    if (!host || !editor) return;
    host.setAttribute('aria-label', label); host.spellcheck = true;
    const input = () => editRef.current(host.textContent ?? '');
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); editor.commands.focus('start'); } };
    const paste = (event: ClipboardEvent) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData?.getData('text/plain').replace(/\s+/g, ' ') ?? ''); };
    host.addEventListener('input', input); host.addEventListener('keydown', keydown); host.addEventListener('paste', paste);
    return () => { host.removeEventListener('input', input); host.removeEventListener('keydown', keydown); host.removeEventListener('paste', paste); };
  }, [host, editor]);
}
