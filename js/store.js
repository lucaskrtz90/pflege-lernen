// Persistent learning state: load, save, backup code.
export const KEY = 'pflegeapp.v1';

export function freshState() {
  return {
    v: 1, name: '', examDate: '2027-01-15', dailyMinutes: 45, points: 0,
    streak: { count: 0, lastDay: null, jokerWeek: null },
    badges: {}, items: {}, days: {},
    counters: { sprech: 0, rounds: 0, perfectRounds: 0 },
  };
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

function normalise(raw) {
  const f = freshState();
  const s = { ...f, ...raw };
  s.streak = { ...f.streak, ...(isObj(raw.streak) ? raw.streak : {}) };
  s.counters = { ...f.counters, ...(isObj(raw.counters) ? raw.counters : {}) };
  for (const k of ['badges', 'items', 'days']) if (!isObj(s[k])) s[k] = {};
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  if (![15, 30, 45, 60].includes(s.dailyMinutes)) s.dailyMinutes = f.dailyMinutes;
  if (typeof s.examDate !== 'string' || !DAY.test(s.examDate)) s.examDate = f.examDate;
  if (typeof s.points !== 'number' || !(s.points >= 0)) s.points = 0;
  if (typeof s.name !== 'string') s.name = '';
  s.badges = Object.fromEntries(Object.entries(s.badges).filter(([, d]) => typeof d === 'string' && DAY.test(d)));
  return s;
}

function defaultStorage() {
  try { return globalThis.localStorage; } catch (e) { return undefined; }
}

export function load(storage = defaultStorage()) {
  let raw = null;
  try { raw = storage.getItem(KEY); } catch (e) { return freshState(); }
  if (raw === null || raw === undefined) return freshState();
  try {
    const parsed = JSON.parse(raw);
    if (isObj(parsed) && parsed.v === 1) return normalise(parsed);
  } catch (e) { /* fall through */ }
  try { storage.setItem(KEY + '.broken', raw); } catch (e) { /* nothing more we can do */ }
  return freshState();
}

export function save(state, storage = defaultStorage()) {
  try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
}

/**
 * Folds another copy of the state (e.g. written by a second open tab) into `target`, in place,
 * keeping whichever side is further along. Settings and name stay as they are in `target`.
 */
export function mergeInto(target, other) {
  if (!isObj(other)) return target;
  const o = normalise(other);
  for (const [id, st] of Object.entries(o.items)) {
    const mine = target.items[id];
    if (!mine || (st.seen || 0) > (mine.seen || 0)) target.items[id] = st;
  }
  for (const [day, d] of Object.entries(o.days)) {
    const mine = target.days[day];
    if (!mine || (d.answers || 0) > (mine.answers || 0)) target.days[day] = d;
  }
  for (const [id, date] of Object.entries(o.badges)) if (!target.badges[id]) target.badges[id] = date;
  target.points = Math.max(target.points, o.points);
  for (const k of Object.keys(target.counters)) target.counters[k] = Math.max(target.counters[k], o.counters[k] || 0);
  if (o.streak.lastDay && (!target.streak.lastDay || o.streak.lastDay > target.streak.lastDay)) target.streak = o.streak;
  return target;
}

export function exportCode(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importCode(code) {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
    if (isObj(parsed) && parsed.v === 1 && isObj(parsed.items)) return normalise(parsed);
  } catch (e) { /* fall through */ }
  throw new Error('Ungültiger Code');
}
