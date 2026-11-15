// Round summary with confetti, points and new badges.
import { icon } from '../icons.js';
import { esc, ring } from '../ui.js';
import { status, today, MASTERED } from '../srs.js';
import { dailyPlan } from '../session.js';
import { BADGES, newBadges } from '../rewards.js';
import { BLOCK_NAMES } from '../content.js';

export function badgeContext(app, examDone = false) {
  const st = app.state.items, loaded = app.loaded();
  const masteredDiseases = loaded.filter((d) => status(d.blocks.flatMap((b) => b.items), st) === 'gefestigt').length;
  const prophylaxenMastered = loaded.some((d) => {
    const items = d.blocks.flatMap((b) => b.items).filter((it) => it.sub === 'prophylaxen');
    return items.length > 0 && items.every((it) => st[it.id] && st[it.id].maxLevel >= MASTERED);
  });
  return { masteredDiseases, prophylaxenMastered, examDone };
}

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const c = document.createElement('canvas');
  c.id = 'confetti';
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const W = (c.width = innerWidth), H = (c.height = innerHeight);
  const colors = ['#6C5CE7', '#9B7BFF', '#17A673', '#F2B01E', '#F06BB1', '#2FA8C7'];
  const parts = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.32,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frame = 0, raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - frame / 130);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (++frame < 130) raf = requestAnimationFrame(tick); else c.remove();
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); c.remove(); };
}

export function render(root, app) {
  const r = app.lastRound, st = app.state;
  if (!r) { app.go('#/'); return; }
  const day = today();

  if (!r.badges) {
    r.badges = newBadges(st, badgeContext(app, r.kind === 'exam'), day);
    r.badges.forEach((id) => { st.badges[id] = day; });
    if (r.badges.length) app.persist();
  }

  const ratio = r.answered ? r.correct / r.answered : 0;
  const title = r.perfect ? 'Perfekte Runde!' : ratio >= 0.7 ? 'Stark gemacht!' : 'Gut, dass du dranbleibst!';
  const sub = r.perfect ? '¡Perfecto! Kein einziger Fehler.' : ratio >= 0.7 ? '¡Muy bien! Das meiste sitzt schon.'
    : 'Poco a poco. Was noch nicht sitzt, kommt bald wieder.';
  const minutes = Math.round(((st.days[day] && st.days[day].seconds) || 0) / 60);
  const goal = st.dailyMinutes, goalDone = minutes >= goal;
  const plan = dailyPlan(app.index, app.loaded(), st.items, st, day);
  const nextHash = plan.dueCount > 0 ? '#/wiederholen' : plan.next ? `#/runde/${plan.next.diseaseId}/${plan.next.blockId}` : '#/';

  const badges = r.badges.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
  const exam = r.kind === 'exam' && r.exam.length ? `
    <section class="card stack"><h2>Deine Prüfungssimulation</h2>
      ${r.exam.map((x) => `<div class="row between"><span class="row" style="gap:10px">${icon(x.blockId, 20)} ${BLOCK_NAMES[x.blockId] || ''}</span>
        <span class="chip ${x.ok ? 'ok' : 'warn'}">${x.ok ? 'Sicher' : 'Nochmal üben'}</span></div>`).join('')}
    </section>` : '';

  root.innerHTML = `
    <section class="stack center" style="margin-top:14px">
      <div class="result-ring" style="--c:var(--ok)">${ring(ratio, 132, 12, `${r.correct}/${r.answered}`)}</div>
      <h1>${title}</h1>
      <p class="muted">${sub}</p>
    </section>
    <section class="stat-grid">
      <div class="stat"><b class="num">+${r.points}</b><span>Punkte</span></div>
      <div class="stat"><b class="num">${r.learned}</b><span>Neu gelernt</span></div>
      <div class="stat"><b class="num">${r.strengthened}</b><span>Gefestigt</span></div>
    </section>
    ${r.bonus ? `<p style="display:flex;justify-content:center"><span class="chip gold">${icon('star', 16)} +${r.bonus} Bonus für die fehlerfreie Runde</span></p>` : ''}
    ${badges.length ? `<section class="stack"><h3 style="margin:0 4px">Neue Auszeichnung</h3><div class="badge-grid">
      ${badges.map((b) => `<div class="badge new"><div class="medal">${icon(b.icon, 26)}</div><b>${esc(b.title)}</b><span>${esc(b.text)}</span></div>`).join('')}</div></section>` : ''}
    ${exam}
    <section class="card stack">
      <div class="row between"><span class="row" style="gap:8px">${icon('clock', 20)} <b>Tagesziel</b></span>
        <span class="num ${goalDone ? '' : 'muted'}">${minutes} / ${goal} Min${goalDone ? ' ✓' : ''}</span></div>
      <div class="bar" style="--c:var(--ok);--c2:var(--ok)"><i style="width:${Math.min(100, Math.round((minutes / goal) * 100))}%"></i></div>
      ${goalDone ? '<p class="small muted">Tagesziel erreicht. ¡Felicidades!</p>' : ''}
    </section>
    <button class="btn btn-primary" data-go="${nextHash}">${icon('play', 20)} Weiter lernen</button>
    <button class="btn btn-ghost" data-go="#/">Fertig für heute</button>`;

  root.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => app.go(b.dataset.go); });
  const stopConfetti = ratio >= 0.7 && !r.celebrated ? confetti() : () => {};
  r.celebrated = true;
  return stopConfetti;
}
