// The editor's one connection to `marq dev`: /__marqraft/live carries
// site-wide change notices ({"type": "changed"}) and the co-editing session
// of the open page (JSON messages and binary frames, see collab.ts).

type Listener = {
  /** The connection (re)opened. */
  open?: () => void;
  text?: (message: Record<string, unknown>) => void;
  binary?: (data: Uint8Array) => void;
};

class LiveConnection {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private poll: ReturnType<typeof setInterval> | undefined;
  private started = false;

  get open() { return this.socket?.readyState === WebSocket.OPEN; }

  listen(listener: Listener): () => void {
    this.listeners.add(listener);
    this.start();
    if (this.open) listener.open?.();
    return () => { this.listeners.delete(listener); };
  }

  /** Sends when connected; a session re-sends what matters when it rejoins. */
  send(data: string | Uint8Array): boolean {
    if (!this.open) return false;
    this.socket!.send(data);
    return true;
  }

  private start() {
    if (this.started) return;
    this.started = true;
    this.connect();
  }

  private connect() {
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/__marqraft/live`);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => { this.stopPolling(); this.listeners.forEach(listener => listener.open?.()); };
    socket.onmessage = event => {
      if (typeof event.data === 'string') {
        let message: Record<string, unknown>;
        try { message = JSON.parse(event.data); } catch { return; }
        this.listeners.forEach(listener => listener.text?.(message));
      } else {
        const data = new Uint8Array(event.data as ArrayBuffer);
        this.listeners.forEach(listener => listener.binary?.(data));
      }
    };
    // While the connection is down, changes are checked every 2 seconds and
    // the connection is retried.
    socket.onclose = () => { this.startPolling(); setTimeout(() => this.connect(), 2000); };
  }

  private startPolling() {
    if (this.poll !== undefined) return;
    this.poll = setInterval(() => this.listeners.forEach(listener => listener.text?.({ type: 'changed' })), 2000);
  }

  private stopPolling() {
    if (this.poll !== undefined) { clearInterval(this.poll); this.poll = undefined; }
  }
}

export const live = new LiveConnection();

/**
 * Calls `changed` whenever the site changes — whether this editor, another
 * browser or another program changed it — and once whenever the connection
 * (re)opens, to catch up. Returns a function that stops listening.
 */
export function onSiteChange(changed: () => void): () => void {
  return live.listen({ open: changed, text: message => { if (message.type === 'changed') changed(); } });
}
