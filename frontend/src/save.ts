export type SaveState = 'saved' | 'saving' | 'pending' | 'error' | 'conflict';
export type SaveResult = { revision: string };

/** One request per document, with generation tracking and explicit stale-write recovery. */
export class SaveQueue {
  revision: string;
  source: string;
  state: SaveState = 'saved';
  private generation = 0;
  private savedGeneration = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private disposed = false;
  constructor(source: string, revision: string, private write: (source: string, revision: string) => Promise<SaveResult>, private update: (state: SaveState, message?: string) => void, private recover: (source: string, revision: string) => void, private clearRecovery: () => void) {
    this.source = source; this.revision = revision;
  }
  private status(state: SaveState, message?: string) { this.state = state; this.update(state, message); }
  edit(source: string) {
    if (source === this.source) return;
    this.source = source; this.generation++;
    this.recover(source, this.revision);
    if (this.state === 'conflict') return;
    this.status('pending');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 650);
  }
  get dirty() { return this.generation !== this.savedGeneration; }
  async flush() {
    if (this.running || !this.dirty || this.state === 'conflict' || this.disposed) return;
    this.running = true;
    const generation = this.generation, source = this.source;
    this.status('saving');
    try {
      const result = await this.write(source, this.revision);
      this.revision = result.revision;
      this.savedGeneration = generation;
      // An external-change notice may have arrived while this request was in flight.
      if ((this.state as SaveState) !== 'conflict') this.status(this.dirty ? 'pending' : 'saved');
      if (!this.dirty && (this.state as SaveState) !== 'conflict') this.clearRecovery();
      else this.recover(this.source, this.revision);
    } catch (error) {
      const e = error as Error & { status?: number };
      this.status(e.status === 409 ? 'conflict' : 'error', e.message);
      this.recover(this.source, this.revision);
    } finally { this.running = false; }
    if (this.dirty && this.state === 'pending') await this.flush();
  }
  conflict() { clearTimeout(this.timer); this.status('conflict', 'This document changed on disk. Both versions are available.'); }
  rebase(revision: string) { this.revision = revision; this.status('pending'); this.generation++; void this.flush(); }
  dispose() { this.disposed = true; clearTimeout(this.timer); }
}
