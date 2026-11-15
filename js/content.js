// Content loading and validation.
export const BLOCK_IDS = ['definition', 'anatomie', 'ursachen', 'risikofaktoren', 'symptome',
  'diagnostik', 'therapie', 'komplikationen', 'pflegemassnahmen', 'pflegeplanung'];
export const SUB_IDS = ['beobachten', 'ernaehrung', 'mobilisation', 'koerperpflege', 'bekleidung',
  'beraten', 'prophylaxen'];

export const BLOCK_NAMES = {
  definition: 'Definition', anatomie: 'Anatomie', ursachen: 'Ursachen', risikofaktoren: 'Risikofaktoren',
  symptome: 'Symptome', diagnostik: 'Diagnostik', therapie: 'Therapie', komplikationen: 'Komplikationen',
  pflegemassnahmen: 'Pflegemaßnahmen', pflegeplanung: 'Pflegeplanung',
};
export const SUB_NAMES = {
  beobachten: 'Wahrnehmen und Beobachten', ernaehrung: 'Ernährung', mobilisation: 'Mobilisation',
  koerperpflege: 'Körperpflege', bekleidung: 'Bekleidung', beraten: 'Informieren und Beraten',
  prophylaxen: 'Prophylaxen',
};

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x) => typeof x === 'string' && x.trim().length > 0;
const distinct = (arr) => new Set(arr).size === arr.length;
const strings = (arr, min, max) => Array.isArray(arr) && arr.length >= min && arr.length <= max && arr.every(text);
const index = (n, len) => Number.isInteger(n) && n >= 0 && n < len;

function variantProblems(v) {
  const out = [];
  if (!isObj(v)) return ['variant ist kein Objekt'];
  if (!text(v.q)) out.push('q fehlt');
  switch (v.form) {
    case 'mc':
    case 'cloze':
      if (!strings(v.options, 4, 4) || !distinct(v.options)) out.push('options: genau 4 verschiedene nötig');
      else if (!index(v.correct, 4)) out.push('correct liegt nicht in options');
      if (v.form === 'cloze' && text(v.q) && v.q.split('___').length !== 2) out.push('cloze braucht genau eine Lücke ___');
      break;
    case 'multi':
      if (!strings(v.options, 5, 6) || !distinct(v.options)) out.push('options: 5–6 verschiedene nötig');
      else if (!Array.isArray(v.correct) || v.correct.length < 2 || v.correct.length > 4 ||
        !distinct(v.correct) || !v.correct.every((c) => index(c, v.options.length))) out.push('correct: 2–4 verschiedene gültige Indizes nötig');
      break;
    case 'tf':
      if (typeof v.correct !== 'boolean') out.push('correct muss true oder false sein');
      break;
    case 'match':
      if (!Array.isArray(v.pairs) || v.pairs.length < 3 || v.pairs.length > 4 ||
        !v.pairs.every((p) => strings(p, 2, 2)) ||
        !distinct(v.pairs.map((p) => p[0])) || !distinct(v.pairs.map((p) => p[1]))) out.push('pairs: 3–4 Paare mit eindeutigen Seiten nötig');
      break;
    default:
      out.push('unbekannte form ' + JSON.stringify(v.form));
  }
  return out;
}

export function validateDisease(d) {
  const out = [];
  if (!isObj(d) || !text(d.id) || !text(d.name) || !Array.isArray(d.blocks)) return ['Datei hat nicht die Form {id, name, blocks}'];
  if (d.blocks.map((b) => b && b.id).join() !== BLOCK_IDS.join()) out.push('blocks: alle 10 Block-IDs in der richtigen Reihenfolge nötig');
  const seen = new Set();
  let count = 0;
  for (const b of d.blocks) {
    if (!isObj(b) || !Array.isArray(b.items)) { out.push('block ohne items'); continue; }
    const idRe = new RegExp('^' + d.id + '\\.' + b.id + '\\.\\d+$');
    let sprech = 0;
    const subs = {};
    for (const it of b.items) {
      count++;
      const where = (isObj(it) && it.id) || `${b.id}[?]`;
      const add = (msg) => out.push(`${where}: ${msg}`);
      if (!isObj(it)) { add('item ist kein Objekt'); continue; }
      if (!text(it.id) || !idRe.test(it.id)) add('id passt nicht zum Muster <krankheit>.<block>.<n>');
      if (seen.has(it.id)) add('id doppelt');
      seen.add(it.id);
      if (!text(it.es) || it.es.trim().length < 60) add('es fehlt oder ist kürzer als 60 Zeichen');
      if (b.id === 'pflegemassnahmen') {
        if (!SUB_IDS.includes(it.sub)) add('sub fehlt oder ist ungültig');
        else subs[it.sub] = (subs[it.sub] || 0) + 1;
      }
      if (it.type === 'sprech') {
        sprech++;
        if (!text(it.q)) add('q fehlt');
        if (!text(it.answer)) add('answer fehlt');
        if (!strings(it.points, 3, 6)) add('points: 3–6 Kernpunkte nötig');
      } else if (it.type === 'wissen') {
        if (!Array.isArray(it.variants) || it.variants.length < 2) add('mindestens 2 variants nötig');
        else {
          if (new Set(it.variants.map((v) => v && v.form)).size < 2) add('variants brauchen mindestens 2 verschiedene form-Werte');
          it.variants.forEach((v, i) => variantProblems(v).forEach((p) => add(`variant ${i + 1}: ${p}`)));
        }
      } else add('type muss wissen oder sprech sein');
    }
    if (sprech < 1) out.push(`${b.id}: mindestens eine sprech-Karte nötig`);
    if (b.id === 'pflegeplanung' && sprech < 3) out.push('pflegeplanung: mindestens 3 sprech-Karten nötig');
    if (b.id === 'pflegemassnahmen') {
      for (const s of SUB_IDS) if (!subs[s]) out.push(`pflegemassnahmen: Bereich ${s} fehlt`);
      if ((subs.prophylaxen || 0) < 3) out.push('pflegemassnahmen: mindestens 3 Inhalte zu prophylaxen nötig');
    }
  }
  if (count < 55 || count > 70) out.push(`Anzahl der Inhalte ist ${count}, erlaubt sind 55–70`);
  return out;
}

export function validateAll(diseases) {
  const out = [];
  const ids = new Set();
  for (const d of diseases) {
    validateDisease(d).forEach((p) => out.push(`${(d && d.id) || '?'}: ${p}`));
    for (const b of (d && d.blocks) || []) for (const it of b.items || []) {
      if (ids.has(it.id)) out.push(`${it.id}: id kommt in mehreren Dateien vor`);
      ids.add(it.id);
    }
  }
  return out;
}

async function getJson(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    throw new Error('Inhalt konnte nicht geladen werden');
  }
}

export const loadIndex = () => getJson('./data/index.json');
export const loadDisease = (id) => getJson(`./data/${id}.json`);
