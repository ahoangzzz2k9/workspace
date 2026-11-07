import crypto from 'node:crypto';

export const SESSION_COOKIE = 'cl_sid';
const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, key] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !key) return false;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(key, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 864e5);
  db.prepare(
    'INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(userId, sha256(token), created.toISOString(), expires.toISOString());
  return token;
}

export function userFromSession(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(sha256(token), new Date().toISOString());
  return row ?? null;
}

export function destroySession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function requireUser(ctx) {
  if (!ctx.user) {
    ctx.redirect(`/login?next=${encodeURIComponent(ctx.path)}`);
    return null;
  }
  return ctx.user;
}
