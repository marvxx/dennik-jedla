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

  // Slovník na automatické rozpoznanie skupín potravín z popisu.
  // Kľúč = začiatok slova bez diakritiky; '=' na začiatku = presná zhoda celého slova.
  const TAG_WORDS = {
    mliecne: ['mliek', 'mliec', 'smotan', 'syr', 'tvaroh', 'jogurt', 'kefir', 'masl', 'zmrzlin', 'bryndz', 'mozzarel',
      'parmez', 'eidam', 'emental', 'niva', 'puding', 'latte', 'cappuc', 'kapucin', 'acidk', 'zakys', 'cmar', 'mascarpon',
      'ricott', 'feta', 'gouda', 'besamel', 'skyr', 'lucin', 'termix', 'pribin', 'cheddar', 'camembert', 'hermelin',
      'kakao', 'smoothie', 'milkshake', 'mlecn'],
    lepok: ['chlieb', 'chleb', 'rozok', 'rozk', 'pecivo', 'cestovin', 'spaget', 'makaron', 'pizz', 'knedl', 'halusk',
      'piroh', 'palacink', 'bagel', 'croiss', 'kroas', 'tortil', 'susienk', 'kolac', 'buchti', 'buchty', 'buchta', 'tort',
      'keks', 'oblat', 'muffin', 'zavin', 'strudl', 'psen', 'jacmen', 'pivo', 'piva', 'langos', 'rezen', 'struhank',
      'baget', 'kuskus', 'bulgur', 'lasagn', 'noky', 'gnocch', 'vianock', 'loks', 'krekr', 'toast', 'sendvic',
      'burger', 'hamburg', 'wrap', 'donut', 'sisk', 'babovk', 'drozdi', 'lievan', 'vafl', 'cereal', 'musli'],
    fruktoza: ['jablk', 'hrusk', '=med', '=medu', '=medom', 'mango', 'mang', 'melon', 'hrozn', 'ceresn', 'visn', 'datl',
      'figy', 'figa', 'agav', 'dzus', 'mostik', 'kompot', 'sirup', 'susen', 'hrozien'],
    cesnak: ['cesnak', 'cibul', 'porek', 'porik', 'salotk', 'pazitk', 'cesnakov'],
    strukoviny: ['fazul', 'sosovic', 'hrach', 'cicer', 'soj', 'hummus', 'edamam', 'tofu', 'strukov'],
    histamin: ['zrej', 'parmez', 'salam', 'klobas', 'udenin', 'uden', 'tuniak', 'sardin', 'kysl', 'vino', 'vina', 'vinom',
      'spenat', 'avokad', 'jahod', 'cokolad', 'ancovic', 'makrel', 'sunk', 'slanin', 'hermelin', 'olomouc', 'tvaruz'],
    kava: ['kav', 'espres', 'latte', 'cappuc', 'kapucin', 'presso', 'lungo'],
    alkohol: ['pivo', 'piva', 'vino', 'vina', 'vinom', 'vodk', '=rum', '=gin', 'borovick', 'slivovic', 'prosecc', 'sampan',
      'whisk', 'liker', 'koktejl', 'aperol', 'radler', 'hruskovic', 'becher', 'fernet', 'jager', 'tequil', 'martini'],
    sycene: ['sod', 'cola', 'kofol', 'sprite', 'fanta', 'mineralk', 'sycen', 'perliv', 'tonic', 'limonad', 'pivo', 'piva',
      'prosecc', 'sampan', 'vinea', 'radler'],
    sladidla: ['light', '=zero', 'zuvack', 'sorbit', 'xylit', 'erytrit', 'stevi', 'sladid', 'proteinov', 'cukrovink'],
    pikantne: ['pikant', 'chilli', 'chili', 'feferon', 'jalapen', 'tabasc', 'sriracha', '=kari', 'curry', 'paliv', 'wasabi', 'harissa'],
    mastne: ['vyprazan', 'hranolk', 'rezen', 'langos', 'slanin', 'oskvark', 'majonez', 'tatar', 'burger', 'hamburg',
      'chips', 'cips', 'klobas', 'smazen', 'fritovan', 'kacic', 'kacka', 'husac', 'bravcov', 'donut', 'kebab', 'gyros',
      'nugget', 'krídl', 'kridel', 'kridielk', 'parky', 'park', 'salam'],
    surova: ['salat', 'surov', 'uhork', 'redkovk', 'kapust', 'brokolic', 'karfiol', 'kel'],
  };

  function detectTags(desc) {
    const found = new Set();
    for (const w of String(desc || '').toLowerCase().split(/[^\p{L}]+/u)) {
      if (w.length < 2) continue;
      const n = norm(w);
      for (const tag in TAG_WORDS) {
        if (found.has(tag)) continue;
        for (const k0 of TAG_WORDS[tag]) {
          const exact = k0[0] === '=';
          const k = norm(exact ? k0.slice(1) : k0);
          if (exact ? n === k : n.startsWith(k)) { found.add(tag); break; }
        }
      }
    }
    return [...found];
  }

  /** Skupiny jedla = ručne označené + rozpoznané z popisu – ručne vypnuté */
  function mealTags(e) {
    const s = new Set((e.tags || []).concat(detectTags(e.desc)));
    (e.noTags || []).forEach(t => s.delete(t));
    return [...s];
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
    const riskTags = opts && opts.riskTags && opts.riskTags.length ? opts.riskTags : null;
    const symDays = new Set(entries.filter(e => e.type === 'symptom').map(e => localDate(e.ts)));
    // Ak sa používa „Dnes bez ťažkostí“, vyhodnocujú sa len dni, kde vieme, či ťažkosti boli
    const usesNoSym = Object.values(days).some(v => v && v.noSymptoms);
    const dayKnown = d => symDays.has(d) || !!(days[d] && days[d].noSymptoms);
    let skipped = 0;
    // Len jedlá, ktorých časové okno už uplynulo
    const meals = entries.filter(e => {
      if (e.type !== 'food' || e.ts + toH * HOUR > now) return false;
      if (usesNoSym && !dayKnown(localDate(e.ts)) && !dayKnown(localDate(e.ts + toH * HOUR))) { skipped++; return false; }
      return true;
    });

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

    const info = [];   // pomocné údaje o každom jedle
    for (const m of meals) {
      const hit = followed(m.ts);
      const tags = mealTags(m);
      const risk = riskTags ? tags.some(t => riskTags.includes(t)) : false;
      info.push({ m, hit, tags, risk, day: days[localDate(m.ts)] || {} });
      totalN++;
      if (hit) totalHit++;
      for (const [k, w] of tokenize(m.desc)) bump(foodStats, k, w, hit);
      for (const t of tags) bump(ctxStats, 'tag:' + t, t, hit);
      if (risk) bump(ctxStats, 'risk', 'risk', hit);
      if (m.place && m.place !== 'doma') bump(ctxStats, 'place:' + m.place, m.place, hit);
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

    // Rizikové jedlo: kedy vadí viac / menej (porovnanie v rámci rizikových jedál)
    const minSub = Math.min(minN, 3);
    const riskCtx = [];
    if (riskTags) {
      const rl = info.filter(x => x.risk);
      const rHit = rl.filter(x => x.hit).length;
      const defs = [
        ['risk&enzyme', x => !!x.m.enzyme],
        ['risk&away', x => !!x.m.place && x.m.place !== 'doma'],
        ['risk&stress', x => x.m.stress != null && x.m.stress >= 4],
        ['risk&period', x => x.day.period === true],
        ['risk&sleep', x => x.day.sleep === 'zle'],
        ['risk&rushed', x => !!x.m.rushed],
      ];
      for (const [key, test] of defs) {
        const w = rl.filter(test);
        const wHit = w.filter(x => x.hit).length;
        if (w.length >= minSub && rl.length - w.length >= minSub) riskCtx.push(summarize(key, key, w.length, wHit, rl.length, rHit, 'risk'));
      }
      riskCtx.sort(sortResults);
    }

    // Hromadenie: 2× a viac tej istej skupiny za 12 h vs. 1×
    const stacking = [];
    const allTags = new Set();
    info.forEach(x => x.tags.forEach(t => allTags.add(t)));
    const allFood = entries.filter(e => e.type === 'food');
    for (const t of allTags) {
      const tagTimes = allFood.filter(e => mealTags(e).includes(t)).map(e => e.ts);
      const list = info.filter(x => x.tags.includes(t));
      let sN = 0, sHit = 0;
      for (const x of list) {
        const load = tagTimes.filter(ts => ts <= x.m.ts && ts > x.m.ts - 12 * HOUR).length;
        if (load >= 2) { sN++; if (x.hit) sHit++; }
      }
      const tHit = list.filter(x => x.hit).length;
      if (sN >= minSub && list.length - sN >= minSub) stacking.push(summarize('stack:' + t, t, sN, sHit, list.length, tHit, 'stack'));
    }
    stacking.sort(sortResults);

    // Denné faktory: deň s ťažkosťami vs. bez
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
      riskCtx, stacking, skipped, usesNoSym,
      opts: { fromH, toH, minN },
    };
  }

  const api = { analyze, tokenize, stem, norm, localDate, detectTags, mealTags };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
