/* Vyhodnotenie súvislostí medzi jedlom/okolnosťami a ťažkosťami.
   Čistá logika bez DOM – dá sa testovať aj v Node. */
(function (root) {
  'use strict';

  const HOUR = 3600 * 1000;

  // Slová, ktoré nie sú jedlo (po odstránení diakritiky)
  const STOP = new Set([
    'so', 'aj', 'zo', 'na', 'vo', 'do', 'bez', 'ku', 'po', 'pre', 'za', 'pri', 'od', 'ako', 'alebo',
    'ale', 'len', 'iba', 'asi', 'velmi', 'trochu', 'trosku', 'kus', 'kusok', 'kusky', 'malo', 'vela',
    'pol', 'jeden', 'jedna', 'jedno', 'jednu', 'dva', 'dve', 'tri', 'styri', 'lyzica', 'lyzicka',
    'lyzicky', 'lyzice', 'platok', 'platky', 'hrncek', 'pohar', 'poharik', 'miska', 'misku', 'tanier',
    'porcia', 'porciu', 'cely', 'cela', 'cele', 'celu', 'male', 'maly', 'mala', 'velky', 'velka',
    'velke', 'domace', 'domaci', 'domaca', 'nejaky', 'nejaka', 'nejake', 'mojej', 'moje', 'potom',
    'rano', 'obed', 'vecera', 'desiata', 'olovrant', 'snack', 'jedlo', 'jedla', 'pitie',
  ]);

  const ENDINGS = ['iach', 'ami', 'ach', 'ych', 'ymi', 'om', 'ou', 'ov', 'ej', 'ym', 'mi', 'ia', 'ie', 'iu',
    'y', 'a', 'u', 'e', 'o', 'i'];

  function norm(w) {
    return w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function stem(n) {
    for (const e of ENDINGS) {
      if (n.endsWith(e) && n.length - e.length >= 3) return n.slice(0, -e.length);
    }
    return n;
  }

  /** Vráti zoznam [kľúč, pôvodné slovo] z popisu jedla. */
  function tokenize(desc) {
    const out = new Map();
    for (const w of String(desc || '').toLowerCase().split(/[^\p{L}]+/u)) {
      if (!w) continue;
      const n = norm(w);
      if (n.length < 3 || STOP.has(n)) continue;
      const k = stem(n);
      if (!out.has(k)) out.set(k, w);
    }
    return [...out.entries()];
  }

  function localDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function summarize(key, label, withN, withHit, totalN, totalHit, group) {
    const outN = totalN - withN;
    const outHit = totalHit - withHit;
    const rateWith = withN ? withHit / withN : 0;
    const rateWithout = outN ? outHit / outN : 0;
    let ratio;
    if (rateWithout > 0) ratio = rateWith / rateWithout;
    else ratio = rateWith > 0 ? Infinity : 0;
    let level = 'none';
    if (withHit >= 2 && ratio >= 2) level = 'high';
    else if (withHit >= 2 && ratio >= 1.3) level = 'mid';
    return { key, label, group, withN, withHit, outN, outHit, rateWith, rateWithout, ratio, level };
  }

  function sortResults(a, b) {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    if (b.rateWith !== a.rateWith) return b.rateWith - a.rateWith;
    if (b.withHit !== a.withHit) return b.withHit - a.withHit;
    return b.withN - a.withN;
  }

  /**
   * entries: [{type, ts, desc, tags, rushed, portion, stress, mood}]
   * days: {'YYYY-MM-DD': {sleep, period, activity, water}}
   * opts: {fromH, toH, minN, now}
   */
  function analyze(entries, days, opts) {
    const fromH = opts && opts.fromH != null ? opts.fromH : 0;
    const toH = opts && opts.toH != null ? opts.toH : 6;
    const minN = (opts && opts.minN) || 5;
    const now = (opts && opts.now) || Date.now();
    days = days || {};

    const symTimes = entries.filter(e => e.type === 'symptom').map(e => e.ts).sort((a, b) => a - b);
    // Len jedlá, ktorých časové okno už uplynulo
    const meals = entries.filter(e => e.type === 'food' && e.ts + toH * HOUR <= now);

    function followed(ts) {
      const a = ts + fromH * HOUR, b = ts + toH * HOUR;
      // binárne vyhľadanie prvého symptómu >= a
      let lo = 0, hi = symTimes.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (symTimes[m] < a) lo = m + 1; else hi = m; }
      return lo < symTimes.length && symTimes[lo] <= b;
    }

    const foodStats = new Map();   // key -> {withN, withHit, labels: Map}
    const ctxStats = new Map();
    let totalN = 0, totalHit = 0;

    function bump(map, key, label, hit) {
      let s = map.get(key);
      if (!s) { s = { withN: 0, withHit: 0, labels: new Map() }; map.set(key, s); }
      s.withN++;
      if (hit) s.withHit++;
      s.labels.set(label, (s.labels.get(label) || 0) + 1);
    }

    for (const m of meals) {
      const hit = followed(m.ts);
      totalN++;
      if (hit) totalHit++;
      for (const [k, w] of tokenize(m.desc)) bump(foodStats, k, w, hit);
      for (const t of (m.tags || [])) bump(ctxStats, 'tag:' + t, t, hit);
      if (m.rushed) bump(ctxStats, 'rushed', 'rushed', hit);
      if (m.portion === 'velka') bump(ctxStats, 'portion:velka', 'portion:velka', hit);
      if (m.stress != null && m.stress >= 4) bump(ctxStats, 'stress:high', 'stress:high', hit);
      if (m.mood != null && m.mood <= 2) bump(ctxStats, 'mood:low', 'mood:low', hit);
    }

    function finish(map, group) {
      const ready = [], pending = [];
      for (const [k, s] of map) {
        const label = [...s.labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
        if (s.withN >= minN && totalN - s.withN >= 1) {
          ready.push(summarize(k, label, s.withN, s.withHit, totalN, totalHit, group));
        } else if (s.withN < minN) {
          pending.push({ key: k, label, n: s.withN });
        }
      }
      ready.sort(sortResults);
      pending.sort((a, b) => b.n - a.n);
      return { ready, pending };
    }

    const foods = finish(foodStats, 'food');
    const ctx = finish(ctxStats, 'ctx');

    // Denné faktory: deň s ťažkosťami vs. bez
    const symDays = new Set(entries.filter(e => e.type === 'symptom').map(e => localDate(e.ts)));
    const today = localDate(now);
    // dnešok ešte nie je ukončený, preto ho vynecháme
    const dayList = Object.entries(days).filter(([d, v]) => v && d < today);
    const dayFactorDefs = [
      ['sleep:zle', v => v.sleep === 'zle'],
      ['period', v => v.period === true],
      ['activity:ziadny', v => v.activity === 'ziadny'],
      ['water:malo', v => v.water === 'malo'],
    ];
    const dTotal = dayList.length;
    const dHit = dayList.filter(([d]) => symDays.has(d)).length;
    const dayReady = [], dayPending = [];
    for (const [key, test] of dayFactorDefs) {
      const withDays = dayList.filter(([, v]) => test(v));
      const wN = withDays.length;
      const wHit = withDays.filter(([d]) => symDays.has(d)).length;
      if (wN >= minN && dTotal - wN >= 1) dayReady.push(summarize(key, key, wN, wHit, dTotal, dHit, 'day'));
      else if (wN > 0 && wN < minN) dayPending.push({ key, label: key, n: wN });
    }
    dayReady.sort(sortResults);

    return {
      totalN, totalHit, baseRate: totalN ? totalHit / totalN : 0,
      symptomCount: symTimes.length,
      foods: foods.ready, foodsPending: foods.pending,
      ctx: ctx.ready, ctxPending: ctx.pending,
      days: dayReady, daysPending: dayPending, dayTotal: dTotal, dayHit: dHit,
      opts: { fromH, toH, minN },
    };
  }

  const api = { analyze, tokenize, stem, norm, localDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
