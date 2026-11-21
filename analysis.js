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
    'podobe', 'spolu', 'obsahoval', 'obsahovala', 'obsahovalo', 'obsahovali', 'obsahuje', 'trocha', 'zvysok', 'zvysky',
    'nejakou', 'nejakym', 'takmer', 'skoro', 'dost', 'viac', 'menej', 'kusy', 'kusom', 'cast', 'kusmi', 'zbytok',
    'mozno', 'teda', 'tiez', 'potom', 'este', 'uz', 'mam', 'som', 'bolo', 'bola', 'bol', 'boli', 'zjedla', 'zjedol',
    'vypila', 'vypil', 'dala', 'dal', 'jedla', 'pila', 'kupene', 'kupena', 'kupeny', 'hotove', 'hotova', 'hotovy',
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

  // Základné tvary bežných potravín, aby výsledok nebol „mliekom“, ale „mlieko“.
  // Prvé slovo v skupine je základný tvar, ďalšie sú tvary, ktoré sa skracujú inak.
  const BASE = {};
  ('mlieko maslo syr tvaroh jogurt smotana bryndza kefír zmrzlina puding chlieb|chleba|chlebom rožok|rožky pečivo|pečivom ' +
    'cestoviny|cestovinami špagety ryža|ryžou zemiaky|zemiakmi|zemiakov hranolky knedľa|knedle|knedľou halušky kaša|kašou ' +
    'vločky|vločkami müsli mäso|mäsom kura|kuraťom bravčové hovädzie morčacie šunka|šunkou saláma|salámou klobása|klobásou ' +
    'slanina|slaninou párky|párkom ryba|rybou losos|lososom tuniak|tuniakom vajce|vajcia|vajcom|vajíčko|vajíčka|vajíčkom ' +
    'zelenina|zeleninou šalát|šalátom paradajky|paradajka|paradajkou paprika|paprikou uhorka|uhorkou mrkva|mrkvou ' +
    'cibuľa|cibuľou cesnak|cesnakom brokolica|brokolicou kapusta|kapustou špenát|špenátom fazuľa|fazuľou šošovica|šošovicou ' +
    'hrach|hrachom cícer|cícerom ovocie|ovocím jablko|jablká|jablkom banán|banánom hruška|hruškou pomaranč jahody|jahodami ' +
    'hrozno|hrozienka med|medom cukor|cukrom čokoláda|čokoládou koláč|koláče|koláčom keksy|keks sušienky orechy|oriešky|orieškami ' +
    'káva|kávou čaj|čajom voda|vodou džús|džúsom pivo víno|vínom polievka|polievkou omáčka|omáčkou pizza avokádo ' +
    'kakao|kakaom tofu hummus|humus|humusom|hummusom palacinky|palacinka toast|toastom sendvič|sendviču burger ' +
    'chipsy|čipsy|čipsami|chipsami chlebík|chlebíky|chlebíkom rožky lievance|lievancami omeleta|omeletou ' +
    'kuracie|kuracím|kuracieho|kuracia|kuracou|kuracích bravčové|bravčovým|bravčového hovädzie|hovädzím|hovädzieho ' +
    'morka|morčacím|morčacieho fazírky|fašírky|fasirky|fašírka|fazirky mleté|mletým|mletého ' +
    'korenie|korením kari|curry dresing|dressing|dresingom|dressingom majonéza|majonézou kečup|kečupom horčica|horčicou ' +
    'olej|olejom maslo|maslom kokos|kokosový|kokosovým|kokosové|kokosovom višne|višňový|višňovým|višňové ' +
    'kuracina|kuracine|kuracinou|kuracinu tortilla|tortillou|tortillu vločky|vločkami granola|granolou ovsená|ovsené|ovsenou|ovsených')
    .split(' ').forEach(grp => {
      const forms = grp.split('|');
      forms.forEach(f => { const k = stem(norm(f)); if (!BASE[k]) BASE[k] = forms[0]; });
    });
  const PREPS = new Set(['s', 'so', 'z', 'zo', 'na', 'v', 'vo', 'bez', 'do', 'k', 'ku', 'po', 'pre', 'pri', 'od', 'za']);

  // Slová popisu v poradí; k = kľúč plnovýznamového slova, prep = predložka pred ním
  function words(desc) {
    const out = [];
    let prev = '';
    for (const w of String(desc || '').toLowerCase().split(/[^\p{L}]+/u)) {
      if (!w) continue;
      const n = norm(w);
      out.push({ w, k: n.length >= 3 && !STOP.has(n) ? stem(n) : null, prep: PREPS.has(prev) ? prev : '' });
      prev = n;
    }
    return out;
  }
  // Prídavné meno (napr. „pečenej“, „volské“) samo nič nepovie, ukáže sa so slovom za ním
  const ADJ = /(ý|á|é|ej|ým|ím|ého|ých|ými|ími|ou|ske|ska|sky|ene|ena|eny)$/;
  // Názov pre jedno slovo: základný tvar, inak dvojica z vlastného textu („volské oko“),
  // inak tvar bez predložky, inak s predložkou („s maslom“)
  function pickLabel(k, labels, pairs) {
    if (BASE[k]) return BASE[k];
    if (pairs && pairs.size) {
      // dvojice sa porovnávajú podľa slova za prídavným menom („pečenej zeleniny“ aj „pečenej zelenine“)
      const top = [...pairs.values()].sort((a, b) => b.n - a.n)[0];
      if (top.n >= 2 || pairs.size === 1) return [...top.lab.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const arr = [...labels.entries()].sort((a, b) => b[1] - a[1]);
    const free = arr.find(([l]) => !l.includes(' '));
    return (free || arr[0])[0];
  }
  // dlhý popis skráti na prvé slová
  const shorten = (t, n) => { const w = String(t).split(/\s+/); return w.length > n ? w.slice(0, n).join(' ') + '…' : t; };
  // Slová, ktoré idú vždy spolu, ukáže ako súvislú frázu z popisu („ovsená kaša“, „káva s mliekom“)
  function phraseFor(desc, keys) {
    const ws = words(desc), idx = [];
    ws.forEach((x, i) => { if (x.k && keys.has(x.k)) idx.push(i); });
    if (idx.length < 2 || idx.length !== keys.size) return null;
    for (let i = idx[0]; i <= idx[idx.length - 1]; i++) if (!idx.includes(i) && ws[i].k) return null;
    return ws.slice(idx[0], idx[idx.length - 1] + 1).map(x => x.w).join(' ');
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

  // Vlastné intolerancie používateľa: [{id: 'c_…', words: ['paradajk']}]
  function setCustomTags(list) {
    for (const k of Object.keys(TAG_WORDS)) if (k.startsWith('c_')) delete TAG_WORDS[k];
    for (const c of list || []) if (c && c.id && c.words && c.words.length) TAG_WORDS[c.id] = c.words.slice();
  }
  // Moje jedlá: [{name: 'mamine halušky', ingredients: 'halušky, bryndza, slanina'}]
  // Keď popis obsahuje názov jedla, počítajú sa aj jeho suroviny.
  let RECIPES = [];
  function setRecipes(list) {
    RECIPES = (list || []).filter(r => r && r.name && r.ingredients)
      .map(r => ({ n: norm(String(r.name).toLowerCase()).trim(), ing: String(r.ingredients) }));
  }
  function recipeOf(desc) {
    const d = norm(String(desc || '').toLowerCase());
    return RECIPES.filter(r => r.n && d.includes(r.n));
  }
  function expand(desc) {
    const r = recipeOf(desc);
    return r.length ? desc + ', ' + r.map(x => x.ing).join(', ') : String(desc || '');
  }

  // Z názvu („paradajky, paprika“) urobí začiatky slov na rozpoznávanie
  function wordsFor(label) {
    const out = [];
    for (const w of String(label || '').toLowerCase().split(/[^\p{L}]+/u)) {
      const n = norm(w);
      if (n.length < 3 || STOP.has(n)) continue;
      const k = stem(n);
      if (!out.includes(k)) out.push(k);
    }
    return out;
  }

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
    const s = new Set((e.tags || []).concat(detectTags(expand(e.desc))));
    (e.noTags || []).forEach(t => s.delete(t));
    // zmazaná vlastná skupina sa už neráta
    return [...s].filter(t => !t.startsWith('c_') || TAG_WORDS[t]);
  }

  // deň sa začína o 4:00 (rovnako ako v app.js), neskorá večera patrí k predošlému dňu
  function localDate(ts) {
    const d = new Date(ts - 4 * HOUR);
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
      if (!s) { s = { withN: 0, withHit: 0, labels: new Map(), idx: [] }; map.set(key, s); }
      s.idx.push(info.length);   // poradie práve spracúvaného jedla
      s.withN++;
      if (hit) s.withHit++;
      s.labels.set(label, (s.labels.get(label) || 0) + 1);
    }

    const foodTimes = entries.filter(e => e.type === 'food').map(e => e.ts).sort((a, b) => a - b);
    const prevFood = ts => { let p = null; for (const t of foodTimes) { if (t < ts) p = t; else break; } return p; };
    const info = [];   // pomocné údaje o každom jedle
    for (const m of meals) {
      const hit = followed(m.ts);
      const tags = mealTags(m);
      const risk = riskTags ? tags.some(t => riskTags.includes(t)) : false;
      totalN++;
      if (hit) totalHit++;
      const seenK = new Set();
      const ws = words(expand(m.desc));
      ws.forEach((x, i) => {
        if (!x.k || seenK.has(x.k)) return;
        seenK.add(x.k);
        bump(foodStats, x.k, x.prep ? x.prep + ' ' + x.w : x.w, hit);
        const nx = ws[i + 1];
        if (!BASE[x.k] && ADJ.test(x.w) && nx && nx.k) {
          const st = foodStats.get(x.k);
          st.pairs = st.pairs || new Map();
          const pr = st.pairs.get(nx.k) || { n: 0, lab: new Map() };
          const ph = x.w + ' ' + nx.w;
          pr.n++;
          pr.lab.set(ph, (pr.lab.get(ph) || 0) + 1);
          st.pairs.set(nx.k, pr);
        }
      });
      for (const t of tags) bump(ctxStats, 'tag:' + t, t, hit);
      if (risk) bump(ctxStats, 'risk', 'risk', hit);
      if (m.place && m.place !== 'doma') bump(ctxStats, 'place:' + m.place, m.place, hit);
      if (m.rushed) bump(ctxStats, 'rushed', 'rushed', hit);
      if (m.portion === 'velka') bump(ctxStats, 'portion:velka', 'portion:velka', hit);
      if (m.stress != null && m.stress >= 4) bump(ctxStats, 'stress:high', 'stress:high', hit);
      if (m.mood != null && m.mood <= 2) bump(ctxStats, 'mood:low', 'mood:low', hit);
      // Stravovacie návyky vypočítané z času jedla
      const hr = new Date(m.ts).getHours();
      const prev = prevFood(m.ts);
      const sameDay = prev != null && localDate(prev) === localDate(m.ts);
      if (hr >= 20) bump(ctxStats, 'late', 'late', hit);
      if (sameDay && m.ts - prev >= 5 * HOUR) bump(ctxStats, 'gap:long', 'gap:long', hit);
      if (!sameDay && tags.includes('kava')) bump(ctxStats, 'first:kava', 'first:kava', hit);
      info.push({ m, hit, tags, risk, day: days[localDate(m.ts)] || {} });
    }

    const topOf = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    function finish(map, group, dropSigs) {
      let items = [...map].map(([k, st]) => ({ k, st, sig: st.idx.join(','), label: group === 'food' ? pickLabel(k, st.labels, st.pairs) : topOf(st.labels)[0] }));
      if (group === 'food') {
        // Slová, ktoré sa vyskytli presne v tých istých jedlách, sú jeden výsledok (napr. „káva s mliekom“)
        const bySig = new Map();
        for (const it of items) { const g = bySig.get(it.sig); if (g) g.push(it); else bySig.set(it.sig, [it]); }
        items = [...bySig.values()].map(g => {
          const st = g[0].st;
          const dm = new Map();
          st.idx.forEach(i => { const d = String(info[i].m.desc || '').trim().toLowerCase(); dm.set(d, (dm.get(d) || 0) + 1); });
          const [d0, n0] = topOf(dm);
          const whole = n0 / st.idx.length >= 0.6 && d0.split(/\s+/).length <= 5 && tokenize(d0).length === g.length;
          const phrase = !whole && g.length > 1 ? phraseFor(d0, new Set(g.map(it => it.k))) : null;
          // jedno známe slovo vždy v základnom tvare („mrkvy“ → „mrkva“)
          let label = g.length === 1 && BASE[g[0].k] ? BASE[g[0].k] : whole ? d0 : phrase;
          if (!label) label = g.length > 2 ? shorten(d0, 5) : g.map(it => it.label).join(' + ');
          return { k: g.map(it => it.k).join('+'), st, sig: g[0].sig, label };
        });
      } else if (dropSigs) {
        // skupina, ktorá je to isté ako jedno jedlo, sa neukazuje druhýkrát
        const tagSigs = new Set(items.filter(it => it.k.startsWith('tag:')).map(it => it.sig));
        items = items.filter(it => !(it.k.startsWith('tag:') && dropSigs.has(it.sig)) && !(it.k === 'risk' && tagSigs.has(it.sig)));
      }
      const ready = [], pending = [];
      for (const it of items) {
        const st = it.st;
        if (st.withN >= minN && totalN - st.withN >= 1) {
          const r = summarize(it.k, it.label, st.withN, st.withHit, totalN, totalHit, group);
          r.sig = it.sig;
          ready.push(r);
        } else if (st.withN < minN) {
          pending.push({ key: it.k, label: it.label, n: st.withN });
        }
      }
      ready.sort(sortResults);
      pending.sort((a, b) => b.n - a.n);
      return { ready, pending };
    }

    const foods = finish(foodStats, 'food');
    const ctx = finish(ctxStats, 'ctx', new Set(foods.ready.map(x => x.sig)));

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
    const phase = cyclePhases(days);
    const dayFactorDefs = [
      ['sleep:zle', v => v.sleep === 'zle'],
      ['period', v => v.period === true],
      ['cyc:lut', (v, d) => phase[d] === 'lut'],
      ['cyc:fol', (v, d) => phase[d] === 'fol'],
      ['activity:ziadny', v => v.activity === 'ziadny'],
      ['water:malo', v => v.water === 'malo' || (v.water == null && v.glasses != null && v.glasses < 5)],
    ];
    const dTotal = dayList.length;
    const dHit = dayList.filter(([d]) => symDays.has(d)).length;
    const dayReady = [], dayPending = [];
    for (const [key, test] of dayFactorDefs) {
      const withDays = dayList.filter(([d, v]) => test(v, d));
      const wN = withDays.length;
      const wHit = withDays.filter(([d]) => symDays.has(d)).length;
      if (wN >= minN && dTotal - wN >= 1) dayReady.push(summarize(key, key, wN, wHit, dTotal, dHit, 'day'));
      else if (wN > 0 && wN < minN) dayPending.push({ key, label: key, n: wN });
    }
    dayReady.sort(sortResults);

    // Denná dávka: 2 a viac porcií tej istej skupiny za deň (porcia a enzým menia váhu)
    const loads = [];
    {
      const foodDays = new Set(allFood.map(e => localDate(e.ts)));
      const known = [...foodDays].filter(d => d < today && (!usesNoSym || dayKnown(d)));
      const kHit = known.filter(d => symDays.has(d)).length;
      const perDay = {};
      for (const e of allFood) {
        const d = localDate(e.ts);
        let w = e.portion === 'mala' ? 0.5 : e.portion === 'velka' ? 1.5 : 1;
        if (e.enzyme) w *= 0.5;
        for (const t of mealTags(e)) { (perDay[d] = perDay[d] || {})[t] = ((perDay[d] || {})[t] || 0) + w; }
      }
      for (const t of allTags) {
        const w = known.filter(d => perDay[d] && perDay[d][t] >= 2);
        const wHit = w.filter(d => symDays.has(d)).length;
        if (w.length >= minSub && known.length - w.length >= minSub) loads.push(summarize('load:' + t, t, w.length, wHit, known.length, kHit, 'load'));
      }
      loads.sort(sortResults);
    }

    return {
      totalN, totalHit, baseRate: totalN ? totalHit / totalN : 0,
      symptomCount: symTimes.length,
      foods: foods.ready, foodsPending: foods.pending,
      ctx: ctx.ready, ctxPending: ctx.pending,
      days: dayReady, daysPending: dayPending, dayTotal: dTotal, dayHit: dHit,
      riskCtx, stacking, loads, skipped, usesNoSym,
      opts: { fromH, toH, minN },
    };
  }

  // Fázy cyklu podľa zapísanej menštruácie: 'men' (menštruácia), 'fol' (po nej do ovulácie),
  // 'lut' (posledných 14 dní pred ďalšou). Dĺžka cyklu z údajov, inak 28 dní.
  function cyclePhases(days) {
    const ds = Object.keys(days || {}).sort();
    const isP = d => days[d] && days[d].period === true;
    const prevDay = d => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd - 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const starts = ds.filter(d => isP(d) && !isP(prevDay(d)));
    const out = {};
    if (!starts.length) return out;
    const toT = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).getTime(); };
    const lens = [];
    for (let i = 1; i < starts.length; i++) { const L = Math.round((toT(starts[i]) - toT(starts[i - 1])) / 864e5); if (L >= 20 && L <= 40) lens.push(L); }
    const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 28;
    for (const d of ds) {
      const t = toT(d);
      let si = -1;
      for (let i = 0; i < starts.length; i++) if (toT(starts[i]) <= t) si = i;
      if (si < 0) {
        // dni pred prvou zapísanou menštruáciou: ak je do nej najviac 14 dní, je to luteálna fáza
        const until = Math.round((toT(starts[0]) - t) / 864e5);
        if (until >= 1 && until <= 14) out[d] = 'lut';
        continue;
      }
      const day = Math.round((t - toT(starts[si])) / 864e5);
      const next = si + 1 < starts.length ? Math.round((toT(starts[si + 1]) - toT(starts[si])) / 864e5) : avg;
      if (day >= next + 7) continue;   // príliš ďaleko od známeho cyklu
      if (isP(d) || day < 5) out[d] = 'men';
      else if (day >= next - 14) out[d] = 'lut';
      else out[d] = 'fol';
    }
    return out;
  }

  // Najhoršie a najlepšie dni: čo sa jedlo len v jedných a nie v druhých
  function bestWorst(entries, days, now) {
    days = days || {};
    const today = localDate(now || Date.now());
    const sev = {}, foods = {};
    for (const e of entries) {
      const d = localDate(e.ts);
      if (d >= today) continue;
      if (e.type === 'symptom') sev[d] = Math.max(sev[d] || 0, e.severity || 1);
      if (e.type === 'food') (foods[d] = foods[d] || []).push(e);
    }
    const usesNoSym = Object.values(days).some(v => v && v.noSymptoms);
    const worst = Object.keys(sev).filter(d => foods[d]).sort((a, b) => sev[b] - sev[a] || (a < b ? 1 : -1)).slice(0, 3);
    const best = Object.keys(foods).filter(d => !sev[d] && (usesNoSym ? days[d] && days[d].noSymptoms : foods[d].length >= 2))
      .sort().reverse().slice(0, 3);
    if (worst.length < 2 || best.length < 2) return null;
    const collect = list => {
      const m = new Map();
      for (const d of list) {
        const seen = new Map();
        for (const e of foods[d]) {
          for (const t of mealTags(e)) seen.set('tag:' + t, t);
          for (const [k, w] of tokenize(expand(e.desc))) seen.set('w:' + k, BASE[k] || w);
        }
        for (const [k, l] of seen) { const r = m.get(k) || { key: k, label: l, n: 0 }; r.n++; m.set(k, r); }
      }
      return m;
    };
    const W = collect(worst), B = collect(best);
    const only = (A, O) => [...A.values()].filter(r => r.n >= 2 && !O.has(r.key)).sort((a, b) => b.n - a.n).slice(0, 10);
    const both = [...W.values()].filter(r => B.has(r.key) && r.n >= 2 && B.get(r.key).n >= 2).slice(0, 10);
    return { worst: worst.map(d => ({ date: d, sev: sev[d] })), best, onlyWorst: only(W, B), onlyBest: only(B, W), both };
  }

  // Ktoré jedlá patria k výsledku: skupina (tag:/load:/stack:) alebo slová jedla („mliek“, „ovsen+kas“)
  function matcher(key) {
    const m = /^(tag|load|stack):(.+)$/.exec(key);
    if (m) return e => mealTags(e).includes(m[2]);
    if (key.includes(':')) return null;   // okolnosti (zhon, pauza…) nemajú vlastné jedlá
    const ks = key.split('+');
    return e => { const t = new Set(tokenize(expand(e.desc)).map(x => x[0])); return ks.every(x => t.has(x)); };
  }

  // Dôkazy k jednému výsledku: kedy po jedle prišli ťažkosti a zoznam konkrétnych jedál
  const DELAY_BUCKETS = [[0, 1], [1, 2], [2, 4], [4, 8], [8, 24]];
  function evidence(entries, days, key, now) {
    now = now || Date.now();
    days = days || {};
    const test = matcher(key);
    if (!test) return null;
    const sym = entries.filter(e => e.type === 'symptom').sort((a, b) => a.ts - b.ts);
    const symDays = new Set(sym.map(e => localDate(e.ts)));
    const usesNoSym = Object.values(days).some(v => v && v.noSymptoms);
    const known = d => !usesNoSym || symDays.has(d) || !!(days[d] && days[d].noSymptoms);
    const firstAfter = ts => {
      let lo = 0, hi = sym.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (sym[m].ts < ts) lo = m + 1; else hi = m; }
      return lo < sym.length && sym[lo].ts - ts <= 48 * HOUR ? sym[lo] : null;
    };
    const blank = () => ({ n: 0, b: DELAY_BUCKETS.map(() => 0), none: 0 });
    const mine = blank(), rest = blank();
    const list = [];
    for (const e of entries) {
      if (e.type !== 'food') continue;
      const match = test(e);
      const s = firstAfter(e.ts);
      const delay = s ? (s.ts - e.ts) / HOUR : null;
      const ripe = e.ts + 24 * HOUR <= now;
      const ok = ripe && known(localDate(e.ts));
      if (match) list.push({ ts: e.ts, id: e.id, desc: e.desc, delay, sev: s ? s.severity || null : null, ripe, known: known(localDate(e.ts)) });
      if (!ok) continue;
      const h = match ? mine : rest;
      h.n++;
      const i = delay == null ? -1 : DELAY_BUCKETS.findIndex(([a, b]) => delay >= a && delay < b);
      if (i < 0) h.none++; else h.b[i]++;
    }
    list.sort((a, b) => b.ts - a.ts);
    const share = h => ({ n: h.n, b: h.b.map(x => h.n ? x / h.n : 0), none: h.n ? h.none / h.n : 0 });
    const M = share(mine), R = share(rest);
    // vrchol: časové okno, kde je po tomto jedle najviac ťažkostí navyše oproti ostatným
    let peak = -1, best = 0;
    M.b.forEach((x, i) => { const d = x - R.b[i]; if (mine.b[i] >= 2 && d > best + 1e-9) { best = d; peak = i; } });
    return { buckets: DELAY_BUCKETS, mine: M, rest: R, peak, list };
  }

  // Lieky a doplnky: pomáhajú? Pre každý liek užitý aspoň 3×:
  //  pred/po: dni s ťažkosťami 14 dní pred prvým užitím vs. odkedy sa užíva (ak sa užíva pravidelne),
  //  s/bez: dni s liekom vs. bez neho (od prvého užitia),
  //  pri ťažkostiach: užitý do 3 h po ťažkostiach – prišli potom do 4 h ďalšie?
  function medEffects(entries, days, now) {
    now = now || Date.now();
    days = days || {};
    const today = localDate(now);
    const sym = entries.filter(e => e.type === 'symptom').sort((a, b) => a.ts - b.ts);
    const symDays = new Set(sym.map(e => localDate(e.ts)));
    const usesNoSym = Object.values(days).some(v => v && v.noSymptoms);
    const logged = new Set(entries.map(e => localDate(e.ts)));
    const known = d => d < today && (symDays.has(d) || (usesNoSym ? !!(days[d] && days[d].noSymptoms) : logged.has(d)));
    const allDays = [...new Set(entries.map(e => localDate(e.ts)).concat(Object.keys(days)))].sort();
    const shift = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd + n, 12); return localDate(x.getTime() + 4 * HOUR); };
    const groups = new Map();
    entries.filter(e => e.type === 'med' && e.desc).forEach(e => {
      const k = norm(e.desc.trim().toLowerCase());
      const g = groups.get(k) || { name: e.desc.trim(), list: [] };
      g.list.push(e);
      groups.set(k, g);
    });
    const cnt = list => ({ n: list.length, hit: list.filter(d => symDays.has(d)).length });
    const out = [];
    for (const g of groups.values()) {
      if (g.list.length < 3) continue;
      const useDays = new Set(g.list.map(e => localDate(e.ts)));
      const first = [...useDays].sort()[0];
      const before = [], since = [];
      for (let i = 1; i <= 14; i++) { const d = shift(first, -i); if (known(d)) before.push(d); }
      allDays.filter(d => d >= first && known(d)).forEach(d => since.push(d));
      const withD = since.filter(d => useDays.has(d)), withoutD = since.filter(d => !useDays.has(d));
      // užité pri ťažkostiach
      let acute = 0, again = 0;
      for (const e of g.list) {
        const pre = sym.some(s => s.ts <= e.ts && s.ts >= e.ts - 3 * HOUR);
        if (!pre) continue;
        acute++;
        if (sym.some(s => s.ts > e.ts + 15 * 60e3 && s.ts <= e.ts + 4 * HOUR)) again++;
      }
      const regular = useDays.size >= 5 && withD.length >= since.length * 0.6;
      out.push({ name: g.name, uses: g.list.length, days: useDays.size, first, regular,
        before: cnt(before), since: cnt(since), with: cnt(withD), without: cnt(withoutD), acute, again });
    }
    return out.sort((a, b) => b.uses - a.uses);
  }

  const api = { analyze, bestWorst, evidence, medEffects, matcher, cyclePhases, setRecipes, recipeOf, expand, setCustomTags, wordsFor, tokenize, stem, norm, localDate, detectTags, mealTags, BASE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
