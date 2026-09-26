import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { live } from './live';

// Frame kinds, the first byte of every binary message (see Marqraft.Live.Hub).
const UPDATE = 0, AWARENESS = 1, COMPACTED = 2;

// An editor's colour follows its number on the page, so Instance 2 keeps its
// colour for as long as it stays.
const colours = ['#2b6cb0', '#e0533d', '#2f855a', '#b7791f', '#9f7aea', '#d53f8c', '#0f8a8a', '#6b5bd2'];

type Events = {
  /** This editor is the first on the page: it fills the shared document. */
  seed: () => void;
  /** This editor now saves the page to disk (or no longer does). */
  saver: (saver: boolean) => void;
};

/**
 * One page, edited together by every editor that has it open. Each keeps a
 * Yjs document; `marq dev` only relays and keeps the updates, so every
 * editor converges on the same content in any order.
 *
 * - `doc`'s "body" fragment is the page body, bound to the editor.
 * - `meta` holds the frontmatter the editor changes: title, path, draft,
 *   template, version.
 * - `awareness` carries each editor's caret and selection, named by the
 *   number the server gives it on the page: Instance 1, Instance 2, ...
 */
export class PageSession {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  readonly meta = this.doc.getMap<string | boolean>('meta');
  saver = false;
  private seeded = false;
  private readonly handlers: { [K in keyof Events]: Events[K][] } = { seed: [], saver: [] };
  private stop: (() => void) | null = null;

  constructor(private readonly page: string) {
    this.doc.on('update', (update: Uint8Array, origin: unknown) => { if (origin !== this) this.send(UPDATE, update); });
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin !== this) { this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed])); return; }
      // Someone new appeared: tell them who we are, rather than make them
      // wait for our next periodic renewal.
      if (added.length > 0) this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    });
  }

  /** Joins the page, once the editor and the handlers are ready for its answer. */
  start() {
    if (this.stop) return;
    this.stop = live.listen({
      open: () => live.send(JSON.stringify({ type: 'join', page: this.page })),
      text: message => this.received(message),
      binary: data => this.frame(data),
    });
    window.addEventListener('pagehide', this.leave);
  }

  on<K extends keyof Events>(event: K, handler: Events[K]) { this.handlers[event].push(handler); }

  /** Records that the document now holds the page (seeded here, or received). */
  markSeeded() { this.seeded = true; }

  /** The saver replaces the kept updates with the whole document, after it saved. */
  compact() { if (this.saver) this.send(COMPACTED, Y.encodeStateAsUpdate(this.doc)); }

  dispose() { this.leave(); this.stop?.(); window.removeEventListener('pagehide', this.leave); }

  private readonly leave = () => removeAwarenessStates(this.awareness, [this.doc.clientID], 'leave');

  private received(message: Record<string, unknown>) {
    if (message.type === 'joined') {
      const number = typeof message.instance === 'number' ? message.instance : 1;
      this.awareness.setLocalStateField('user', { name: `Instance ${number}`, color: colours[(number - 1) % colours.length] });
      // The seed first, so a new saver knows whether it holds the page as saved.
      if (message.seed === true) {
        // After a reconnect the server may have forgotten the page: what this
        // editor already holds becomes the session, instead of a fresh seed.
        if (this.seeded) this.send(UPDATE, Y.encodeStateAsUpdate(this.doc));
        else this.handlers.seed.forEach(handler => handler());
      }
      this.setSaver(message.saver === true);
      this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    } else if (message.type === 'saver') {
      this.setSaver(true);
    }
  }

  private frame(data: Uint8Array) {
    const body = data.subarray(1);
    if (data[0] === UPDATE || data[0] === COMPACTED) { Y.applyUpdate(this.doc, body, this); this.seeded = true; }
    else if (data[0] === AWARENESS) applyAwarenessUpdate(this.awareness, body, this);
  }

  private setSaver(saver: boolean) {
    if (saver === this.saver) return;
    this.saver = saver;
    this.handlers.saver.forEach(handler => handler(saver));
  }

  private send(kind: number, payload: Uint8Array) {
    const frame = new Uint8Array(payload.length + 1);
    frame[0] = kind;
    frame.set(payload, 1);
    live.send(frame);
  }
}
