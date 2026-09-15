import crypto from 'node:crypto';

export function makePlayer(room, { name, avatar }) {
  const key = crypto.randomUUID();
  const p = {
    key, name: String(name || '').slice(0, 16) || 'لاعب', avatar: avatar ?? 0,
    role: 'citizen', alive: true, deathCause: null, roleRevealed: false,
    offline: false, sockets: [],
  };
  room.players.set(key, p);
  return p;
}

export function aliveList(room) {
  return [...room.players.values()].filter((p) => p.alive);
}

export function playerName(room, key) {
  const p = room.players.get(key);
  return p ? p.name : '؟';
}