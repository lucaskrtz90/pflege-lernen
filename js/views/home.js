// Start screen: greeting, countdown, today's plan, disease list.
import { icon } from '../icons.js';
import { esc, pct, ring } from '../ui.js';
import { progress, status, today } from '../srs.js';
import { dailyPlan } from '../session.js';
import { currentStreak } from '../rewards.js';
import { BLOCK_NAMES } from '../content.js';

const allItems = (d) => d.blocks.flatMap((b) => b.items);

function welcome(root, app) {
  document.getElementById('nav').hidden = true;
  root.innerHTML = `
    <div class="card stack" style="margin-top:8vh">
      <div class="tile lg" style="--c:var(--accent)">${icon('sparkles', 32)}</div>
      <h1>¡Bienvenida!</h1>
      <p class="muted">Schön, dass du da bist. Hier lernst du Schritt für Schritt für deine Prüfung – auf Deutsch, mit Erklärungen auf Spanisch.</p>
      <div class="field"><label for="name">Wie heißt du?</label>
        <input class="input" id="name" autocomplete="given-name" maxlength="30" placeholder="Dein Vorname"></div>
      <div class="field"><label for="exam">Wann ist deine Prüfung?</label>
        <input class="input" id="exam" type="date" value="${esc(app.state.examDate)}"></div>
      <button class="btn btn-primary" id="start">Los geht's ${icon('chevron', 20)}</button>
    </div>`;
  root.querySelector('#start').onclick = () => {
    const name = root.querySelector('#name').value.trim();
    const exam = root.querySelector('#exam').value;
    app.state.name = name || 'du';
    if (/^\d{4}-\d{2}-\d{2}$/.test(exam)) app.state.examDate = exam;
    app.persist();
    document.getElementById('nav').hidden = false;
    render(root, app);
  };
}

export function render(root, app) {
  const st = app.state;
  if (!st.name) { welcome(root, app); return; }

  const day = today();
  const loaded = app.loaded();
  const plan = dailyPlan(app.index, loaded, st.items, st, day);
  const everything = loaded.flatMap(allItems);
  const total = progress(everything, st.items);
  const minutes = Math.round(((st.days[day] && st.days[day].seconds) || 0) / 60);
  const goal = st.dailyMinutes;
  const goalDone = minutes >= goal;

  let cta, ctaSub, target;
  if (plan.dueCount > 0) {
    cta = 'Heute lernen'; target = '#/wiederholen';
    ctaSub = plan.dueCount === 1 ? '1 Wiederholung wartet auf dich' : `${plan.dueCount} Wiederholungen warten auf dich`;
  } else if (plan.next) {
    const e = app.entry(plan.next.diseaseId);
    cta = everything.some((it) => st.items[it.id]) ? 'Weiter lernen' : 'Jetzt starten';
    target = `#/runde/${plan.next.diseaseId}/${plan.next.blockId}`;
    ctaSub = `Als Nächstes: ${e.name} · ${BLOCK_NAMES[plan.next.blockId]}`;
  } else {
    cta = 'Frei üben'; target = loaded[0] ? `#/k/${loaded[0].id}` : '#/';
    ctaSub = 'Für heute ist alles wiederholt. Stark!';
  }

  const track = plan.onTrack
    ? `<span class="chip ok">${icon('check', 15)} Du liegst gut im Plan</span>`
    : `<span class="chip warn">${icon('target', 15)} Heute eine Station mehr, dann passt es wieder</span>`;

  const rows = app.index.map((e) => {
    const d = app.diseases.get(e.id);
    if (!d) {
      const why = app.failed.has(e.id) ? 'Konnte nicht geladen werden' : 'Bald verfügbar';
      return `<button class="item" disabled style="--c:${e.color}">
        <span class="tile">${icon(e.icon, 26)}</span>
        <span class="grow"><span class="name">${esc(e.name)}</span><span class="sub" style="display:block">${why}</span></span>
        ${icon('lock', 18)}</button>`;
    }
    const items = allItems(d), p = progress(items, st.items), s = status(items, st.items);
    const sub = s === 'neu' ? 'Noch nicht begonnen' : s === 'gefestigt' ? 'Gefestigt' : `${pct(p)} % gefestigt`;
    return `<button class="item" data-go="#/k/${e.id}" style="--c:${e.color}">
      <span class="tile">${icon(e.icon, 26)}</span>
      <span class="grow"><span class="name">${esc(e.name)}</span><span class="sub" style="display:block">${sub}</span></span>
      ${ring(p, 40, 5, s === 'gefestigt' ? icon('check', 16) : '')}</button>`;
  }).join('');

  root.innerHTML = `
    <header class="row between hello">
      <div><p class="muted small">¡Hola!</p><h1>${esc(st.name === 'du' ? 'Schön, dass du da bist' : st.name)}</h1></div>
      <div class="row" style="gap:8px">
        <span class="chip warn" title="Tage in Folge">${icon('flame', 17)} <span class="num">${currentStreak(st.streak, day)}</span></span>
        <span class="chip gold" title="Punkte">${icon('star', 17)} <span class="num">${st.points}</span></span>
      </div>
    </header>

    <section class="card hero stack">
      <div class="row between">
        <div><div class="big num">${plan.daysLeft}</div><p class="muted">${plan.daysLeft === 1 ? 'Tag' : 'Tage'} bis zur Prüfung</p></div>
        ${icon('calendar', 34)}
      </div>
      <div>
        <div class="row between small" style="margin-bottom:6px"><span class="muted">Heute gelernt</span>
          <b class="num">${minutes} / ${goal} Min${goalDone ? ' ✓' : ''}</b></div>
        <div class="bar"><i style="width:${Math.min(100, Math.round((minutes / goal) * 100))}%"></i></div>
      </div>
      <button class="btn" data-go="${target}">${icon('play', 20)} ${cta}</button>
      <p class="muted small" style="text-align:center;margin-top:-4px">${esc(ctaSub)}</p>
    </section>

    <section class="card row">
      ${ring(total, 64, 7, `${pct(total)}%`)}
      <div class="grow stack" style="gap:8px">
        <div><h2>Dein Fortschritt</h2><p class="muted small">${plan.masteredDiseases} von ${app.index.length} Krankheiten gefestigt</p></div>
        <div>${track}</div>
      </div>
    </section>

    ${app.failed.size ? `<section class="card stack"><p><b>Inhalt konnte nicht geladen werden.</b></p>
      <button class="btn btn-small" id="retry">${icon('refresh', 18)} Nochmal versuchen</button></section>` : ''}

    <h3 style="margin:6px 4px -4px">Krankheitsbilder</h3>
    <section class="list">${rows}</section>`;

  root.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => app.go(b.dataset.go); });
  const retry = root.querySelector('#retry');
  if (retry) retry.onclick = () => app.reload();
}
