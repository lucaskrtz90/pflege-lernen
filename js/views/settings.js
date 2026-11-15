// Name, exam date, daily goal, backup and restore.
import { icon } from '../icons.js';
import { esc } from '../ui.js';
import { exportCode, importCode } from '../store.js';

export function render(root, app) {
  const st = app.state;
  const goals = [15, 30, 45, 60];
  root.innerHTML = `
    <header><p class="muted small">Einstellungen</p><h1>Deine App</h1></header>
    <section class="card stack">
      <div class="field"><label for="name">Dein Name</label>
        <input class="input" id="name" maxlength="30" value="${esc(st.name === 'du' ? '' : st.name)}" placeholder="Dein Vorname"></div>
      <div class="field"><label for="exam">Prüfungstermin</label>
        <input class="input" id="exam" type="date" value="${esc(st.examDate)}"></div>
      <div class="field"><label>Tagesziel in Minuten</label>
        <div class="seg" id="goal">${goals.map((g) => `<button data-g="${g}" class="${g === st.dailyMinutes ? 'on' : ''}">${g}</button>`).join('')}</div></div>
    </section>
    <section class="card stack">
      <h2>Fortschritt sichern</h2>
      <p class="note">Mit diesem Code kannst du deinen Lernstand auf ein anderes Handy mitnehmen oder wiederherstellen. Bewahre ihn zum Beispiel in einer Notiz auf.</p>
      <button class="btn" id="show">${icon('copy', 20)} Code anzeigen und kopieren</button>
      <textarea class="input" id="code" readonly hidden aria-label="Sicherungscode"></textarea>
    </section>
    <section class="card stack">
      <h2>Fortschritt wiederherstellen</h2>
      <textarea class="input" id="paste" placeholder="Code hier einfügen" aria-label="Code einfügen"></textarea>
      <p class="error" id="err" hidden>Dieser Code ist ungültig.</p>
      <button class="btn" id="restore">${icon('refresh', 20)} Wiederherstellen</button>
    </section>
    <section class="card stack">
      <h2>Hinweis</h2>
      <p class="note">Die Inhalte folgen dem üblichen deutschen Pflege-Lehrbuchwissen und wurden sorgfältig geprüft. Sie ersetzen nicht die Unterlagen deiner Schule. Wenn deine Schule etwas anders lehrt, gilt für die Prüfung das, was deine Schule sagt.</p>
      <p class="note" lang="es">El contenido sigue los libros de enfermería alemanes. Si en tu escuela enseñan algo diferente, para el examen vale lo que dice tu escuela.</p>
    </section>`;

  const $ = (s) => root.querySelector(s);
  $('#name').onchange = (e) => { st.name = e.target.value.trim() || 'du'; app.persist(); app.toast('Gespeichert'); };
  $('#exam').onchange = (e) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { st.examDate = e.target.value; app.persist(); app.toast('Gespeichert'); }
    else e.target.value = st.examDate;
  };
  $('#goal').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      st.dailyMinutes = Number(b.dataset.g); app.persist();
      $('#goal').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    };
  });
  $('#show').onclick = async () => {
    const code = exportCode(st), box = $('#code');
    box.hidden = false; box.value = code; box.focus(); box.select();
    try { await navigator.clipboard.writeText(code); app.toast('Code kopiert'); }
    catch (e) { app.toast('Code markiert – bitte kopieren'); }
  };
  $('#restore').onclick = () => {
    let restored;
    try { restored = importCode($('#paste').value); }
    catch (e) { $('#err').hidden = false; return; }
    $('#err').hidden = true;
    if (!confirm('Den jetzigen Lernstand auf diesem Handy durch den Stand aus dem Code ersetzen?')) return;
    app.state = restored; app.persist(); app.toast('Fortschritt wiederhergestellt'); app.go('#/');
  };
}
