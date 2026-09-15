import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import * as game from './game.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export function createServer(opts = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: opts.origin || '*', methods: ['GET', 'POST'] },
    pingInterval: 20000,
    pingTimeout: 30000,
  });

  const dist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(dist)) app.use(express.static(dist));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const notify = (code) => {
    const room = game.getRoom(code);
    if (!room) return;
    for (const p of room.players.values()) {
      const view = game.buildView(room, p.key);
      for (const sid of p.sockets) io.to(sid).emit('state', view);
    }
  };

  game.bindEmitter({ broadcast: notify });

  io.on('connection', (socket) => {
    let code = null;
    let key = null;

    const attach = (c, k) => {
      code = c;
      key = k;
      socket.join(c);
      const p = game.getPlayer(c, k);
      if (p) {
        p.sockets = [...(p.sockets || []), socket.id];
        p.offline = false;
      }
    };

    const err = (tag, msg) => socket.emit('error', { tag, msg });

    socket.on('createRoom', (data) => {
      if (code) return;
      const room = game.createRoom({ name: data?.name, avatar: data?.avatar });
      attach(room.code, room.hostKey);
      socket.emit('joined', { code: room.code, key: room.hostKey });
      notify(room.code);
    });

    socket.on('joinRoom', (data) => {
      if (code) return;
      const c = String(data?.code || '').toUpperCase().trim();
      const res = game.joinRoom(c, { name: data?.name, avatar: data?.avatar });
      if (res.error) return err('join', res.error);
      attach(res.room.code, res.player.key);
      socket.emit('joined', { code: res.room.code, key: res.player.key });
      notify(res.room.code);
    });

    socket.on('rejoin', (data) => {
      if (code) return;
      const res = game.rejoin(String(data?.code || '').toUpperCase().trim(), String(data?.key || ''));
      if (res.error) return err('rejoin', res.error);
      attach(res.code, res.key);
      socket.emit('joined', { code: res.code, key: res.key });
      notify(res.code);
    });

    socket.on('startGame', () => {
      const r = game.getRoom(code);
      if (!r) return;
      const e = game.startGame(r);
      if (e.error) err('start', e.error);
    });

    socket.on('settings', (s) => {
      const r = game.getRoom(code);
      if (r && r.hostKey === key) game.applySettings(r, s);
    });

    socket.on('kick', (targetKey) => {
      const r = game.getRoom(code);
      if (!r || r.hostKey !== key) return;
      const p = game.kickPlayer(r, targetKey);
      if (p && p.key) {
        for (const sid of p.sockets) io.to(sid).emit('kicked');
        socket.leave(r.code);
      }
    });

    socket.on('closeRoom', () => {
      const r = game.getRoom(code);
      if (r && r.hostKey === key) {
        io.in(r.code).emit('roomClosed');
        game.destroyRoom(r);
      }
    });

    socket.on('newGame', () => {
      const r = game.getRoom(code);
      if (r && r.hostKey === key) {
        game.toLobby(r);
        game.startGame(r);
      }
    });

    socket.on('backToLobby', () => {
      const r = game.getRoom(code);
      if (r && r.hostKey === key) game.toLobby(r);
    });

    socket.on('chat', (msg) => {
      const r = game.getRoom(code);
      const p = game.getPlayer(code, key);
      const e = game.chatMessage(r, p, msg);
      if (e.error) err('chat', e.error);
    });

    socket.on('nightAction', (d) => {
      const r = game.getRoom(code);
      const p = game.getPlayer(code, key);
      const e = game.nightAction(r, p, d?.type, d?.target);
      if (e.error) err('action', e.error);
    });

    socket.on('vote', (targetKey) => {
      const r = game.getRoom(code);
      const p = game.getPlayer(code, key);
      const e = game.voteAction(r, p, targetKey);
      if (e.error) err('vote', e.error);
    });

    socket.on('skip', () => {
      const r = game.getRoom(code);
      const p = game.getPlayer(code, key);
      const e = game.skipDiscuss(r, p);
      if (e.error) err('skip', e.error);
    });

    socket.on('leave', () => {
      const r = game.getRoom(code);
      const p = game.getPlayer(code, key);
      game.leaveRoom(r, p);
      code = null;
      key = null;
    });

    socket.on('disconnect', () => {
      if (code) {
        const r = game.getRoom(code);
        const p = game.getPlayer(code, key);
        if (r && p) {
          p.sockets = (p.sockets || []).filter((s) => s !== socket.id);
          game.handleDisconnect(r, p);
        }
      }
    });
  });

  setInterval(() => game.sweep(), 15_000);

  return { app, server, io };
}

const PORT = Number(process.env.PORT) || 3001;

if (process.argv[1] && url.fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { server } = createServer();
  server.listen(PORT, () => console.log(`[mafia] server on http://localhost:${PORT}`));
}