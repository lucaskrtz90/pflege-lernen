// Points, streak, badges and praise. Pure functions.
import { daysBetween } from './srs.js';

export const POINTS = { wissen: 10, sprech: 15, perfectRound: 20 };

/** ISO-8601 week, e.g. "2026-W47". */
export function isoWeek(day) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow); // Thursday of this week
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function updateStreak(streak, day) {
  const s = { count: 0, lastDay: null, jokerWeek: null, ...streak };
  if (!s.lastDay) return { streak: { ...s, count: 1, lastDay: day }, usedJoker: false };
  const gap = daysBetween(s.lastDay, day);
  if (gap <= 0) return { streak: s, usedJoker: false };
  if (gap === 1) return { streak: { ...s, count: s.count + 1, lastDay: day }, usedJoker: false };
  const week = isoWeek(day);
  if (gap === 2 && s.jokerWeek !== week) {
    return { streak: { ...s, count: s.count + 1, lastDay: day, jokerWeek: week }, usedJoker: true };
  }
  return { streak: { ...s, count: 1, lastDay: day }, usedJoker: false };
}

/** The streak to show today: 0 once it can no longer be continued. */
export function currentStreak(streak, day) {
  if (!streak || !streak.lastDay) return 0;
  const gap = daysBetween(streak.lastDay, day);
  if (gap <= 1) return streak.count;
  if (gap === 2 && streak.jokerWeek !== isoWeek(day)) return streak.count;
  return 0;
}

const streakAt = (n) => (st) => st.streak.count >= n;
const pointsAt = (n) => (st) => st.points >= n;

export const BADGES = [
  { id: 'first-round', title: 'Erster Schritt', text: 'Erste Runde geschafft', icon: 'play', test: (st) => st.counters.rounds >= 1 },
  { id: 'streak-3', title: '3 Tage dabei', text: '3 Tage in Folge gelernt', icon: 'flame', test: streakAt(3) },
  { id: 'streak-7', title: 'Eine ganze Woche', text: '7 Tage in Folge gelernt', icon: 'flame', test: streakAt(7) },
  { id: 'streak-14', title: 'Zwei Wochen stark', text: '14 Tage in Folge gelernt', icon: 'flame', test: streakAt(14) },
  { id: 'streak-30', title: 'Unaufhaltsam', text: '30 Tage in Folge gelernt', icon: 'flame', test: streakAt(30) },
  { id: 'points-500', title: '500 Punkte', text: '500 Punkte gesammelt', icon: 'star', test: pointsAt(500) },
  { id: 'points-2000', title: '2.000 Punkte', text: '2.000 Punkte gesammelt', icon: 'star', test: pointsAt(2000) },
  { id: 'points-5000', title: '5.000 Punkte', text: '5.000 Punkte gesammelt', icon: 'star', test: pointsAt(5000) },
  { id: 'sprech-25', title: 'Gute Stimme', text: '25 Sprechkarten richtig beantwortet', icon: 'speaker', test: (st) => st.counters.sprech >= 25 },
  { id: 'sprech-100', title: 'Prüfungsstimme', text: '100 Sprechkarten richtig beantwortet', icon: 'speaker', test: (st) => st.counters.sprech >= 100 },
  { id: 'perfect-5', title: 'Fehlerfrei', text: '5 Runden ohne Fehler', icon: 'check', test: (st) => st.counters.perfectRounds >= 5 },
  { id: 'first-disease', title: 'Erste Krankheit sitzt', text: 'Eine Krankheit komplett gefestigt', icon: 'trophy', test: (st, c) => c.masteredDiseases >= 1 },
  { id: 'five-diseases', title: 'Fünf sitzen', text: 'Fünf Krankheiten gefestigt', icon: 'trophy', test: (st, c) => c.masteredDiseases >= 5 },
  { id: 'all-diseases', title: 'Bereit für die Prüfung', text: 'Alle Krankheiten gefestigt', icon: 'trophy', test: (st, c) => c.masteredDiseases >= 16 },
  { id: 'prophylaxen-pro', title: 'Prophylaxen-Profi', text: 'Alle Prophylaxen einer Krankheit gefestigt', icon: 'shield', test: (st, c) => c.prophylaxenMastered },
  { id: 'exam-sim', title: 'Generalprobe', text: 'Eine Prüfungssimulation abgeschlossen', icon: 'mic', test: (st, c) => c.examDone },
];

export function newBadges(state, ctx, day) {
  return BADGES.filter((b) => !state.badges[b.id] && b.test(state, ctx)).map((b) => b.id);
}

export const PRAISE_RIGHT = [
  'Sehr gut!', '¡Eso es!', 'Genau richtig!', '¡Órale, qué bien!', 'Stark!', '¡Muy bien!',
  'Perfekt!', '¡Así se hace!', 'Das sitzt!', '¡Excelente!', 'Super gemacht!', '¡Eres una crack!',
  'Richtig – weiter so!', '¡Qué padre!', 'Du kannst das!', '¡Vas muy bien!', 'Klasse!',
  '¡A todo dar!', 'Wie in der Prüfung!', '¡Bien hecho!', 'Toll gelernt!', '¡Chido!',
];

export const PRAISE_WRONG = [
  'Fast! Gleich nochmal.', 'No pasa nada – das kommt wieder.', 'Nicht schlimm. So lernt man.',
  'Ánimo, ya casi.', 'Das üben wir noch einmal.', 'Tranquila, vas bien.',
  'Guter Versuch! Schau dir die Erklärung an.', 'Poco a poco – du schaffst das.',
  'Jeder Fehler macht dich sicherer.', '¡Tú puedes!',
];

export function praise(correct, rng) {
  const list = correct ? PRAISE_RIGHT : PRAISE_WRONG;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}
