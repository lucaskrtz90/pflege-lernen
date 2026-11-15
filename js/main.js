// App start, shared state and routing.
import * as store from './store.js';
import { loadIndex, loadDisease } from './content.js';
import { icon } from './icons.js';
import * as home from './views/home.js';
import * as disease from './views/disease.js';
import * as quiz from './views/quiz.js';
import * as result from './views/result.js';
import * as awards from './views/awards.js';
import * as settings from './views/settings.js';

const root = document.getElementById('view');
const nav = document.getElementById('nav');
const toastEl = document.getElementById('toast');
let cleanup = null, toastTimer = null;

export const app = {
  state: store.load(),
  index: [],
  diseases: new Map(),
  failed: new Set(),
  lastRound: null,

  persist() {
    // Another open copy of the app (browser tab and installed app) may have saved in between.
    store.mergeInto(this.state, store.load());
    if (!store.save(this.state)) this.toast('Speichern nicht möglich. Bitte prüfe den Speicher des Handys.');
  },
  go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  },
  toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  },
  /** Loaded diseases in the order of the index. */
  loaded() {
    return this.index.filter((e) => this.diseases.has(e.id)).map((e) => this.diseases.get(e.id));
  },
  entry(id) {
    return this.index.find((e) => e.id === id);
  },
  async reload() {
    await loadContent();
    route();
  },
};

const ROUTES = {
  '': { view: home, nav: 'start' },
  k: { view: disease },
  runde: { view: quiz, kind: 'station', bare: true },
  wiederholen: { view: quiz, kind: 'review', bare: true },
  pruefung: { view: quiz, kind: 'exam', bare: true },
  ergebnis: { view: result, bare: true },
  erfolge: { view: awards, nav: 'erfolge' },
  einstellungen: { view: settings, nav: 'einstellungen' },
};

function renderNav(active) {
  const tabs = [['start', '#/', 'home', 'Start'], ['erfolge', '#/erfolge', 'trophy', 'Erfolge'], ['einstellungen', '#/einstellungen', 'settings', 'Einstellungen']];
  nav.innerHTML = tabs.map(([id, href, ic, label]) =>
    `<a href="${href}" class="${id === active ? 'on' : ''}" ${id === active ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${label}</span></a>`).join('');
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map((p) => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
  const r = ROUTES[parts[0]] || ROUTES[''];
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  nav.hidden = !!r.bare;
  root.className = 'view' + (r.bare ? ' no-nav' : '');
  renderNav(r.nav || 'start');
  root.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = r.view.render(root, app, { kind: r.kind, a: parts[1], b: parts[2] }) || null;
}

async function loadContent() {
  if (!app.index.length) app.index = await loadIndex();
  await Promise.all(app.index.filter((e) => e.available && !app.diseases.has(e.id)).map(async (e) => {
    try { app.diseases.set(e.id, await loadDisease(e.id)); app.failed.delete(e.id); }
    catch (err) { app.failed.add(e.id); }
  }));
}

function bootError() {
  root.innerHTML = `<div class="card stack center" style="margin-top:22vh">
    <h2>Inhalt konnte nicht geladen werden</h2>
    <p class="muted">Bitte prüfe deine Internetverbindung und versuche es noch einmal.</p>
    <button class="btn btn-primary" id="retry">${icon('refresh', 20)} Nochmal versuchen</button></div>`;
  root.querySelector('#retry').onclick = boot;
}

async function boot() {
  try { await loadContent(); } catch (e) { bootError(); return; }
  window.addEventListener('hashchange', route);
  route();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  // Once the offline helper is in charge, fetch the content again so it is saved for offline use.
  navigator.serviceWorker.ready.then(() => setTimeout(() => {
    fetch('./data/index.json').then((r) => r.json())
      .then((idx) => idx.filter((e) => e.available).forEach((e) => fetch(`./data/${e.id}.json`).catch(() => {})))
      .catch(() => {});
  }, 1500)).catch(() => {});
}
// Ask the phone not to clear the saved progress when storage runs low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
// Show changes made in another open copy of the app.
window.addEventListener('storage', (e) => {
  if (e.key !== store.KEY) return;
  store.mergeInto(app.state, store.load());
  if (!/^#\/(runde|wiederholen|pruefung|ergebnis)/.test(location.hash)) route();
});
boot();
