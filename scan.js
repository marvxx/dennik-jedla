/* Skenovanie čiarových kódov + vyhľadanie produktu v Open Food Facts.
   Prehliadač: window.Scan, Node: module.exports (čisté funkcie fungujú bez DOM). */
(function (root) {
  'use strict';

  // ---------- kontrolný znak ----------
  function validCode(code) {
    if (typeof code !== 'string' || !/^\d+$/.test(code)) return false;
    const n = code.length;
    if (n !== 8 && n !== 12 && n !== 13) return false;
    let sum = 0;
    // sprava, bez kontrolnej číslice: váhy 3,1,3,1...
    for (let i = 0; i < n - 1; i++) {
      const d = code.charCodeAt(n - 2 - i) - 48;
      sum += (i % 2 === 0) ? d * 3 : d;
    }
    return ((10 - (sum % 10)) % 10) === (code.charCodeAt(n - 1) - 48);
  }

  // ---------- mapovanie produktu z Open Food Facts ----------
  const ALLERGENS = {
    'en:milk': 'mlieko', 'en:gluten': 'lepok', 'en:eggs': 'vajcia', 'en:soybeans': 'sója', 'en:nuts': 'orechy',
    'en:peanuts': 'arašidy', 'en:sesame-seeds': 'sezam', 'en:celery': 'zeler', 'en:mustard': 'horčica',
    'en:fish': 'ryby', 'en:crustaceans': 'kôrovce', 'en:molluscs': 'mäkkýše', 'en:lupin': 'vlčí bôb',
    'en:sulphur-dioxide-and-sulphites': 'siričitany'
  };
  const ALLERGEN_TAGS = { 'en:milk': 'mliecne', 'en:gluten': 'lepok', 'en:peanuts': 'strukoviny', 'en:lupin': 'strukoviny' };
  const SWEETENER_E = new Set([420, 421, 953, 965, 966, 967, 968, 950, 951, 952, 954, 955, 957, 959, 960, 961, 962]);

  const str = (v) => (typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const tagLabel = (t) => ALLERGENS[t] || String(t).replace(/^[a-z]{2}:/, '');

  // malé písmená, bez diakritiky
  function norm(s) {
    return str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ø/g, 'o').replace(/æ/g, 'ae');
  }

  // Oddelené časti textu, ktoré nepatria k zloženiu ("môže obsahovať stopy…")
  const TRACE_CUT = /\b(?:may contain|may also contain|can contain|contains traces|traces of|produced in|manufactured in|moze obsahovat|mozu obsahovat|moze obsahovat|muze obsahovat|obsahuje stopy|stopy|kann spuren|kann enthalten|moze zawierac|moga zawierac|vyrobene v|vyrobeno v)\b[^.]*\.?/g;
  // Frázy, ktoré by dali falošný zásah
  const NEUTRAL = [
    // lecitín (sójový, slnečnicový…) je emulgátor v stopovom množstve, nie strukovina
    /\b(?:soy|soya|soja|soj[a-z]*)\s+(?:lecit[a-z]*|lecyt[a-z]*|lezith[a-z]*)\b/g,
    /\b(?:lecit[a-z]*|lecyt[a-z]*|lezith[a-z]*)(?:\s+(?:z|ze|zo|from|aus))?\s+(?:soy[a-z]*|soj[a-z]*)\b/g,
    /\bcream of tartar\b/g, /\bgluten[ -]?free\b/g, /\bfree from gluten\b/g, /\bwithout gluten\b/g, /\bbez lepku\b/g, /\bbez glutenu\b/g,
    /\bwheat[ -]?free\b/g, /\bbez psenice\b/g, /\blactose[ -]?free\b/g, /\blaktose[ -]?frei\b/g, /\bbez laktozy\b/g,
    /\balcohol[ -]?free\b/g, /\bbez alkoholu\b/g, /\bwine vinegar\b/g, /\bfermented (?:spirit )?vinegar\b/g, /\bvinegar fermented(?: spirit)?\b/g, /\bfermented spirit\b/g, /\bkvasny liehovy\b/g, /\bocot kvasny\b/g, /\bcider vinegar\b/g, /\bsugar alcohols?\b/g
  ];

  const rx = (s) => new RegExp(s);
  const PLANT_MILK = rx('^(?:coconut|almond|soy|soya|soja|oat|rice|hazelnut|cashew|nut|pea|hemp|kokos\\w*|mandl\\w*|mandel\\w*|migdal\\w*|soj\\w*|ovsen\\w*|hafer\\w*|owsian\\w*|ryz\\w*|reis\\w*|orech\\w*|lieskov\\w*|kesu\\w*|hrasok\\w*|konopn\\w*)$');
  const PLANT_BUTTER = rx('^(?:cocoa|cacao|peanut|shea|nut|almond|cashew|hazelnut|sesame|sunflower|apple|coconut|palm|mango|illipe|kokum|karite|kakao\\w*|arasid\\w*|arachid\\w*|mandl\\w*|bambuck\\w*|orech\\w*|sezam\\w*|slnecnic\\w*|kokos\\w*|mangov\\w*|erdnuss\\w*)$');
  const BEAN_NOT = rx('^(?:cocoa|cacao|coffee|vanilla|tonka|kakao\\w*|kavov\\w*|vanilk\\w*|vanilov\\w*)$');
  const GLUTEN_NOT = rx('^(?:corn|maize|rice|kukuric\\w*|kukurican\\w*|ryz\\w*|mais)$');
  const ALC_NOT = rx('^(?:benzyl|cetyl|stearyl|isopropyl|polyvinyl|fatty|sugar|polyol|cukrov\\w*|mastn\\w*|zucker\\w*)$');
  const CHIPS_NOT = rx('^(?:choco\\w*|chocolat\\w*|cokolad\\w*|kakao\\w*|cookie\\w*|cookies|oreo)$');

  // pravidlá: [regex slova, regex predchádzajúceho slova na vylúčenie]
  const RULES = {
    mliecne: [
      [rx('^(?:milk|milks|milkfat|milky|milkpowder)$'), PLANT_MILK],
      [rx('^lactos'), null],
      [rx('^(?:whey|casein\\w*|lactalbumin\\w*|lactoglobulin\\w*|kefir\\w*|quark|ghee|paneer|ricotta|mascarpone|mozzarella|cheddar|gouda|edam|emmental\\w*|camembert|brie|parmesan|parmigiano|feta|halloumi|cheese\\w*)$'), null],
      [rx('^[yj]ogh?urt\\w*$'), null],
      [rx('^butter(?:s|fat|oil|milk)?$'), PLANT_BUTTER],
      [rx('^cream(?:s|y|er)?$'), rx('^(?:coconut|kokos\\w*)$')],
      [rx('^(?:mliek|mliec|mlec|mlek)'), PLANT_MILK],
      [rx('^(?:smotan|smetan|smietan|slahack|srvatk|syrovatk|tvaroh|laktoz|laktos|laktalbumin|kazein|serwatk)'), null],
      [rx('^masl(?:o|a|u|e|om|ov\\w*)$'), rx('^(?:kakao\\w*|arasid\\w*|arachid\\w*|shea|bambuck\\w*|mandl\\w*|kokos\\w*|orech\\w*|sezam\\w*|slnecnic\\w*|mangov\\w*|lieskov\\w*)$')],
      [rx('^syr(?:y|a|u|e|om|mi|och)?$'), null],
      [rx('^ser(?:a|ek|owi|em|y|ow)?$'), null],
      [rx('^milch(?!saure|sauer)'), null],
      [rx('^(?:molke|sahne|rahm|kase|kasein)'), null]
    ],
    lepok: [
      [rx('^(?:wheat|barley|spelt|semolina|durum|couscous|seitan|bulgur|kamut|triticale|einkorn)'), null],
      [rx('^rye$'), null],
      [rx('^gluten(?!free|frei|fri|mentes)'), GLUTEN_NOT],
      [rx('^(?:psenic|pszen|jacmen|jecmen|jeczmien|weizen|gerste|roggen|dinkel|orkisz|spalda|razn)'), null],
      [rx('^raz$'), null],
      [rx('^zit(?:o|a|u|e|ou|n\\w*)$'), null],
      [rx('^zyt(?:o|a|u)$|^zytn'), null],
      [rx('^lep(?:ok|ku|kom|ek)$'), null]
    ],
    fruktoza: [
      [rx('^fru[ck]to[sz]'), null],
      [rx('^(?:honey\\w*|honig\\w*|miod\\w*|medov\\w*|invert\\w*|isoglu\\w*|agav\\w*|agawa)$'), null],
      [rx('^med(?:u|om)?$'), null],
      [rx('^apple(?:s|sauce|juice)?$'), null],
      [rx('^pears?$'), null],
      [rx('^mango(?!ld)'), null],
      [rx('^(?:jabl[kc]|jabk|apfel|hrusk|gruszk|birne)'), null]
    ],
    cesnak: [
      [rx('^(?:onion|garlic|cibul|cesnak|cesnek|czosnek|zwiebel|knoblauch|cebul|porree|porek)'), null],
      [rx('^(?:leeks?|shallots?|lauch)$'), null],
      [rx('^por(?:u|y)?$'), null]
    ],
    strukoviny: [
      [rx('^(?:soy|soj|lupin|peanut|arasid|arachid|erdnuss|orzeszk|lentil|chickpea|fazul|fazol|fasol|bohne|sosovic|socovic|cocka|cocek|soczewic|linse|cicer|cizrn|ciecierz|kichererb|hrach|groch|erbse|strukovin|luskovin|legume)'), null],
      [rx('^beans?$'), BEAN_NOT],
      [rx('^bob(?:y|u|ov|om)?$'), BEAN_NOT],
      [rx('^peas?$'), null],
      [rx('^hras(?:ok|ku|kov)$'), null],
      [rx('^(?:tofu|tempeh|edamame|hummus|houmous|miso|natto)$'), null]
    ],
    sladidla: [
      [rx('^sweeteners?$'), null],
      [rx('^(?:sorbitol|xylit|maltit|mannit|manit|isomalt|aspartam|acesulfam|sladidl|slodzik|polyol|lactitol|laktitol|neotam|sussungsmittel|sussstoff|zuckeraustausch)'), null],
      [rx('^sorbit$'), null],
      [rx('^ery(?:th|t)rit'), null],
      [rx('^su[ck]ralo'), null],
      [rx('^sacc?harin'), null],
      [rx('^cycl?amat|^cyklamat'), null],
      [rx('^stevi[ao]'), null]
    ],
    pikantne: [
      [rx('^(?:chil+i\\w*|chile|chiles|chilly|cili)$'), null],
      [rx('^(?:cayenne|jalape|feferon|paliv|capsaicin|tabasco|sriracha|peperoncin|pepperoncin|harissa|scharf)'), null]
    ],
    kava: [
      [rx('^(?:coffee|kaffee|espresso|cappucc)'), null],
      [rx('^kav(?:a|y|e|u|ou|ov\\w*)$'), null],
      [rx('^kaw(?:a|y|ie|e|ow\\w*)$'), null],
      [rx('^(?:latte|mocha|mokka)$'), null]
    ],
    alkohol: [
      [rx('^(?:alcohol|alkohol)'), ALC_NOT],
      [rx('^(?:ethanol|etanol|lieh)$|^ethanol|^etanol'), null],
      [rx('^(?:wines?|beers?|bier|piwo|wino|wein(?:e|es)?|vin(?:o|a|e|om|u)|piv(?:o|a|e|om|u))$'), null],
      [rx('^(?:vodka|whisk(?:e)?y|brandy|liqueur|liker|likier|cognac|konak|gin|rum|tequila|champagne|sekt|prosecco|cider|lager)$'), null]
    ],
    sycene: [
      [rx('^(?:carbonated|kohlensaure|kohlensaeure|sycen|syten|sparkling|fizzy|sodovk|perliv|gazowan|sprudel)'), null]
    ],
    histamin: [
      [rx('^(?:smoked|cured|fermented|aged)$'), null],
      [rx('^(?:ferment|salam|prosciutto|sauerkraut|parmes|parmigiano|pecorino|gorgonzola|roquefort|uden|uzen|wedzon|geraucher|gereift|zrej|kvasen|dojrzewaj)'), null]
    ],
    mastne: [
      [rx('^(?:fried|deepfried|frittiert|vyprazan|smazen|smazon|palmov|palmol|palmow)'), null]
    ]
  };
  // len z názvu produktu
  const NAME_RULES = {
    sladidla: [[rx('^light$'), null]],
    mastne: [
      [rx('^(?:crisps|chips|cipsy|cips\\w*)$'), CHIPS_NOT],
      [rx('^(?:fries|frites|hranolk\\w*|pommes)$'), null]
    ]
  };
  // frázy (hľadané v celom texte)
  const PHRASES = {
    sladidla: [],
    pikantne: [/ hot peppers? /, / hot sauce /, / capsicum extract /, / capsicum oleoresin /],
    sycene: [/ carbon dioxide /, / oxid(?:u)? uhlicit(?:y|eho|ym) /, / kyslicnik uhlicity /],
    mastne: [/ palm (?:oil|fat|kernel|olein|stearin) /],
    fruktoza: [/ high fructose /],
    strukoviny: [/ pea protein /]
  };

  function words(text) { return norm(text).split(/[^a-z0-9]+/).filter(Boolean); }

  // Vyčistí text (odreže stopy, neutralizuje frázy) a vráti slová
  function cleanWords(text) {
    let s = norm(text).replace(TRACE_CUT, ' ');
    s = s.replace(/[^a-z0-9.]+/g, ' ');
    for (const re of NEUTRAL) s = s.replace(re, ' ');
    return s.split(/[^a-z0-9]+/).filter(Boolean);
  }

  function matchGroups(ws, rules, found) {
    for (const g in rules) {
      if (found.has(g)) continue;
      outer:
      for (let i = 0; i < ws.length; i++) {
        for (const [re, notPrev] of rules[g]) {
          if (!re.test(ws[i])) continue;
          if (notPrev && i > 0 && notPrev.test(ws[i - 1])) continue;
          found.add(g);
          break outer;
        }
      }
    }
  }
  function matchPhrases(ws, found) {
    const joined = ' ' + ws.join(' ') + ' ';
    for (const g in PHRASES) {
      if (found.has(g)) continue;
      if (PHRASES[g].some((re) => re.test(joined))) found.add(g);
    }
  }

  function deriveTags(names, ingTexts) {
    const found = new Set();
    const nameWords = [];
    names.forEach((n) => { nameWords.push(...cleanWords(n), '|'); });
    const ingWords = [];
    ingTexts.forEach((t) => { ingWords.push(...cleanWords(t), '|'); });
    const all = nameWords.concat(ingWords);
    matchGroups(all, RULES, found);
    matchGroups(nameWords, NAME_RULES, found);
    matchPhrases(all, found);
    return found;
  }

  function mapProduct(p, code) {
    p = (p && typeof p === 'object') ? p : {};
    const trim = (v) => str(v).trim();
    const name = trim(p.product_name_sk) || trim(p.product_name_cs) || trim(p.product_name);
    const brand = trim(str(p.brands).split(',')[0]);
    const quantity = trim(p.quantity);

    const cands = [['sk', p.ingredients_text_sk], ['cs', p.ingredients_text_cs], [str(p.lang), p.ingredients_text], ['en', p.ingredients_text_en]];
    let ingredients = '', ingLang = '';
    for (const [l, v] of cands) {
      const t = trim(v);
      if (t) { ingredients = t.replace(/_/g, '').trim(); ingLang = l; break; }
    }
    if (!ingredients) ingLang = str(p.lang);

    const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
    const allergens = uniq(arr(p.allergens_tags).map((t) => tagLabel(str(t))));
    const traces = uniq(arr(p.traces_tags).map((t) => tagLabel(str(t))));

    const tags = new Set();
    // a) alergény (nie stopy)
    arr(p.allergens_tags).forEach((t) => { if (ALLERGEN_TAGS[t]) tags.add(ALLERGEN_TAGS[t]); });
    // b) sladidlá z E-čísel
    arr(p.additives_tags).forEach((t) => {
      const m = /^[a-z]{2}:e(\d+)/i.exec(str(t));
      if (m && SWEETENER_E.has(parseInt(m[1], 10))) tags.add('sladidla');
    });
    // c) kľúčové slová z názvu a zloženia
    const names = [p.product_name_sk, p.product_name_cs, p.product_name].map(str);
    const ingTexts = [p.ingredients_text_sk, p.ingredients_text_cs, p.ingredients_text, p.ingredients_text_en].map(str);
    deriveTags(names, ingTexts).forEach((g) => tags.add(g));
    // d) vlastný detektor aplikácie (aj vlastné skupiny c_…)
    try {
      const A = root.Analysis;
      if (A && typeof A.detectTags === 'function') {
        if (name) arr(A.detectTags(name)).forEach((t) => { if (typeof t === 'string' && t) tags.add(t); });
        if (ingredients) arr(A.detectTags(ingredients)).forEach((t) => { if (typeof t === 'string' && t.startsWith('c_')) tags.add(t); });
      }
    } catch (e) { console.warn('Analysis.detectTags zlyhalo', e); }

    return { code: str(code) || trim(p.code), name, brand, quantity, ingredients, ingLang, allergens, traces, tags: [...tags] };
  }

  // ---------- vyhľadanie v Open Food Facts ----------
  const FIELDS = 'code,product_name,product_name_sk,product_name_cs,brands,quantity,serving_size,ingredients_text,ingredients_text_sk,ingredients_text_cs,ingredients_text_en,allergens_tags,traces_tags,additives_tags,lang';

  async function lookup(code) {
    try {
      const c = str(code).trim();
      if (!/^\d{4,14}$/.test(c)) return { status: 'notfound' };
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'error', reason: 'offline' };
      const ctrl = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 10000);
      try {
        const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(c) + '.json?fields=' + FIELDS, { signal: ctrl.signal });
        if (r.status === 404) return { status: 'notfound' };
        if (!r.ok) return { status: 'error', reason: 'http' };
        let data = null;
        try { data = await r.json(); } catch (e) { if (timedOut) throw e; return { status: 'error', reason: 'http' }; }
        if (data && data.status === 1 && data.product && typeof data.product === 'object') {
          return { status: 'found', product: mapProduct(data.product, c) };
        }
        return { status: 'notfound' };
      } catch (e) {
        return { status: 'error', reason: timedOut ? 'timeout' : 'network' };
      } finally { clearTimeout(timer); }
    } catch (e) {
      return { status: 'error', reason: 'network' };
    }
  }

  // ---------- kamera (len prehliadač) ----------
  const MSG_DENIED = 'Kamera nie je povolená. Povoľ ju alebo zadaj číslo ručne.';
  const MSG_NOCAM = 'Nenašla sa žiadna kamera.';
  const MSG_OTHER = 'Kameru sa nepodarilo spustiť. Zadaj číslo ručne.';

  function errMessage(e) {
    const s = ((e && e.name) || '') + ' ' + ((e && e.message) || (typeof e === 'string' ? e : ''));
    if (/NotAllowed|PermissionDenied|SecurityError/i.test(s)) return MSG_DENIED;
    if (/NotFound|DevicesNotFound/i.test(s)) return MSG_NOCAM;
    return MSG_OTHER;
  }

  let sess = 0;            // počítadlo relácií (ochrana pred súbehom)
  let active = false;      // štartuje sa alebo beží
  let curContainer = null, curVideo = null, curStream = null;
  let usingQuagga = false, rafId = 0, quaggaHandler = null;
  let quaggaTask = Promise.resolve();
  let quaggaPromise = null;

  function loadQuagga() {
    if (root.Quagga) return Promise.resolve(root.Quagga);
    if (quaggaPromise) return quaggaPromise;
    quaggaPromise = new Promise((resolve, reject) => {
      try {
        const s = document.createElement('script');
        s.src = 'vendor/quagga.min.js';
        s.onload = () => (root.Quagga ? resolve(root.Quagga) : reject(new Error('Quagga sa nenačítala')));
        s.onerror = () => reject(new Error('Quagga sa nenačítala'));
        document.head.appendChild(s);
      } catch (e) { reject(e); }
    });
    quaggaPromise.catch(() => { quaggaPromise = null; try { document.querySelectorAll('script[src="vendor/quagga.min.js"]').forEach((n) => n.remove()); } catch (e) {} });
    return quaggaPromise;
  }

  function stopTracks(stream) {
    try { if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} }); } catch (e) {}
  }

  // Zastaví všetko okrem zvýšenia relácie
  function teardown() {
    active = false;
    if (rafId) { try { cancelAnimationFrame(rafId); } catch (e) {} rafId = 0; }
    if (usingQuagga) {
      const Q = root.Quagga;
      try { if (quaggaHandler) Q.offDetected(quaggaHandler); } catch (e) {}
      try { Q.stop(); } catch (e) {}
      usingQuagga = false;
    }
    quaggaHandler = null;
    stopTracks(curStream); curStream = null;
    const v = curVideo, c = curContainer;
    curVideo = null; curContainer = null;
    try {
      if (v) {
        try { v.pause(); } catch (e) {}
        stopTracks(v.srcObject);
        v.srcObject = null;
      }
      if (c) {
        c.querySelectorAll('canvas').forEach((n) => n.remove());
        c.querySelectorAll('video').forEach((n) => n.remove());
      }
      if (v && v.parentNode) v.parentNode.removeChild(v);
    } catch (e) {}
  }

  function stop() {
    try { sess++; teardown(); } catch (e) { console.warn('Scan.stop', e); }
  }

  function isRunning() { return active; }

  async function nativeSupported() {
    try {
      if (!root.BarcodeDetector || typeof root.BarcodeDetector.getSupportedFormats !== 'function') return false;
      const f = await root.BarcodeDetector.getSupportedFormats();
      return Array.isArray(f) && f.indexOf('ean_13') !== -1;
    } catch (e) { return false; }
  }

  function start(container, opts) {
    opts = opts || {};
    stop();
    const my = ++sess;
    active = true;
    let done = false;
    let lastCode = '', lastCount = 0;

    const fail = (e) => {
      if (my !== sess || done) return;      // zastarená relácia: ticho
      done = true;
      teardown();
      console.warn('Scan.start zlyhalo', e);
      try { if (opts.onError) opts.onError(errMessage(e), e); } catch (x) { console.warn(x); }
    };
    const accept = (code) => {
      if (my !== sess || done) return;
      done = true;
      teardown();
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
      try { if (opts.onCode) opts.onCode(code); } catch (x) { console.warn(x); }
    };
    const consider = (code, needed) => {
      if (my !== sess || done || !validCode(code)) return;
      if (code === lastCode) lastCount++; else { lastCode = code; lastCount = 1; }
      if (lastCount >= needed) accept(code);
    };

    (async () => {
      try {
        if (!container || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw new Error('getUserMedia nie je dostupné');
        const native = await nativeSupported();
        if (my !== sess) return;
        if (!native) {
          await loadQuagga();
          if (my !== sess) return;
        }
        const v = document.createElement('video');
        v.setAttribute('playsinline', ''); v.setAttribute('autoplay', ''); v.setAttribute('muted', '');
        v.playsInline = true; v.muted = true; v.autoplay = true;
        container.appendChild(v);
        curContainer = container; curVideo = v;

        if (native) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          if (my !== sess) { stopTracks(stream); return; }
          curStream = stream;
          v.srcObject = stream;
          try { await v.play(); } catch (e) { console.warn('video.play', e); }
          if (my !== sess) return;
          const det = new root.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          let busy = false, errs = 0;
          const tick = async () => {
            if (my !== sess || done) return;
            if (!busy && v.readyState >= 2) {
              busy = true;
              try {
                const r = await det.detect(v);
                if (my === sess && r && r.length) {
                  for (let i = 0; i < r.length; i++) {
                    const c = String(r[i].rawValue || '');
                    if (validCode(c)) { consider(c, 2); break; }
                  }
                }
              } catch (e) { if (errs++ < 3) console.warn('BarcodeDetector.detect', e); }
              busy = false;
            }
            if (my === sess && !done) rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
          return;
        }

        // Quagga: jedna globálna inštancia, počkáme na dobehnutie predošlej
        const Q = root.Quagga;
        const task = (async () => {
          await quaggaTask;
          if (my !== sess) return;
          await new Promise((resolve, reject) => {
            Q.init({
              inputStream: {
                type: 'LiveStream',
                target: container,
                constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
              },
              locator: { patchSize: 'medium', halfSample: true },
              numOfWorkers: 0,
              frequency: 10,
              decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'] },
              locate: true
            }, (err) => (err ? reject(err) : resolve()));
          });
          if (my !== sess) {
            // medzitým sa volalo stop(): uvoľni kameru
            try { Q.stop(); } catch (e) {}
            stopTracks(v.srcObject);
            return;
          }
          quaggaHandler = (res) => {
            try {
              const c = res && res.codeResult && res.codeResult.code;
              if (c) consider(String(c), 3);
            } catch (e) { console.warn('Quagga detected', e); }
          };
          usingQuagga = true;
          Q.onDetected(quaggaHandler);
          Q.start();
          try {
            container.querySelectorAll('canvas').forEach((n) => { n.style.display = 'none'; });
            const qv = container.querySelector('video');
            if (qv) { qv.setAttribute('playsinline', ''); qv.muted = true; curVideo = qv; }
          } catch (e) {}
        })();
        quaggaTask = task.catch(() => {});
        await task;
      } catch (e) { fail(e); }
    })();
  }

  // ---------- čítanie z fotky ----------
  function decodeOnce(Q, src, size, patch) {
    return new Promise((resolve) => {
      let finished = false;
      const end = (v) => { if (!finished) { finished = true; clearTimeout(t); resolve(v); } };
      const t = setTimeout(() => end(null), 20000);
      try {
        Q.decodeSingle({
          src, numOfWorkers: 0, inputStream: { size, singleChannel: false },
          locator: { patchSize: patch, halfSample: true }, locate: true,
          decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'] }
        }, (res) => end(res && res.codeResult ? String(res.codeResult.code) : null));
      } catch (e) { console.warn('decodeSingle', e); end(null); }
    });
  }

  async function decodePhoto(file) {
    let url = null;
    try {
      if (!file) return null;
      const Q = await loadQuagga();
      url = URL.createObjectURL(file);
      const attempts = [[800, 'medium'], [1280, 'medium'], [1280, 'large'], [800, 'small'], [1920, 'medium']];
      for (const [size, patch] of attempts) {
        const c = await decodeOnce(Q, url, size, patch);
        if (c && validCode(c)) return c;
      }
      return null;
    } catch (e) {
      console.warn('Scan.decodePhoto', e);
      return null;
    } finally {
      try { if (url) URL.revokeObjectURL(url); } catch (e) {}
    }
  }

  // ---------- automatické zastavenie ----------
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('pagehide', () => { if (active) stop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && active) stop(); });
  }

  const api = { validCode, mapProduct, lookup, start, stop, decodePhoto, isRunning };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scan = api;
})(typeof window !== 'undefined' ? window : globalThis);
