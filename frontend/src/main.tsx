import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { X } from 'lucide-react';
import { MarqAlert, MarqCode, MarqTabs, MarqArea, SourceBlock, SourceSlices } from './nodes';
import { KexHighlight } from './highlight';
import { themeNodes } from './theme-nodes';
import { api, pageID, upload } from './api';
import { registry } from './registry';
import { slashCommands } from './commands';
import { bodyHost, menuHosts, navigationHosts, rememberMode, storedMode, titleHost, toolbarHost, type Mode } from './hosts';
import { useProject } from './useProject';
import { useDocument, useTitleEditing } from './useDocument';
import { useSlashMenu } from './useSlashMenu';
import { PageSession } from './collab';
import { identity } from './identity';
import type { Doc, Project } from './types';
import { EditorToolbar } from './components/EditorToolbar';
import { SlashMenu } from './components/SlashMenu';
import { NavigationTree } from './components/NavigationTree';
import { MenuEditor } from './components/MenuEditor';
import { CollectionNav } from './components/CollectionNav';
import { ReadOnlyBar, Topbar } from './components/Topbar';
import { ThemeSheet } from './components/ThemeSheet';
import { ConflictDialog } from './components/ConflictDialog';
import { TooltipProvider } from './components/ui/tooltip';
import { Button } from './components/ui/button';
import './style.css';

/** The authoring UI of one page: the editor in the theme's body, and the chrome around it. */
function Author({ initial, initialProject, toolbarElement }: { initial: Doc; initialProject: Project; toolbarElement: HTMLElement | null }) {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<Mode>(() => storedMode(initialProject.project));
  const [themeOpen, setThemeOpen] = useState(false);
  const site = useProject(initialProject, setMessage);
  const { project } = site;
  registry.blocks = project.theme.blocks; registry.project = project;

  const imageInput = useRef<HTMLInputElement>(null);
  const pickImage = () => imageInput.current?.click();
  const commands = useMemo(() => slashCommands(project.theme.commands, project.theme.blocks, pickImage), [project.theme]);
  const editorRef = useRef<Editor | null>(null);
  const slashMenu = useSlashMenu(commands, editorRef);
  // The page as everyone who has it open edits it, and who this editor is to them.
  const session = useMemo(() => new PageSession(initial.id), []);
  const user = useMemo(identity, []);

  // The schema is fixed for the life of the page; theme block changes reload it.
  const extensions = useMemo(() => [
    // Undo comes with collaboration: each editor undoes only its own changes.
    StarterKit.configure({ link: { openOnClick: false }, trailingNode: false, undoRedo: false }),
    Collaboration.configure({ document: session.doc, field: 'body' }),
    CollaborationCaret.configure({ provider: { awareness: session.awareness }, user }),
    // Markdown images are inline: as a block node, an image inside a rendered <p> was split
    // out on parse, leaving an empty paragraph that still saved the image's source.
    TableKit, Image.configure({ inline: true }), MarqCode, MarqTabs, MarqArea, MarqAlert, SourceBlock, SourceSlices, KexHighlight,
    Placeholder.configure({ placeholder: 'Write something, or type / for blocks' }),
    ...themeNodes(initialProject.theme.blocks),
  ], []);

  const page = useDocument({ initial, session, editorRef, extensions, setMessage, setProject: site.setProject, projectRef: site.projectRef });

  // The content comes from the session: seeded from the page by the first
  // editor on it, or received from the others.
  const editor = useEditor({
    extensions,
    editable: storedMode(initialProject.project) === 'edit',
    editorProps: {
      attributes: { 'aria-label': 'Page content', class: 'marq-document' },
      handleKeyDown: (_view, event) => slashMenu.handleKeyDown(event),
      handleDOMEvents: { compositionstart: page.composition.start, compositionend: page.composition.end },
    },
    onUpdate: ({ editor: e }) => { page.changed(); slashMenu.update(e); },
    onSelectionUpdate: ({ editor: e }) => slashMenu.update(e),
    onBlur: () => setTimeout(() => { if (!document.activeElement?.closest('[data-marq-chrome]')) slashMenu.close(); }, 100),
  });
  editorRef.current = editor;
  useTitleEditing(editor, page.editTitle);
  useEffect(() => { if (editor) session.start(); }, [editor]);
  useEffect(() => () => session.dispose(), []);

  // Edit versus preview: preview shows the page as readers will see it.
  useEffect(() => {
    editor?.setEditable(mode === 'edit');
    document.body.classList.toggle('marq-previewing', mode === 'preview');
    rememberMode(initialProject.project, mode);
    if (titleHost) titleHost.contentEditable = mode === 'edit' ? 'true' : 'false';
    if (mode === 'preview') slashMenu.close();
  }, [mode, editor]);

  // Publishing from a list: the open page goes through autosave like the top bar button.
  const setDraft = (id: string, draft: boolean) => id === initial.id ? page.applyMetadata('draft', draft) : site.setDraftElsewhere(id, draft);
  const createPage = async (input: { title: string; path: string; template: string; parent: string }) => { await page.navigate((await site.createPage(input)).path); };
  const navigate = (path: string) => void page.navigate(path);

  // The sidebar reflects this page's unsaved title and draft state as they change.
  const { doc } = page;
  const liveProject = useMemo(() => ({ ...project, pages: project.pages.map(item => item.id === doc.id ? { ...item, title: doc.title, draft: doc.draft, path: doc.path } : item) }), [project, doc.id, doc.title, doc.draft, doc.path]);
  const navigation = { project: liveProject, currentId: initial.id, saveNavigation: site.saveNavigation, createPage, navigate, setDraft };

  return <TooltipProvider delayDuration={400}>
    <Topbar project={project} doc={doc} state={page.saveState} mode={mode} setMode={setMode} retry={page.retry} openTheme={() => setThemeOpen(true)} applyMetadata={page.applyMetadata} />
    {editor && toolbarElement && createPortal(<EditorToolbar editor={editor} commands={commands} pickImage={pickImage} />, toolbarElement)}
    {editor && bodyHost && createPortal(<EditorContent editor={editor} />, bodyHost)}
    {navigationHosts.map(host => createPortal(host.dataset.marqScope === 'collections'
      ? <CollectionNav {...navigation} />
      : <NavigationTree {...navigation} root={host.dataset.marqScope === 'collection' ? host.dataset.marqCollection || undefined : undefined} />,
      host, `navigation-${host.dataset.marqScope ?? 'all'}`))}
    {menuHosts.map(host => createPortal(<MenuEditor project={liveProject} menuId={host.dataset.marqMenu ?? ''} currentId={initial.id} save={site.saveMenus} navigate={navigate} />, host, host.dataset.marqMenu))}
    {slashMenu.slash && mode === 'edit' && <SlashMenu state={slashMenu.slash} items={slashMenu.matches} choose={slashMenu.choose} hover={slashMenu.hover} />}
    <ThemeSheet project={project} open={themeOpen} setOpen={setThemeOpen} save={site.saveTheme} onError={setMessage} />
    <ConflictDialog {...page.conflict} />
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
