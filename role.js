import crypto from 'node:crypto';

function rolesFor(n) {
  let mafia;
  if (n <= 6) mafia = 1;
  else if (n <= 10) mafia = 2;
  else mafia = 3;
  return { mafia, doctor: 1, detective: 1, citizens: n - mafia - 2 };
}

const ROLE_LABEL = { mafia: 'مافيا', doctor: 'طبيب', detective: 'كشاف', citizen: 'مواطن' };

export function roleLabel(r) {
  return ROLE_LABEL[r] || r;
}

export function assignRoles(players) {
  const r = rolesFor(players.length);
  const pool = [...Array(r.mafia).fill('mafia'), 'doctor', 'detective', ...Array(r.citizens).fill('citizen')];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  players.forEach((p, i) => {
    p.role = pool[i];
    p.alive = true;
    p.deathCause = null;
    p.roleRevealed = false;
    p.offline = false;
  });
}