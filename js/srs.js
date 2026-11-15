// Spaced repetition core. Pure functions, no browser APIs.
export const INTERVALS = [1, 3, 7, 14, 14]; // days until due, by level 1..5
export const MASTERED = 3;                  // maxLevel that counts as "gefestigt"

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export function today(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return today(new Date(y, m - 1, d + n, 12));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a, b) {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

export function answer(st, correct, day, form) {
  const prev = st || { level: 0, maxLevel: 0, due: day, lastForm: null, seen: 0, wrong: 0 };
  // Practising an item again before it is due is welcome, but it does not count as a new
  // repetition: mastery needs correct answers on different days.
  if (correct && st && st.due > day) {
    return { ...st, lastForm: form, seen: (st.seen || 0) + 1 };
  }
  const level = correct ? Math.min(5, (prev.level || 0) + 1) : 0;
  return {
    level,
    maxLevel: Math.max(prev.maxLevel || 0, level),
    due: correct ? addDays(day, INTERVALS[level - 1]) : day,
    lastForm: form,
    seen: (prev.seen || 0) + 1,
    wrong: (prev.wrong || 0) + (correct ? 0 : 1),
  };
}

export function isDue(st, day) {
  return !!st && st.due <= day;
}

export function needsRefresh(st) {
  return !!st && (st.maxLevel || 0) >= MASTERED && (st.level || 0) < MASTERED;
}

export function pickVariant(item, st, rng) {
  const all = item.variants;
  const other = st && st.lastForm ? all.filter((v) => v.form !== st.lastForm) : all;
  const pool = other.length ? other : all;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

export function scoreSprech(ticked, total) {
  return total > 0 && ticked >= Math.round(total * 0.7);
}

const maxOf = (states, id) => Math.min((states[id] && states[id].maxLevel) || 0, MASTERED);

export function progress(items, states) {
  if (!items.length) return 0;
  return items.reduce((sum, it) => sum + maxOf(states, it.id), 0) / (MASTERED * items.length);
}

export function status(items, states) {
  if (!items.length || !items.some((it) => states[it.id])) return 'neu';
  return items.every((it) => maxOf(states, it.id) >= MASTERED) ? 'gefestigt' : 'inArbeit';
}
