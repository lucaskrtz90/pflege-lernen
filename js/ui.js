// Small rendering helpers shared by the views.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
export const pct = (p) => Math.round((p || 0) * 100);

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Progress ring as SVG. `p` is 0..1. `inner` is markup placed in the centre. */
export function ring(p, size = 56, stroke = 6, inner = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, p || 0)));
  return `<span class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg><span class="ring-in">${inner}</span></span>`;
}

export const STATUS_LABEL = { neu: 'Neu', inArbeit: 'In Arbeit', gefestigt: 'Gefestigt' };

export function formatDate(day) {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}
