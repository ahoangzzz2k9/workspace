import { layout, flashFrom } from '../views.js';
import { unreadCount } from '../data.js';

export function render(ctx, { title, active = '', body, description }) {
  const unread = unreadCount(ctx.db, ctx.user?.id);
  const html = layout({
    title,
    user: ctx.user,
    unread,
    active,
    body,
    flash: flashFrom(ctx.query),
    description
  });
  ctx.html = html;
}

export function withQuery(url, key, value) {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${key}=${encodeURIComponent(value)}${hash}`;
}

export function redirectOk(ctx, url, message) {
  ctx.redirect(withQuery(url, 'ok', message));
}

export function redirectErr(ctx, url, message) {
  ctx.redirect(withQuery(url, 'err', message));
}

const MAX_SKILLS = 20;

/** "React: 4" mỗi dòng → [{name, level}] */
export function parseSkills(text) {
  const seen = new Set();
  const skills = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const match = raw.match(/^(.*?)[\s:–-]*([1-5])$/);
    const name = (match ? match[1] : raw).replace(/[:\s]+$/, '').trim();
    const level = match ? Number(match[2]) : 3;
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push({ name: name.slice(0, 40), level: Math.min(5, Math.max(1, level)) });
    if (skills.length >= MAX_SKILLS) break;
  }
  return skills;
}

export function skillsToText(skills) {
  return (skills ?? [])
    .map((skill) => (typeof skill === 'string' ? skill : `${skill.name}: ${skill.level}`))
    .join('\n');
}

export function parseCsv(text, max = 10) {
  const seen = new Set();
  const out = [];
  for (const part of String(text ?? '').split(',')) {
    const value = part.trim().slice(0, 40);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? ''));
}

export function param(ctx, name, fallback = '') {
  const value = ctx.body?.[name];
  return typeof value === 'string' ? value.trim() : fallback;
}

export function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeNext(value) {
  const next = String(value ?? '');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/projects';
}
