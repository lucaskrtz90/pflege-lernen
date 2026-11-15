// Streak, points and badges.
import { icon } from '../icons.js';
import { esc, formatDate } from '../ui.js';
import { today } from '../srs.js';
import { BADGES, isoWeek, currentStreak } from '../rewards.js';

export function render(root, app) {
  const st = app.state;
  const jokerFree = st.streak.jokerWeek !== isoWeek(today());
  const earned = BADGES.filter((b) => st.badges[b.id]).length;
  root.innerHTML = `
    <header><p class="muted small">Deine Erfolge</p><h1>Das hast du schon geschafft</h1></header>
    <section class="stat-grid">
      <div class="stat"><b class="num">${currentStreak(st.streak, today())}</b><span>Tage in Folge</span></div>
      <div class="stat"><b class="num">${Number(st.points) || 0}</b><span>Punkte</span></div>
      <div class="stat"><b class="num">${st.counters.rounds}</b><span>Runden</span></div>
    </section>
    <section class="card row">
      <span class="tile" style="--c:var(--warn)">${icon('flame', 26)}</span>
      <div class="grow"><b>Wochen-Joker</b>
        <p class="muted small">${jokerFree ? 'Verfügbar: Ein verpasster Tag pro Woche unterbricht deine Serie nicht.' : 'Diese Woche schon benutzt. Nächste Woche gibt es einen neuen.'}</p></div>
      <span class="chip ${jokerFree ? 'ok' : 'plain'}">${jokerFree ? 'Bereit' : 'Benutzt'}</span>
    </section>
    <h3 style="margin:6px 4px -4px">Auszeichnungen · ${earned} von ${BADGES.length}</h3>
    <section class="badge-grid">
      ${BADGES.map((b) => {
        const got = st.badges[b.id];
        return `<div class="badge ${got ? '' : 'off'}"><div class="medal">${icon(got ? b.icon : 'lock', 26)}</div>
          <b>${esc(b.title)}</b><span>${esc(b.text)}</span>${got ? `<span>${formatDate(got)}</span>` : ''}</div>`;
      }).join('')}
    </section>`;
}
