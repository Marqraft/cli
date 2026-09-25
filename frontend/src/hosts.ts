// Where the authoring UI attaches to the themed page: the regions a template
// marks with data-marq-* attributes, found once when the page loads.

export type Mode = 'edit' | 'preview';

// Edit or preview is a per-viewer choice that follows the author from page to
// page and across reloads. It lives in the browser, never in project files.
const modeKey = (project: string) => `marqraft:${project}:mode`;
export function storedMode(project: string): Mode {
  try { return localStorage.getItem(modeKey(project)) === 'preview' ? 'preview' : 'edit'; } catch { return 'edit'; }
}
export function rememberMode(project: string, mode: Mode) {
  try { localStorage.setItem(modeKey(project), mode); } catch { /* storage unavailable: the mode lasts for this page */ }
}

export const bodyHost = document.querySelector<HTMLElement>('[data-marq-body]');
export const titleHost = document.querySelector<HTMLElement>('[data-marq-title]');
// A template may render navigation several times: collections in a header, the
// current collection in a sidebar, a contents list. The first region of each
// scope is editable; later regions of the same scope keep their rendered links.
export const navigationHosts = [...document.querySelectorAll<HTMLElement>('[data-marq-navigation]')]
  .filter((host, index, all) => all.findIndex(other => (other.dataset.marqScope ?? '') === (host.dataset.marqScope ?? '')) === index)
  // A page outside every collection, such as the home page, has no collection
  // to edit: its region stays as rendered (empty) rather than showing the whole tree.
  .filter(host => host.dataset.marqScope !== 'collection' || Boolean(host.dataset.marqCollection));
export const menuHosts = [...document.querySelectorAll<HTMLElement>('[data-marq-menu]')];

/** A host for the toolbar, placed in the theme's content column above the title. */
export function toolbarHost(): HTMLElement | null {
  if (!bodyHost) return null;
  const host = document.createElement('div');
  // Without its own box the toolbar stays sticky within the whole content column.
  host.style.display = 'contents';
  const anchor = titleHost && titleHost.parentElement === bodyHost.parentElement ? titleHost : bodyHost;
  anchor.parentElement!.insertBefore(host, anchor);
  return host;
}
