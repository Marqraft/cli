/**
 * Calls `changed` whenever the site changes: `marq dev` pushes a message over
 * /__marqraft/live when files change, whether this editor, another browser or
 * another program changed them. While that connection is down, `changed` runs
 * every 2 seconds instead, and the connection is retried. Returns a function
 * that stops listening.
 */
export function onSiteChange(changed: () => void): () => void {
  let socket: WebSocket | null = null;
  let poll: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const startPolling = () => { if (poll === undefined) poll = setInterval(changed, 2000); };
  const stopPolling = () => { if (poll !== undefined) { clearInterval(poll); poll = undefined; } };
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/__marqraft/live`);
    // Catch up on anything that changed while the connection was down.
    socket.onopen = () => { stopPolling(); changed(); };
    socket.onmessage = () => changed();
    socket.onclose = () => { if (stopped) return; startPolling(); retry = setTimeout(connect, 2000); };
  };

  startPolling();
  connect();
  return () => { stopped = true; stopPolling(); clearTimeout(retry); socket?.close(); };
}
