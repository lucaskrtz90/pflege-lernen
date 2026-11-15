// One disease: its ten stations and the exam simulation.
import { icon } from '../icons.js';
import { esc, pct, ring, STATUS_LABEL } from '../ui.js';
import { progress, status, needsRefresh, isDue, today } from '../srs.js';
import { BLOCK_NAMES } from '../content.js';

export function render(root, app, { a: id }) {
  const d = app.diseases.get(id), e = app.entry(id);
  if (!d || !e) { app.go('#/'); return; }
  const st = app.state.items, day = today();
  const items = d.blocks.flatMap((b) => b.items);
  const p = progress(items, st);

  const stations = d.blocks.map((b, i) => {
    const s = status(b.items, st), bp = progress(b.items, st);
    const due = b.items.filter((it) => isDue(st[it.id], day)).length;
    const refresh = b.items.some((it) => needsRefresh(st[it.id]));
    const chip = refresh ? `<span class="chip warn">${icon('refresh', 14)} Auffrischen</span>`
      : due ? `<span class="chip">${due} fällig</span>`
      : `<span class="chip ${s === 'gefestigt' ? 'ok' : 'plain'}">${STATUS_LABEL[s]}</span>`;
    return `<button class="item ${s === 'gefestigt' ? 'done' : ''}" data-go="#/runde/${id}/${b.id}">
      <span class="numdot">${s === 'gefestigt' ? icon('check', 15) : i + 1}</span>
      <span class="tile" style="width:42px;height:42px;border-radius:13px">${icon(b.id, 22)}</span>
      <span class="grow"><span class="name">${BLOCK_NAMES[b.id]}</span>
        <span class="bar" style="display:block;margin-top:7px;height:6px"><i style="width:${pct(bp)}%"></i></span></span>
      ${chip}</button>`;
  }).join('');

  root.style.setProperty('--c', e.color);
  root.innerHTML = `
    <header class="row">
      <button class="icon-btn" data-go="#/" aria-label="Zurück">${icon('back', 22)}</button>
      <div class="grow"><p class="muted small">Krankheitsbild</p><h1>${esc(e.name)}</h1></div>
    </header>
    <section class="card row">
      <span class="tile lg">${icon(e.icon, 34)}</span>
      <div class="grow"><h2>${pct(p)} % gefestigt</h2>
        <p class="muted small">${items.length} Lerninhalte in 10 Stationen</p></div>
      ${ring(p, 56, 6)}
    </section>
    <button class="btn btn-primary" data-go="#/pruefung/${id}">${icon('mic', 20)} Prüfung üben</button>
    <p class="note" style="text-align:center;margin-top:-8px">Zehn Fragen wie in der mündlichen Prüfung – von Definition bis Pflegeplanung.</p>
    <h3 style="margin:6px 4px -4px">Stationen</h3>
    <section class="list" style="--c:${e.color}">${stations}</section>`;

  root.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => app.go(b.dataset.go); });
  return () => root.style.removeProperty('--c');
}
