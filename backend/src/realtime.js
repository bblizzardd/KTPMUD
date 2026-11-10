import { WebSocketServer, WebSocket } from 'ws';

// Browser clients authenticate with the first frame; tokens never enter URLs/logs.
export function attachRealtime(server, ctx) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const onUpgrade = (req, socket, head) => {
    if (req.url !== '/ws/alerts') { socket.destroy(); return; }
    const origin = req.headers.origin;
    const sameOrigin = origin === `http://${req.headers.host}`;
    if (origin && !sameOrigin && !ctx.config.corsOrigins.includes(origin)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  };
  server.on('upgrade', onUpgrade);
  wss.on('connection', ws => {
    ws.alive = true;
    const timeout = setTimeout(() => ws.close(4401, 'Authentication required'), 5000);
    timeout.unref();
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => clearTimeout(timeout));
    ws.on('message', async data => {
      if (ws.actor || ws.authenticating) { ws.close(4400, 'Already authenticated'); return; }
      ws.authenticating = true;
      try {
        const frame = JSON.parse(data.toString());
        if (frame.type !== 'authenticate' || typeof frame.token !== 'string' || frame.token.length > 4096) throw new Error('Invalid frame');
        ws.actor = await ctx.authenticateCaregiver(frame.token);
        clearTimeout(timeout);
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'authenticated' }));
      } catch { ws.close(4401, 'Invalid or expired token'); }
    });
  });
  const broadcast = alert => {
    const owner = ctx.db.get('patients', alert.patientId)?.caregiverId;
    for (const ws of wss.clients) {
      if (!ws.actor || ws.readyState !== WebSocket.OPEN) continue;
      if (ws.actor.expiresAt <= +ctx.now()) { ws.close(4401, 'Token expired'); continue; }
      if (ws.actor.id !== owner) continue;
      if (ws.bufferedAmount > 1024 * 1024) { ws.close(4408, 'Slow connection'); continue; }
      ws.send(JSON.stringify({ type: 'alert', alert }));
    }
  };
  ctx.events.on('alert', broadcast);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      if (ws.actor && ws.actor.expiresAt <= +ctx.now()) { ws.close(4401, 'Token expired'); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  return () => {
    clearInterval(heartbeat);
    ctx.events.off('alert', broadcast);
    server.off('upgrade', onUpgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}
