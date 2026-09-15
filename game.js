import { MAX_PLAYERS } from './config.js';
import { bindEmitter } from './emit.js';
import { roleLabel } from './role.js';
import {
  createRoom, destroyRoom, getPlayer, getRoom, handleDisconnect,
  joinRoom, kickPlayer, leaveRoom, rejoin, sweep,
} from './rooms.js';
import { applySettings, defaultSettings } from './settings.js';
import { setPhase, startGame, toLobby } from './phases.js';
import { chatMessage, nightAction, skipDiscuss, voteAction } from './actions.js';
import { buildView } from './view.js';

export {
  MAX_PLAYERS, bindEmitter, roleLabel,
  createRoom, destroyRoom, getPlayer, getRoom, handleDisconnect,
  joinRoom, kickPlayer, leaveRoom, rejoin, sweep,
  applySettings, defaultSettings,
  setPhase, startGame, toLobby,
  chatMessage, nightAction, skipDiscuss, voteAction,
  buildView,
};