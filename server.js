import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CAMPUS_BOUNDS, CAMPUS_PLACES, CAMPUS_RADIUS } from './src/campus-layout.js';

const port = Number(process.env.COMMUNITY_WS_PORT || 3001);
const server = createServer();
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
const players = new Map();
const spawnPoints = [
  { x: -3.8, z: 1.5 }, { x: 3.8, z: 1.5 }, { x: -1.8, z: 4.2 }, { x: 1.8, z: -4.2 },
  { x: -4.2, z: -1.8 }, { x: 4.2, z: -1.8 }, { x: 0, z: 5.2 }, { x: 0, z: -5.2 },
];
const allowedEmotes = new Set(['👋', '💛', '✨', '😊', '🎉', '🌱']);
const interactionZones = new Map(CAMPUS_PLACES.map(({ id, x, z, interactionRadius }) => [
  id, { x, z, radius: interactionRadius + 0.35 },
]));

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast(payload, except) {
  const body = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) client.send(body);
  }
}

function safeName(value) {
  return String(value || 'Neighbor').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || 'Neighbor';
}

server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/community') {
    socket.destroy();
    return;
  }
  if (wss.clients.size >= 64) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request));
});

wss.on('connection', (socket) => {
  const id = randomUUID();
  const spawn = spawnPoints[players.size % spawnPoints.length];
  const player = { id, name: `Neighbor ${players.size + 1}`, ...spawn, color: '#ee8ba0', look: 0, moving: false, jumping: false };
  let lastMoveAt = Date.now();
  let lastChatAt = 0;
  let lastEmoteAt = 0;
  let lastInteractionAt = 0;
  players.set(id, player);
  send(socket, { type: 'welcome', id, spawn, players: [...players.values()].filter((item) => item.id !== id) });
  broadcast({ type: 'joined', player }, socket);

  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    const current = players.get(id);
    if (!current || !message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      current.name = safeName(message.name);
      current.color = /^#[0-9a-f]{6}$/i.test(message.color) ? message.color : current.color;
      current.look = Number.isFinite(message.look) ? Math.abs(Math.floor(message.look)) % 5 : 0;
      broadcast({ type: 'updated', player: current });
    } else if (message.type === 'move') {
      if (!Number.isFinite(message.x) || !Number.isFinite(message.z)
        || message.x < CAMPUS_BOUNDS.minX || message.x > CAMPUS_BOUNDS.maxX
        || message.z < CAMPUS_BOUNDS.minZ || message.z > CAMPUS_BOUNDS.maxZ
        || Math.hypot(message.x, message.z) > CAMPUS_RADIUS) return;
      const now = Date.now();
      const elapsed = Math.min((now - lastMoveAt) / 1000, 0.3);
      const allowedDistance = 8.8 * Math.max(elapsed, 0.05) + 0.2;
      if (Math.hypot(message.x - current.x, message.z - current.z) > allowedDistance) {
        send(socket, { type: 'moved', player: current, correction: true });
        return;
      }
      current.x = message.x;
      current.z = message.z;
      current.look = Number.isFinite(message.look) ? Math.max(-Math.PI, Math.min(Math.PI, message.look)) : current.look;
      current.moving = message.moving === true;
      current.jumping = message.jumping === true;
      lastMoveAt = now;
      broadcast({ type: 'moved', player: current });
    } else if (message.type === 'chat') {
      const text = String(message.text || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 160);
      const now = Date.now();
      if (text && now - lastChatAt >= 700) {
        lastChatAt = now;
        broadcast({ type: 'chat', id, name: current.name, text, time: now });
      }
    } else if (message.type === 'emote') {
      const now = Date.now();
      if (now - lastEmoteAt >= 300) {
        lastEmoteAt = now;
        const emote = allowedEmotes.has(message.emote) ? message.emote : '👋';
        broadcast({ type: 'emote', id, emote });
      }
    } else if (message.type === 'interact') {
      const now = Date.now();
      const zone = interactionZones.get(message.place);
      const nearby = zone && Math.hypot(current.x - zone.x, current.z - zone.z) <= zone.radius;
      if (nearby && now - lastInteractionAt >= 1800) {
        lastInteractionAt = now;
        broadcast({ type: 'interact', id, name: current.name, place: message.place, time: now });
      }
    }
  });

  socket.on('close', () => {
    players.delete(id);
    broadcast({ type: 'left', id });
  });
});

server.listen(port, () => console.log(`Virtual Campus presence server listening on :${port}`));
