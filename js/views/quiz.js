// A round of questions: station, review or oral exam simulation.
import { icon } from '../icons.js';
import { esc, shuffle } from '../ui.js';
import * as srs from '../srs.js';
import { stationRound, reviewRound, examRound, requeue } from '../session.js';
import { POINTS, praise, updateStreak } from '../rewards.js';
import { BLOCK_NAMES, SUB_NAMES } from '../content.js';
import { canSpeak, speak, stop } from '../speech.js';

const MAX_REQUEUE = 2;

export function render(root, app, { kind, a: diseaseId, b: blockId }) {
  const st = app.state;
  const day = srs.today();
  const disease = app.diseases.get(diseaseId);
  let queue = [], back = '#/';

  if (kind === 'station' && disease) {
    const block = disease.blocks.find((x) => x.id === blockId);
    queue = block ? stationRound(block, st.items, day, Math.random) : [];
    back = `#/k/${diseaseId}`;
  } else if (kind === 'exam' && disease) {
    queue = examRound(disease);
    back = `#/k/${diseaseId}`;
  } else if (kind === 'review') {
    queue = reviewRound(app.loaded(), st.items, day, Math.random);
  }
  if (!queue.length) {
    app.toast('Hier gibt es gerade nichts zu lernen.');
    app.go(back);
    return;
  }

  // Where each item lives, for the small heading above the question.
  const where = new Map();
  for (const d of app.loaded()) for (const b of d.blocks) for (const it of b.items) where.set(it.id, { d, b });

  const round = { answered: 0, correct: 0, points: 0, learned: 0, strengthened: 0, wrong: new Set(), seen: new Set(), requeued: {}, exam: [] };
  let pos = 0, shownAt = 0, closed = false;

  function leave() {
    if (confirm('Runde beenden? Deine bisherigen Antworten sind gespeichert.')) { stop(); app.go(back); }
  }

  function frame(item, bodyHtml, { hint = '', speakText = '', footHtml }) {
    const w = where.get(item.id);
    const e = w ? app.entry(w.d.id) : null;
    const sub = item.sub ? ` · ${SUB_NAMES[item.sub]}` : '';
    root.style.setProperty('--c', e ? e.color : 'var(--accent)');
    root.innerHTML = `
      <div class="quiz-top">
        <button class="icon-btn" id="close" aria-label="Runde beenden">${icon('x', 22)}</button>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${queue.length}" aria-valuenow="${pos}"><i style="width:${Math.round((pos / queue.length) * 100)}%"></i></div>
        <span class="small muted num">${pos + 1}/${queue.length}</span>
      </div>
      ${w ? `<div class="kicker">${icon(w.b.id, 18)} ${esc(e.name)} · ${BLOCK_NAMES[w.b.id]}${esc(sub)}</div>` : ''}
      ${bodyHtml}
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      <div id="body"></div>
      <div class="quiz-foot row">
        ${speakText && canSpeak() ? `<button class="icon-btn" id="say" aria-label="Vorlesen">${icon('speaker', 22)}</button>` : ''}
        <div class="grow">${footHtml}</div>
      </div>`;
    root.querySelector('#close').onclick = leave;
    const say = root.querySelector('#say');
    if (say) say.onclick = () => speak(speakText);
    window.scrollTo(0, 0);
    shownAt = Date.now();
    return root.querySelector('#body');
  }

  const checkBtn = (label = 'Prüfen') => `<button class="btn btn-primary" id="check" disabled>${label}</button>`;
  const optHtml = (text, i, cls = '') => `<button class="opt ${cls}" data-i="${i}"><span class="mark">${icon('check', 15)}</span><span>${esc(text)}</span></button>`;

  // ---- Choice questions: mc, cloze, multi, tf ----
  function showChoice(item, v) {
    const multi = v.form === 'multi', tf = v.form === 'tf', cloze = v.form === 'cloze';
    const opts = tf ? [{ t: 'Richtig', i: 1 }, { t: 'Falsch', i: 0 }] : shuffle(v.options.map((t, i) => ({ t, i })));
    const right = new Set(tf ? [v.correct ? 1 : 0] : multi ? v.correct : [v.correct]);
    const picked = new Set();
    const qHtml = cloze
      ? `<p class="question">${esc(v.q).replace('___', '<span class="cloze-gap" id="gap">&nbsp;</span>')}</p>`
      : `<p class="question">${esc(v.q)}</p>`;
    const hint = multi ? `Wähle ${right.size} Antworten.` : tf ? 'Richtig oder falsch?' : cloze ? 'Welches Wort passt in die Lücke?' : '';
    const body = frame(item, qHtml, { hint, speakText: v.q, footHtml: checkBtn() });
    body.className = tf ? 'tf' : cloze ? 'chips' : 'options';
    body.innerHTML = opts.map((o) => optHtml(o.t, o.i, multi ? 'square' : '')).join('');
    const check = root.querySelector('#check');

    body.querySelectorAll('.opt').forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        if (multi) { picked.has(i) ? picked.delete(i) : picked.add(i); }
        else { picked.clear(); picked.add(i); }
        body.querySelectorAll('.opt').forEach((x) => x.classList.toggle('sel', picked.has(Number(x.dataset.i))));
        if (cloze) root.querySelector('#gap').textContent = v.options[i];
        check.disabled = picked.size === 0;
      };
    });
    check.onclick = () => {
      const ok = picked.size === right.size && [...picked].every((i) => right.has(i));
      body.classList.add('locked');
      body.querySelectorAll('.opt').forEach((x) => {
        const i = Number(x.dataset.i);
        x.classList.remove('sel');
        if (right.has(i)) x.classList.add('right');
        else if (picked.has(i)) x.classList.add('miss');
      });
      const solution = tf ? `Die Aussage ist ${v.correct ? 'richtig' : 'falsch'}.`
        : opts.filter((o) => right.has(o.i)).map((o) => o.t).join(' · ');
      finish(item, ok, v.form, { solution });
    };
  }

  // ---- Matching ----
  function showMatch(item, v) {
    const rights = shuffle(v.pairs.map((p, i) => ({ t: p[1], i })));
    const pairOf = new Map(); // left index -> right index
    let active = null;
    const body = frame(item, `<p class="question">${esc(v.q)}</p>`, { hint: 'Tippe erst links, dann rechts auf das passende Feld.', speakText: v.q, footHtml: checkBtn() });
    body.className = 'match';
    body.innerHTML = `<div class="col">${v.pairs.map((p, i) => `<button class="opt" data-l="${i}">${esc(p[0])}</button>`).join('')}</div>
      <div class="col">${rights.map((r) => `<button class="opt" data-r="${r.i}">${esc(r.t)}</button>`).join('')}</div>`;
    const check = root.querySelector('#check');
    const paint = () => {
      body.querySelectorAll('[data-l]').forEach((x) => {
        const l = Number(x.dataset.l);
        x.classList.toggle('sel', active === l);
        pairOf.has(l) ? x.setAttribute('data-pair', l) : x.removeAttribute('data-pair');
      });
      body.querySelectorAll('[data-r]').forEach((x) => {
        const hit = [...pairOf].find(([, r]) => r === Number(x.dataset.r));
        hit ? x.setAttribute('data-pair', hit[0]) : x.removeAttribute('data-pair');
      });
      check.disabled = pairOf.size !== v.pairs.length;
    };
    body.querySelectorAll('[data-l]').forEach((x) => {
      x.onclick = () => { const l = Number(x.dataset.l); pairOf.delete(l); active = active === l ? null : l; paint(); };
    });
    body.querySelectorAll('[data-r]').forEach((x) => {
      x.onclick = () => {
        const r = Number(x.dataset.r);
        for (const [l, rr] of pairOf) if (rr === r) pairOf.delete(l);
        if (active !== null) { pairOf.set(active, r); active = null; }
        paint();
      };
    });
    check.onclick = () => {
      const ok = v.pairs.every((_, i) => pairOf.get(i) === i);
      body.classList.add('locked');
      body.querySelectorAll('[data-l]').forEach((x) => {
        const l = Number(x.dataset.l);
        x.removeAttribute('data-pair');
        x.classList.add(pairOf.get(l) === l ? 'right' : 'miss');
      });
      body.querySelectorAll('[data-r]').forEach((x) => x.removeAttribute('data-pair'));
      finish(item, ok, 'match', { pairs: v.pairs });
    };
  }

  // ---- Oral card ----
  function showSprech(item) {
    const body = frame(item, `<p class="question">${esc(item.q)}</p>`, {
      speakText: item.q,
      footHtml: `<button class="btn btn-primary" id="reveal">${icon('eye', 20)} Antwort zeigen</button>`,
    });
    body.innerHTML = `<div class="card speak-card"><span class="tile lg">${icon('mic', 30)}</span>
      <p><b>Antworte laut auf Deutsch.</b></p><p class="muted small">Wie in der Prüfung. Danach zeigst du dir die Musterantwort.</p></div>`;
    root.querySelector('#reveal').onclick = () => {
      const ticked = new Set();
      body.className = 'stack';
      body.innerHTML = `<div><h3 style="margin-bottom:8px">Musterantwort</h3><div class="answer-box">${esc(item.answer)}</div></div>
        <div><h3 style="margin-bottom:8px">Was hast du gesagt?</h3><div class="options">${item.points.map((p, i) => optHtml(p, i, 'square')).join('')}</div></div>`;
      const foot = root.querySelector('.quiz-foot');
      foot.innerHTML = `${canSpeak() ? `<button class="icon-btn" id="say2" aria-label="Musterantwort vorlesen">${icon('speaker', 22)}</button>` : ''}
        <div class="grow"><button class="btn btn-primary" id="done">Fertig</button></div>`;
      const say2 = foot.querySelector('#say2');
      if (say2) say2.onclick = () => speak(item.answer);
      body.querySelectorAll('.opt').forEach((x) => {
        x.onclick = () => {
          const i = Number(x.dataset.i);
          ticked.has(i) ? ticked.delete(i) : ticked.add(i);
          x.classList.toggle('sel', ticked.has(i));
        };
      });
      foot.querySelector('#done').onclick = () => {
        body.classList.add('locked');
        finish(item, srs.scoreSprech(ticked.size, item.points.length), 'sprech', { ticked: ticked.size, total: item.points.length });
      };
    };
  }

  // ---- Bookkeeping and feedback ----
  function finish(item, ok, form, info) {
    if (closed) return;
    stop();
    const prev = st.items[item.id];
    const next = srs.answer(prev, ok, day, form);
    st.items[item.id] = next;
    const firstTime = !round.seen.has(item.id);
    round.seen.add(item.id);
    if (firstTime) { round.answered++; if (ok) round.correct++; }

    let gained = 0;
    if (ok) {
      gained = item.type === 'sprech' ? POINTS.sprech : POINTS.wissen;
      st.points += gained; round.points += gained;
      if (item.type === 'sprech') st.counters.sprech++;
      if (!prev) round.learned++;
      if (next.maxLevel >= srs.MASTERED && (!prev || (prev.maxLevel || 0) < srs.MASTERED)) round.strengthened++;
    } else {
      round.wrong.add(item.id);
      const n = round.requeued[item.id] || 0;
      if (kind !== 'exam' && n < MAX_REQUEUE) { queue = requeue(queue, pos, Math.random); round.requeued[item.id] = n + 1; }
    }
    if (kind === 'exam') { const w = where.get(item.id); round.exam.push({ blockId: w ? w.b.id : '', ok }); }

    const d = st.days[day] || { answers: 0, correct: 0, seconds: 0 };
    st.days[day] = { answers: d.answers + 1, correct: d.correct + (ok ? 1 : 0), seconds: d.seconds };
    if (st.streak.lastDay !== day) {
      const s = updateStreak(st.streak, day);
      st.streak = s.streak;
      if (s.usedJoker) app.toast('Dein Wochen-Joker hat deine Serie gerettet!');
    }
    app.persist();
    sheet(item, ok, gained, info);
  }

  function sheet(item, ok, gained, info) {
    let detail = '';
    if (info.total !== undefined) {
      detail = `<p class="muted">${info.ticked} von ${info.total} Kernpunkten genannt.${ok ? '' : ' Lies die Musterantwort noch einmal laut vor – die Karte kommt bald wieder.'}</p>`;
    } else if (!ok && info.pairs) {
      detail = `<div><h3 style="margin-bottom:6px">Richtig ist</h3>${info.pairs.map((p) => `<p>${esc(p[0])} → <b>${esc(p[1])}</b></p>`).join('')}</div>`;
    } else if (!ok && info.solution) {
      detail = `<div><h3 style="margin-bottom:6px">Richtig ist</h3><p><b>${esc(info.solution)}</b></p></div>`;
    }
    const el = document.createElement('div');
    el.className = 'scrim';
    el.innerHTML = `<div class="sheet ${ok ? 'good' : 'again'}" role="dialog" aria-label="Rückmeldung">
      <div class="row"><span class="badge-dot">${icon(ok ? 'check' : 'refresh', 24)}</span>
        <span class="praise">${esc(praise(ok, Math.random))}</span>
        ${gained ? `<span class="points-fly num">+${gained}</span>` : ''}</div>
      ${detail}
      <div class="es-box"><h3>Explicación</h3><p lang="es">${esc(item.es)}</p></div>
      <button class="btn btn-primary" id="next">Weiter</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#next').onclick = () => {
      // Learning time runs from seeing the question until leaving the explanation.
      const seconds = Math.min(240, Math.max(1, Math.round((Date.now() - shownAt) / 1000)));
      const d = st.days[day] || { answers: 0, correct: 0, seconds: 0 };
      st.days[day] = { ...d, seconds: d.seconds + seconds };
      app.persist();
      el.remove(); pos++; pos >= queue.length ? end() : show();
    };
    el.querySelector('#next').focus({ preventScroll: true });
  }

  function end() {
    const perfect = round.wrong.size === 0 && round.answered >= 3;
    st.counters.rounds++;
    let bonus = 0;
    if (perfect) { st.counters.perfectRounds++; bonus = POINTS.perfectRound; st.points += bonus; }
    app.lastRound = {
      answered: round.answered, correct: round.correct, points: round.points + bonus, bonus, perfect,
      learned: round.learned, strengthened: round.strengthened, kind, diseaseId: diseaseId || null, exam: round.exam,
    };
    app.persist();
    app.go('#/ergebnis');
  }

  function show() {
    const item = queue[pos];
    if (item.type === 'sprech') return showSprech(item);
    const v = srs.pickVariant(item, st.items[item.id], Math.random);
    return v.form === 'match' ? showMatch(item, v) : showChoice(item, v);
  }

  show();
  return () => {
    closed = true;
    stop();
    document.querySelectorAll('.scrim').forEach((x) => x.remove());
    root.style.removeProperty('--c');
  };
}
