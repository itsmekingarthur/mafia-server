import { MAX_PLAYERS } from './config.js';
import { broadcastRoom } from './emit.js';

export function defaultSettings() {
  return {
    minPlayers: 3,
    revealTime: 20,
    mafiaTime: 50,
    nightTime: 40,
    announceTime: 18,
    discussTime: 150,
    voteTime: 60,
    resultTime: 15,
    doctorSelfHeal: true,
  };
}

export function applySettings(room, partial) {
  if (room.phase !== 'waiting') return;
  const s = room.settings;
  const n = (v, lo, hi, d) => Math.max(lo, Math.min(hi, typeof v === 'number' && !Number.isNaN(v) ? Math.round(v) : d));
  if (partial) {
    s.minPlayers = n(partial.minPlayers, 3, MAX_PLAYERS, 3);
    s.revealTime = n(partial.revealTime, 3, 60, 12);
    s.mafiaTime = n(partial.mafiaTime, 10, 120, 50);
    s.nightTime = n(partial.nightTime, 10, 120, 40);
    s.announceTime = n(partial.announceTime, 3, 60, 12);
    s.discussTime = n(partial.discussTime, 20, 600, 150);
    s.voteTime = n(partial.voteTime, 15, 300, 60);
    s.resultTime = n(partial.resultTime, 3, 60, 15);
    s.doctorSelfHeal = !!partial.doctorSelfHeal;
  }
  broadcastRoom(room.code);
}