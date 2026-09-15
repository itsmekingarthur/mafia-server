import crypto from 'node:crypto';
import { MAX_PLAYERS } from './config.js';
import { broadcastRoom } from './emit.js';
import { clearTimer } from './phases.js';
import { makePlayer } from './players.js';
import { defaultSettings } from './settings.js';

const rooms = new Map();

function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c;
  do {
    c = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join('');
  } while (rooms.has(c));
  return c;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function getPlayer(code, key) {
  const r = rooms.get(code);
  return r ? r.players.get(key) : null;
}

export function createRoom({ name, avatar }) {
  const code = genCode();
  const room = {
    code,
    settings: defaultSettings(),
    hostKey: null,
    players: new Map(),
    phase: 'waiting',
    phaseEndsAt: null,
    phaseStartedAt: null,
    phaseTimer: null,
    round: 0,
    winner: null,
    revealAll: false,
    history: [],
    chat: [],
    mafiaChat: [],
    nightActors: [],
    mafiaVotes: {},
    doctorTarget: null,
    scoutTarget: null,
    scoutReveal: false,
    nightVictim: null,
    lastScout: null,
    nightEvents: null,
    discussSkips: {},
    votes: {},
    voteTally: null,
    voteSkipped: false,
    executedKey: null,
    announceMsg: null,
    resultMsg: null,
    deletedAt: null,
  };
  const host = makePlayer(room, { name, avatar });
  room.hostKey = host.key;
  rooms.set(code, room);
  return room;
}

export function joinRoom(code, { name, avatar }) {
  const room = rooms.get(code);
  if (!room) return { error: 'الغرفة غير موجودة' };
  if (room.phase !== 'waiting') return { error: 'اللعبة بدأت بالفعل' };
  if (room.players.size >= MAX_PLAYERS) return { error: 'الغرفة ممتلئة' };
  if (name === '') return { error: 'اكتب اسمك' };
  const p = makePlayer(room, { name, avatar });
  broadcastRoom(room.code);
  return { room, player: p };
}

export function rejoin(code, key) {
  const room = rooms.get(code);
  if (!room) return { error: 'الغرفة غير موجودة' };
  const p = room.players.get(key);
  if (!p) return { error: 'لا يمكن إعادة الانضمام' };
  return { code: room.code, key: p.key };
}

export function kickPlayer(room, targetKey) {
  if (room.phase !== 'waiting') return;
  const p = room.players.get(targetKey);
  if (!p) return;
  room.players.delete(targetKey);
  if (room.hostKey === targetKey && room.players.size) room.hostKey = [...room.players.keys()][0];
  broadcastRoom(room.code);
  return p;
}

export function leaveRoom(room, player) {
  if (!room || !player) return;
  room.players.delete(player.key);
  if (room.hostKey === player.key && room.players.size) room.hostKey = [...room.players.keys()][0];
  if (room.players.size === 0) { destroyRoom(room); return; }
  broadcastRoom(room.code);
}

export function handleDisconnect(room, player) {
  if (player && player.sockets.length === 0) {
    player.offline = true;
    if (room.hostKey === player.key && room.players.size > 1) {
      const next = [...room.players.values()].find((p) => p.sockets.length > 0);
      if (next && room.hostKey === player.key) room.hostKey = next.key;
    }
    if (room.players.size === 0 || [...room.players.values()].every((p) => p.sockets.length === 0)) {
      room.deletedAt = Date.now();
    }
  }
  broadcastRoom(room.code);
}

export function destroyRoom(room) {
  clearTimer(room);
  room.deletedAt = Date.now();
  rooms.delete(room.code);
}

export function sweep() {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    const connected = [...room.players.values()].some((p) => p.sockets.length > 0);
    const grace = room.phase === 'waiting' ? 60_000 : 300_000;
    if (room.deletedAt && now - room.deletedAt > grace) destroyRoom(room);
    else if (!connected && room.players.size === 0) destroyRoom(room);
  }
}