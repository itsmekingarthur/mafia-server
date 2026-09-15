import { broadcastRoom } from './emit.js';
import { aliveList } from './players.js';
import { beginVote, resolveDoctor, resolveMafia, resolveVotes, setPhase } from './phases.js';

export function nightAction(room, player, type, targetKey) {
  if (!player || room.phase !== `night-${type}`) return { error: 'ليس دورك الآن' };
  if (!player.alive) return { error: 'أنت خارج اللعبة' };
  const target = targetKey ? room.players.get(targetKey) : null;

  if (type === 'mafia') {
    if (player.role !== 'mafia') return { error: 'غير مسموح' };
    if (target && (!target.alive || target.role === 'mafia')) return { error: 'اختيار غير صالح' };
    room.mafiaVotes[player.key] = target ? target.key : null;
    const mafia = aliveList(room).filter((p) => p.role === 'mafia');
    if (mafia.every((p) => room.mafiaVotes[p.key] !== undefined)) { resolveMafia(room); }
    else broadcastRoom(room.code);
  } else if (type === 'doctor') {
    if (player.role !== 'doctor') return { error: 'غير مسموح' };
    if (!target || !target.alive) return { error: 'اختيار غير صالح' };
    if (target.key === player.key && !room.settings.doctorSelfHeal) return { error: 'لا يمكنك حماية نفسك' };
    room.doctorTarget = target.key;
    resolveDoctor(room);
  } else if (type === 'scout') {
    if (player.role !== 'detective') return { error: 'غير مسموح' };
    if (!target || !target.alive || target.key === player.key) return { error: 'اختيار غير صالح' };
    if (room.scoutTarget !== null) return { error: 'لقد كشفت مسبقًا' };
    room.scoutTarget = target.key;
    room.lastScout = { target: target.key, isMafia: target.role === 'mafia' };
    room.scoutReveal = true;
    setPhase(room, 'night-scout', 10);
  }
  return {};
}

export function skipDiscuss(room, player) {
  if (!player) return { error: 'غير موجود' };
  if (room.phase !== 'discuss') return { error: 'ليس وقت النقاش' };
  if (!player.alive) return { error: 'أنت خارج اللعبة' };
  if (room.discussSkips[player.key] !== undefined) return { error: 'ضغطت السكب مسبقًا' };
  room.discussSkips[player.key] = true;
  if (aliveList(room).every((p) => room.discussSkips[p.key])) {
    beginVote(room);
  } else {
    broadcastRoom(room.code);
  }
  return {};
}

export function voteAction(room, player, targetKey) {
  if (!player) return { error: 'غير موجود' };
  if (room.phase !== 'vote') return { error: 'ليس موسم التصويت' };
  if (!player.alive) return { error: 'أنت خارج اللعبة' };
  if (room.votes[player.key] !== undefined) return { error: 'لقد صوّتّ مسبقًا' };
  const target = targetKey ? room.players.get(targetKey) : null;
  if (target && (!target.alive || target.key === player.key)) return { error: 'اختيار غير صالح' };
  room.votes[player.key] = target ? target.key : 'abstain';
  if (aliveList(room).every((p) => room.votes[p.key] !== undefined)) { resolveVotes(room); }
  else broadcastRoom(room.code);
  return {};
}

export function chatMessage(room, player, message) {
  if (!player) return { error: 'غير موجود' };
  const text = String(message || '').slice(0, 200).trim();
  if (!text) return { error: 'رسالة فارغة' };
  if (player.role === 'mafia' && room.phase === 'night-mafia') {
    room.mafiaChat.push({ key: player.key, name: player.name, text, t: Date.now() });
    room.mafiaChat = room.mafiaChat.slice(-100);
    broadcastRoom(room.code);
    return {};
  }
  if (room.phase === 'discuss') {
    if (!player.alive) return { error: 'الموتى لا يتحدثون' };
    room.chat.push({ key: player.key, name: player.name, text, t: Date.now() });
    room.chat = room.chat.slice(-100);
    broadcastRoom(room.code);
    return {};
  }
  return { error: 'غير مسموح بالدردشة الآن' };
}