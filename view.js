import { aliveList } from './players.js';
import { roleLabel } from './role.js';

export function buildView(room, viewerKey) {
  const me = room.players.get(viewerKey);
  const isMafia = me && me.role === 'mafia';
  const alive = aliveList(room);
  const players = [...room.players.values()].map((p) => ({
    key: p.key,
    name: p.name,
    avatar: p.avatar,
    alive: p.alive,
    offline: p.offline,
    deathCause: p.deathCause,
    roleShown: p.roleRevealed ? roleLabel(p.role) : null,
    isMe: p.key === viewerKey,
    ...(room.revealAll ? { profileRole: roleLabel(p.role), isMafia: p.role === 'mafia' } : {}),
  }));

  const view = {
    code: room.code,
    myKey: viewerKey,
    hostKey: room.hostKey,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    round: room.round,
    settings: room.settings,
    winner: room.winner,
    revealAll: room.revealAll,
    players,
    nightActors: me ? (me.alive && room.nightActors.includes(viewerKey) ? room.nightActors : []) : [],
    mafiaChat: isMafia && room.phase === 'night-mafia' ? room.mafiaChat : [],
    chat: room.chat,
    history: room.history,
    nightEvents: room.nightEvents,
    scoutReveal: room.scoutReveal,
    announceMsg: room.announceMsg,
    resultMsg: room.resultMsg,
    voteTally: room.voteTally,
    voteSkipped: room.voteSkipped,
    executedKey: room.executedKey,
    participated: {
      mafiaVoted: Object.keys(room.mafiaVotes).length,
      mafiaTotal: alive.filter((p) => p.role === 'mafia').length,
      votedCount: Object.keys(room.votes).length,
      aliveTotal: alive.length,
      skipCount: room.phase === 'discuss' ? Object.keys(room.discussSkips || {}).length : 0,
    },
  };

  if (me) {
    view.myRole = roleLabel(me.role);
    view.dead = !me.alive;
    view.turn = me.alive && room.nightActors.includes(viewerKey);
    if (me.role === 'detective') view.lastScout = room.lastScout;
    if (room.phase === 'vote' && me.alive) view.ownVote = room.votes[viewerKey] !== undefined ? room.votes[viewerKey] : null;
  }
  return view;
}