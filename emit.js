let f = { broadcast: () => {} };

export function bindEmitter(fn) {
  f = fn;
}

export function broadcastRoom(code) {
  f.broadcast(code);
}