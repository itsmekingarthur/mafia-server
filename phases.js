import crypto from 'node:crypto';
import { broadcastRoom } from './emit.js';
import { aliveList, playerName } from './players.js';
import { assignRoles, roleLabel } from './role.js';

export function clearTimer(room) {
  if (room.phaseTimer) { clearTimeout(room.phaseTimer); room.phaseTimer = null; }
}

function setActors(room) {
  const alive = aliveList(room);
  if (room.phase === 'night-mafia') room.nightActors = alive.filter((p) => p.role === 'mafia').map((p) => p.key);
  else if (room.phase === 'night-doctor') room.nightActors = alive.filter((p) => p.role === 'doctor').map((p) => p.key);
  else if (room.phase === 'night-scout') room.nightActors = alive.filter((p) => p.role === 'detective').map((p) => p.key);
  else room.nightActors = [];
}

export function setPhase(room, phase, sec) {
  clearTimer(room);
  room.phase = phase;
  room.phaseStartedAt = Date.now();
  room.phaseEndsAt = sec ? Date.now() + sec * 1000 : null;
  setActors(room);
  if (phase !== 'gameover' && sec) {
    room.phaseTimer = setTimeout(() => step(room), Math.max(300, sec * 1000));
  }
  broadcastRoom(room.code);
}

function step(room) {
  if (room.deletedAt) return;
  switch (room.phase) {
    case 'reveal': startNight(room); break;
    case 'night-mafia': resolveMafia(room, true); break;
    case 'night-doctor': resolveDoctor(room, true); break;
    case 'night-scout': resolveScout(room); break;
    case 'announce': {
      const w = checkWin(room);
      if (w) { endGame(room, w); } else { room.discussSkips = {}; setPhase(room, 'discuss', room.settings.discussTime); }
      break;
    }
    case 'discuss': beginVote(room); break;
    case 'vote': resolveVotes(room); break;
    case 'result': afterResult(room); break;
    default: break;
  }
}

export function startGame(room) {
  if (room.phase !== 'waiting') return { error: 'اللعبة بدأت بالفعل' };
  const players = [...room.players.values()];
  if (players.length < room.settings.minPlayers) return { error: `تحتاج اللعبة إلى ${room.settings.minPlayers} لاعبين على الأقل` };
  assignRoles(players);
  room.round = 0;
  room.winner = null;
  room.revealAll = false;
  room.history = [];
  room.chat = [];
  room.mafiaChat = [];
  setPhase(room, 'reveal', room.settings.revealTime);
  return {};
}

function startNight(room) {
  room.round++;
  room.mafiaVotes = {};
  room.doctorTarget = null;
  room.scoutTarget = null;
  room.nightVictim = null;
  room.lastScout = null;
  room.nightEvents = null;
  room.votes = {};
  room.voteTally = null;
  room.voteSkipped = false;
  room.executedKey = null;
  room.announceMsg = null;
  room.resultMsg = null;
  room.scoutReveal = false;
  setPhase(room, 'night-mafia', room.settings.mafiaTime);
  return room;
}

function countBy(list) {
  const t = {};
  for (const v of list) t[v] = (t[v] || 0) + 1;
  return t;
}

function pickTop(tally) {
  const entries = Object.entries(tally);
  if (!entries.length) return null;
  let max = -1;
  const top = [];
  for (const [k, c] of entries) {
    if (c > max) { max = c; top.length = 0; top.push(k); }
    else if (c === max) top.push(k);
  }
  if (max <= 0) return null;
  return top[crypto.randomInt(top.length)];
}

export function resolveMafia(room) {
  room.nightVictim = pickTop(countBy(Object.values(room.mafiaVotes).filter(Boolean)));
  setPhase(room, 'night-doctor', room.settings.nightTime);
}

export function resolveDoctor(room) {
  if (aliveList(room).every((p) => p.role !== 'doctor')) { setPhase(room, 'night-scout', room.settings.nightTime); return; }
  setPhase(room, 'night-scout', room.settings.nightTime);
}

function killPlayer(room, key, cause) {
  const p = room.players.get(key);
  if (!p) return;
  p.alive = false;
  p.deathCause = cause;
  if (cause === 'executed') p.roleRevealed = true;
}

function checkWin(room) {
  const alive = aliveList(room);
  const maf = alive.filter((p) => p.role === 'mafia').length;
  const other = alive.length - maf;
  let w = null;
  if (maf === 0) w = 'citizens';
  else if (maf >= other) w = 'mafia';
  room.winner = w;
  return w;
}

function endGame(room, winner) {
  room.winner = winner || checkWin(room);
  room.revealAll = true;
  room.voteTally = null;
  room.resultMsg = null;
  setPhase(room, 'gameover', 0);
}

function resolveScout(room) {
  let died = null;
  let saved = false;
  if (room.nightVictim) {
    if (room.doctorTarget === room.nightVictim) saved = true;
    else { died = room.nightVictim; killPlayer(room, died, 'mafia-kill'); }
  }
  room.nightEvents = { died, saved };
  room.announceMsg = died
    ? `${playerName(room, died)} قُتل هذه الليلة.`
    : (saved ? 'الطبيب أنقذ الموتى الليلة! لم يمت أحد.' : 'لم يمت أحد هذه الليلة.');
  room.history.push({ t: Date.now(), round: room.round, type: 'night', died, saved });
  setPhase(room, 'announce', room.settings.announceTime);
}

export function beginVote(room) {
  room.votes = {};
  room.voteTally = null;
  room.voteSkipped = false;
  room.executedKey = null;
  room.resultMsg = null;
  room.discussSkips = {};
  setPhase(room, 'vote', room.settings.voteTime);
}

export function resolveVotes(room) {
  const alive = aliveList(room);
  const all = Object.values(room.votes);
  const abstainCount = all.filter((v) => v === 'abstain').length;
  room.voteTally = countBy(all.filter((v) => v && v !== 'abstain'));
  let executed = null;
  let skipped = false;
  if (abstainCount >= Math.ceil(alive.length / 2)) {
    skipped = true;
  } else if (alive.length >= 2) {
    const top = pickTop(room.voteTally);
    const runnerUp = alive
      .filter((p) => p.key !== top)
      .reduce((best, p) => {
        const c = room.voteTally[p.key] || 0;
        return (!best || c > best.c) ? { k: p.key, c } : best;
      }, null);
    if (top && (room.voteTally[top] || 0) > (runnerUp ? runnerUp.c : 0)) executed = top;
  } else if (alive.length === 1) {
    executed = alive[0].key;
  }
  room.executedKey = executed;
  room.voteSkipped = skipped;
  if (executed) {
    killPlayer(room, executed, 'executed');
    const p = room.players.get(executed);
    room.resultMsg = `${p.name} أُعدم... كان دوره: ${roleLabel(p.role)}`;
  } else if (skipped) {
    room.resultMsg = 'تم تخطي التصويت... لم يُعدم أحد';
  } else {
    room.resultMsg = 'تعادل في الأصوات... لم يُعدم أحد هذه الجولة';
  }
  room.history.push({ t: Date.now(), round: room.round, type: 'vote', tally: room.voteTally, executedKey: executed, abstains: abstainCount });
  setPhase(room, 'result', room.settings.resultTime);
}

function afterResult(room) {
  const w = checkWin(room);
  if (w) { endGame(room, w); return; }
  startNight(room);
}

export function toLobby(room) {
  clearTimer(room);
  room.phase = 'waiting';
  room.winner = null;
  room.revealAll = false;
  room.round = 0;
  room.history = [];
  room.chat = [];
  room.mafiaChat = [];
  room.nightActors = [];
  room.discussSkips = {};
  room.voteSkipped = false;
  room.announceMsg = null;
  room.resultMsg = null;
  for (const p of room.players.values()) {
    p.alive = true;
    p.deathCause = null;
    p.roleRevealed = false;
    p.role = 'citizen';
  }
  broadcastRoom(room.code);
}