// Builds rounds and the daily plan. Pure functions.
import { isDue, status, daysBetween } from './srs.js';

export const ROUND_SIZE = 7;

const allItems = (disease) => disease.blocks.flatMap((b) => b.items);

/** One station: due items first, then unseen in file order, then the weakest seen ones. */
export function stationRound(block, states, day, rng) {
  const due = [], unseen = [], rest = [];
  for (const it of block.items) {
    const st = states[it.id];
    if (!st) unseen.push(it);
    else if (isDue(st, day)) due.push(it);
    else rest.push(it);
  }
  due.sort((a, b) => (states[a.id].due < states[b.id].due ? -1 : 1));
  const picked = [...due, ...unseen].slice(0, ROUND_SIZE);
  if (picked.length === 0) {
    rest.sort((a, b) => states[a.id].level - states[b.id].level);
    return rest.slice(0, ROUND_SIZE);
  }
  return picked;
}

/** Exam weight of an item: Prophylaxen and Pflegeplanung first, Anatomie last. */
function rank(item, blockId) {
  if (item.sub === 'prophylaxen') return 0;
  if (blockId === 'pflegeplanung') return 1;
  if (blockId === 'anatomie') return 3;
  return 2;
}

/** Due items across all loaded diseases: oldest first, then by exam weight. */
export function reviewRound(diseases, states, day, rng) {
  const due = [];
  let order = 0;
  for (const d of diseases) for (const b of d.blocks) for (const it of b.items) {
    if (isDue(states[it.id], day)) due.push({ it, due: states[it.id].due, rank: rank(it, b.id), order: order++ });
  }
  due.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.rank - b.rank || a.order - b.order));
  return due.slice(0, ROUND_SIZE).map((x) => x.it);
}

/** Returns a new queue in which queue[pos] comes again after 3–5 other questions. */
export function requeue(queue, pos, rng) {
  const gap = 3 + Math.min(2, Math.floor(rng() * 3));
  const at = Math.min(queue.length, pos + 1 + gap);
  return [...queue.slice(0, at), queue[pos], ...queue.slice(at)];
}

/** Oral exam simulation: the first Sprechkarte of every block, in block order. */
export function examRound(disease) {
  return disease.blocks
    .map((b) => b.items.find((it) => it.type === 'sprech'))
    .filter(Boolean);
}

export function dailyPlan(index, diseases, states, state, day) {
  const byId = new Map(diseases.map((d) => [d.id, d]));
  let dueCount = 0, next = null, masteredDiseases = 0, startedDiseases = 0;
  for (const entry of index) {
    const d = byId.get(entry.id);
    if (!d) continue;
    const items = allItems(d);
    dueCount += items.filter((it) => isDue(states[it.id], day)).length;
    if (items.some((it) => states[it.id])) startedDiseases++;
    if (status(items, states) === 'gefestigt') masteredDiseases++;
    if (!next) {
      const block = d.blocks.find((b) => b.items.some((it) => !states[it.id]));
      if (block) next = { diseaseId: d.id, blockId: block.id };
    }
  }
  const firstDay = Object.keys(state.days || {}).sort()[0];
  const targetDiseases = firstDay ? Math.max(0, Math.floor(daysBetween(firstDay, day) / 3.5)) : 0;
  return {
    dueCount, next, masteredDiseases, startedDiseases, targetDiseases,
    daysLeft: Math.max(0, daysBetween(day, state.examDate)),
    onTrack: startedDiseases >= Math.min(targetDiseases, diseases.length),
  };
}
