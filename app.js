/* Denník jedla a trávenia – celá aplikácia. Údaje zostávajú len v telefóne (IndexedDB). */
(function () {
  'use strict';

  const APP_VERSION = '3.4';

  // Vlastné čiarové ikony (namiesto emoji)
  const IC = {
    food: '<path d="M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 3c-2 1.500-3 4-3 7 0 1.600 1.200 2.500 3 2.500V21"/>',
    symptom: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
    stool: '<circle cx="8" cy="9" r="5"/><circle cx="8" cy="9" r="1.500"/><path d="M8 4h9c1.700 0 3 2.200 3 5v11h-9V9"/>',
    med: '<path d="M10.500 20.500a5 5 0 0 1-7-7l9-9a5 5 0 0 1 7 7zM8 8l8 8"/>',
    warn: '<path d="M12 4 2.500 20h19zM12 10v5M12 17.500v.500"/>',
    check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    q: '<path d="M9 9a3 3 0 1 1 4.500 2.600c-1 .600-1.500 1.200-1.500 2.400M12 17.500v.500"/>',
    star: '<path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900-4.300-4.100 5.900-.800z"/>',
    save: '<path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19h14"/>',
    open: '<path d="M12 15V4M7.500 8.500 12 4l4.500 4.500M5 19h14"/>',
    doc: '<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.500h16M10 5v14"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.500 2h-15zM10 20.500h4"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.500"/><path d="M11 18h2"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    scan: '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M17 9v6"/>',
  };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
  const DAY = 864e5;

  // ---------- Číselníky ----------
  const TYPES = {
    food:    { label: 'Jedlo / pitie', csv: 'Jedlo/pitie', ico: '' },
    symptom: { label: 'Ťažkosti',      csv: 'Ťažkosti',    ico: '' },
    stool:   { label: 'Stolica',       csv: 'Stolica',     ico: '' },
    med:     { label: 'Lieky / iné',   csv: 'Lieky/iné',   ico: '' },
  };
  TYPES.food.ico = ic('food'); TYPES.symptom.ico = ic('symptom'); TYPES.stool.ico = ic('stool'); TYPES.med.ico = ic('med');
  TYPES.food.short = 'Jedlo'; TYPES.symptom.short = 'Ťažkosti'; TYPES.stool.short = 'Stolica'; TYPES.med.short = 'Lieky';
  // Bristolská škála; staršie záznamy (tvrdá…hnačka) sa zobrazujú ďalej
  const BRISTOL = [['b1', '1 – tvrdé hrudky'], ['b2', '2 – tvrdá, hrudkovitá'], ['b3', '3 – s prasklinami na povrchu'],
    ['b4', '4 – hladká a mäkká'], ['b5', '5 – mäkké kúsky'], ['b6', '6 – kašovitá'], ['b7', '7 – vodnatá']];
  const STOOL = BRISTOL.concat([['tvrda', 'tvrdá'], ['normalna', 'normálna'], ['makka', 'mäkká'], ['hnacka', 'hnačka']]);
  const PORTION = [['mala', 'malá'], ['normalna', 'normálna'], ['velka', 'veľká']];
  const TAGS = [
    ['mliecne', '', 'mliečne / laktóza'], ['lepok', '', 'lepok / pečivo'], ['fruktoza', '', 'fruktóza / ovocie, med'],
    ['cesnak', '', 'cibuľa / cesnak'], ['strukoviny', '', 'strukoviny'], ['histamin', '', 'histamín / zrejúce, údené'],
    ['kava', '', 'káva'], ['alkohol', '', 'alkohol'], ['sycene', '', 'sýtené nápoje'],
    ['sladidla', '', 'sladidlá / light'], ['pikantne', '', 'pikantné'], ['mastne', '', 'mastné / vyprážané'],
    ['surova', '', 'surová zelenina'],
  ];
  // odkiaľ je jedlo (kto ho pripravil), nie kde sa jedlo
  const PLACES = [['doma', 'uvarené doma'], ['restauracia', 'reštaurácia, jedáleň'], ['niekto', 'u niekoho na návšteve'], ['kupovane', 'kúpené hotové (obchod, bufet)']];
  const KINDS = ['kŕč', 'nadúvanie', 'plynatosť', 'nevoľnosť', 'pálenie záhy', 'nutkanie na stolicu'];
  const LOCATION = [['horna', 'hore'], ['pupok', 'okolo pupka'], ['dolna', 'dole'], ['lava', 'ľavá strana'], ['prava', 'pravá strana'], ['cele', 'celé brucho']];
  const DURATIONS = ['5 min', '15 min', '30 min', '1 h', '2 h', 'viac hodín'];
  const MOODS = [[1, '😣'], [2, '🙁'], [3, '😐'], [4, '🙂'], [5, '😄']];
  const MOOD_TXT = { 1: 'veľmi zlá', 2: 'zlá', 3: 'neutrálna', 4: 'dobrá', 5: 'veľmi dobrá' };
  const MED_DEFAULTS = ['ibuprofén', 'paralen', 'No-Spa', 'antibiotiká', 'probiotiká', 'antikoncepcia'];
  const SLEEP = [['zle', 'zle'], ['ok', 'ok'], ['dobre', 'dobre']];
  const PERIOD = [[false, 'nie'], [true, 'áno']];
  const ACTIVITY = [['ziadny', 'žiadny'], ['trochu', 'trochu'], ['vela', 'veľa']];
  const WATER = [['malo', 'málo'], ['ok', 'dosť']];
  const DAY_FIELDS = [
    ['sleep', 'Spánok', SLEEP, 'str'], ['period', 'Menštruácia', PERIOD, 'bool'],
    ['activity', 'Pohyb', ACTIVITY, 'str'], ['water', 'Pitie', WATER, 'str'],
  ];
  const CTX_LABELS = {
    'rushed': 'jedlo v zhone', 'portion:velka': 'veľká porcia',
    'stress:high': 'stres 4–5 pri jedle', 'mood:low': 'zlá nálada pri jedle',
    'sleep:zle': 'zlý spánok', 'period': 'menštruácia',
    'cyc:lut': 'dni pred menštruáciou (luteálna fáza)', 'cyc:fol': 'dni po menštruácii (folikulárna fáza)',
    'activity:ziadny': 'deň bez pohybu', 'water:malo': 'málo pitia',
    'risk': 'obsahuje moje rizikové suroviny',
    'risk&enzyme': 's enzýmom (laktáza…)', 'risk&away': 'jedlo nie z domu', 'risk&stress': 'pri strese 4–5',
    'risk&period': 'počas menštruácie', 'risk&sleep': 'po zlom spánku', 'risk&rushed': 'v zhone',
  };
  TAGS.forEach(([v, e, t]) => { CTX_LABELS['tag:' + v] = t; CTX_LABELS['stack:' + v] = t; CTX_LABELS['load:' + v] = t + ' – 2 a viac porcií za deň'; });
  Object.assign(CTX_LABELS, { 'late': 'jedlo po 20:00', 'gap:long': 'jedlo po dlhej pauze (5 h a viac)', 'first:kava': 'káva ako prvé v daný deň' });
  PLACES.forEach(([v, l]) => { CTX_LABELS['place:' + v] = 'jedlo: ' + l; });
  const tagLabel = t => { const x = TAGS.find(y => y[0] === t); return x ? x[2] : t; };

  // ---------- Pomocné ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const dateStr = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  // Deň sa začína o 4:00: neskorá večera po polnoci patrí ešte k predošlému dňu
  const DAY_START_H = 4;
  const dayOf = ts => dateStr(ts - DAY_START_H * 3600e3);
  const todayStr = () => dayOf(Date.now());
  const fmtTime = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const toLocalInput = ts => dateStr(ts) + 'T' + fmtTime(ts);
  const lab = (list, v) => { const f = list.find(x => x[0] === v); return f ? f[1] : ''; };
  const pct = x => Math.round(x * 100) + ' %';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const WEEKDAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];

  function fmtDayHead(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (ds === todayStr()) return 'Dnes';
    if (ds === dayOf(Date.now() - DAY)) return 'Včera';
    const yr = y !== new Date().getFullYear() ? ' ' + y : '';
    const wd = WEEKDAYS[dt.getDay()];
    return wd.charAt(0).toUpperCase() + wd.slice(1) + ' ' + d + '. ' + m + '.' + yr;
  }
  function fmtDateLong(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()] + ' ' + d + '. ' + m + '. ' + y;
  }
  function daysAgoText(n) {
    if (n <= 0) return 'dnes';
    if (n === 1) return 'včera';
    if (n < 5) return 'pred ' + n + ' dňami';
    return 'pred ' + n + ' dňami';
  }

  // Oznam dole; s akciou (napr. „Späť“) ostane dlhšie a dá sa naň ťuknúť
  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast');
    t.textContent = '';
    const s = document.createElement('span');
    s.textContent = msg;
    t.appendChild(s);
    t.classList.toggle('has-act', !!action);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-act';
      b.textContent = action.label || 'Späť';
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        clearTimeout(toastTimer);
        t.classList.remove('show');
        action.run();
      });
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2200);
  }

  // Krátka vibrácia len pri dôležitých chvíľach (iPhone v Safari ju nepodporuje, nič sa nestane)
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (_) { /* nič */ } }

  // ---------- Pohyb: pružiny ako v iOS ----------
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // damping 1 = bez prekmitu, < 1 = jemne pruží; response = ako rýchlo dorazí (s)
  const SPRING_OPEN = { damping: 1, response: 0.38 };
  const SPRING_BACK = { damping: 0.85, response: 0.32 };   // po pustení prsta: trochu pruží
  const SPRING_CLOSE = { damping: 1, response: 0.3 };

  // Pružina vždy začína z aktuálnej polohy a rýchlosti, takže sa dá kedykoľvek prerušiť
  function spring(st, target, cfg, onFrame, onRest) {
    const k = Math.pow(2 * Math.PI / cfg.response, 2), c = 4 * Math.PI * cfg.damping / cfg.response;
    cancelAnimationFrame(st.raf);
    let last = performance.now();
    const step = now => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000));
      last = now;
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) {
        st.v += (-k * (st.x - target) - c * st.v) * h;
        st.x += st.v * h;
      }
      if (Math.abs(st.v) < 4 && Math.abs(st.x - target) < 0.5) {
        st.x = target; st.v = 0; st.raf = 0;
        onFrame();
        if (onRest) onRest();
        return;
      }
      onFrame();
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }
  // Pri obmedzenom pohybe: len prelínanie priehľadnosti
  function fadeTo(st, target, ms, onFrame, onRest) {
    cancelAnimationFrame(st.raf);
    const from = st.o, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms);
      st.o = from + (target - from) * p;
      onFrame();
      if (p < 1) st.raf = requestAnimationFrame(step);
      else { st.raf = 0; if (onRest) onRest(); }
    };
    st.raf = requestAnimationFrame(step);
  }
  // Za okrajom ide prvok za prstom čoraz menej (ako guma)
  const rubberband = (over, dim) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));
  // Kam by prvok dobehol po švihnutí (rýchlosť v px/s)
  const project = v => (v / 1000) * 0.998 / (1 - 0.998);

  // Stav panelov: x = posun nadol v px (0 = otvorený), v = rýchlosť, o = priehľadnosť
  const SM = {};
  const sheetSt = id => SM[id] || (SM[id] = { x: 0, v: 0, o: 1, raf: 0, vis: false });
  const sheetH = el => el.offsetHeight + 24;
  function paintSheet(el, st) {
    el.style.transform = `translate3d(0, ${st.x.toFixed(2)}px, 0)`;
    el.style.opacity = st.o < 1 ? st.o.toFixed(3) : '';
    st.level = st.vis ? st.o * Math.max(0, Math.min(1, 1 - st.x / sheetH(el))) : 0;
    const lv = Math.max(0, ...Object.values(SM).map(s => s.level || 0));
    $('#scrim').style.opacity = lv.toFixed(3);
  }
  function moveSheet(id, open, v, cfg) {
    const el = document.getElementById(id), st = sheetSt(id);
    const H = sheetH(el);
    if (!st.vis) {
      if (!open) return;
      st.vis = true; st.v = 0;
      st.x = reduceMotion.matches ? 0 : H;
      st.o = reduceMotion.matches ? 0 : 1;
      el.style.visibility = 'visible';
    }
    if (typeof v === 'number') st.v = v;
    const done = () => {
      if (open) return;
      st.vis = false; st.level = 0;
      el.style.visibility = '';
      el.style.opacity = '';
      paintSheet(el, st);
    };
    const frame = () => paintSheet(el, st);
    if (reduceMotion.matches) {
      // posun nechá tam, kde ho prst nechal, a len zmizne alebo sa vráti
      if (open) { st.x = 0; fadeTo(st, 1, 180, frame, done); }
      else fadeTo(st, 0, 180, frame, done);
      return;
    }
    st.o = 1;
    spring(st, open ? 0 : H, cfg || (open ? SPRING_OPEN : SPRING_CLOSE), frame, done);
  }

  // ---------- Databáza ----------
  const DB = (() => {
    let dbp;
    function open() {
      if (!dbp) dbp = new Promise((res, rej) => {
        const r = indexedDB.open('dennik-jedla', 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'date' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return dbp;
    }
    async function tx(store, mode, fn) {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        const r = fn(s);
        if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
        t.oncomplete = () => res(result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    }
    return {
      all: store => tx(store, 'readonly', s => s.getAll()),
      put: (store, v) => tx(store, 'readwrite', s => s.put(v)),
      putMany: (store, arr) => tx(store, 'readwrite', s => { arr.forEach(v => s.put(v)); }),
      del: (store, k) => tx(store, 'readwrite', s => s.delete(k)),
      clear: store => tx(store, 'readwrite', s => s.clear()),
    };
  })();

  // ---------- Stav ----------
  let entries = [];
  let days = {};
  let meta = {};
  let draft = newDraft();
  let editingId = null;
  let todayExpanded = false;
  let listDays = 14;
  let currentView = 'today';
  let selDay = dayOf(Date.now());   // deň zobrazený na obrazovke Dnes
  let followToday = true;             // po polnoci preskočí na nový deň
  let flashId = null;                 // práve uložený záznam (krátko sa zvýrazní)
  let openSheets = [];

  function newDraft(type) {
    return {
      type: type || null, ts: Date.now(), tsTouched: false, desc: '', severity: null, duration: '',
      stool: null, stress: null, mood: null, note: '', portion: null, rushed: false,
      tags: [], noTags: [], kinds: [], location: null, place: null, enzyme: false, tsOff: 0, tsCustom: false, tagsAll: false, amount: '', product: null, rec: false,
    };
  }

  // Skupiny jedla v rozpracovanom zázname: ručne + automaticky rozpoznané – ručne vypnuté
  function autoTags() { return Analysis.detectTags(Analysis.expand(draft.desc)); }
  function effectiveTags() {
    const s = new Set(draft.tags.concat(autoTags()));
    draft.noTags.forEach(t => s.delete(t));
    return [...s];
  }
  const riskTags = () => meta.intol || [];
  const favorites = () => meta.favorites || [];

  async function setMeta(key, value) {
    meta[key] = value;
    await DB.put('meta', { key, value });
  }

  async function load() {
    const [e, d, m] = await Promise.all([DB.all('entries'), DB.all('days'), DB.all('meta')]);
    entries = e;
    days = {};
    d.forEach(x => { days[x.date] = x; });
    meta = {};
    m.forEach(x => { meta[x.key] = x.value; });
    syncCustomTags();
    Analysis.setRecipes(recipes());
  }

  // Vlastné intolerancie sa správajú ako ostatné skupiny: rozpoznanie z popisu, štítky, výpočty
  const customTags = () => meta.customTags || [];
  const recipes = () => meta.recipes || [];
  function syncCustomTags() {
    for (let i = TAGS.length - 1; i >= 0; i--) if (TAGS[i][0].startsWith('c_')) TAGS.splice(i, 1);
    customTags().forEach(c => {
      TAGS.push([c.id, '', c.label]);
      CTX_LABELS['tag:' + c.id] = c.label;
      CTX_LABELS['stack:' + c.id] = c.label;
      CTX_LABELS['load:' + c.id] = c.label + ' – 2 a viac porcií za deň';
    });
    if (Analysis.setCustomTags) Analysis.setCustomTags(customTags());
  }

  // ---------- Prepínanie obrazoviek ----------
  const ICON = {
    today: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
    list: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    insights: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  };

  // Celú kostru obrazovky stavia skript, aby vždy sedela s touto verziou
  function buildShell() {
    let app = document.getElementById('app');
    if (!app) {
      [...document.body.children].forEach(el => { if (el.tagName !== 'SCRIPT') el.remove(); });
      app = document.createElement('div');
      app.id = 'app';
      document.body.prepend(app);
    }
    const tab = (v, label) => `<button type="button" class="tab" data-view="${v}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[v]}</svg><span>${label}</span></button>`;
    app.innerHTML = `
      <main>
        <section id="view-today" class="view" aria-label="Dnes"></section>
        <section id="view-list" class="view" aria-label="Kalendár"></section>
        <section id="view-insights" class="view" aria-label="Súvislosti"></section>
        <section id="view-settings" class="view" aria-label="Nastavenia"></section>
      </main>
      <nav class="tabbar" aria-label="Hlavné menu">
        ${tab('today', 'Dnes')}${tab('list', 'Kalendár')}
        <button type="button" class="fab" data-act="add" aria-label="Nový záznam"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        ${tab('insights', 'Súvislosti')}${tab('settings', 'Nastavenia')}
      </nav>
      <div id="navbar" aria-hidden="true"><span></span></div>
      <div id="done" aria-hidden="true"><span>${ic('check')}</span></div>
      <div id="scrim"></div>
      <div class="sheet tall" id="entry-sheet" role="dialog" aria-label="Záznam"><form id="entry-form" autocomplete="off" novalidate></form></div>
      <div class="sheet tall" id="trace-dialog" role="dialog" aria-label="Čo predchádzalo"></div>
      <div class="sheet tall" id="scan-sheet" role="dialog" aria-label="Skenovať výrobok"></div>
      <div class="sheet" id="mini-sheet" role="dialog"></div>
      <div class="sheet tall" id="report-sheet" role="dialog" aria-label="Prehľad pre lekára"></div>
      <div class="sheet tall" id="help-sheet" role="dialog" aria-label="Pomocník"></div>
      <div id="toast" role="status" aria-live="polite"></div>
      <input type="file" id="import-file" accept=".json,application/json" hidden>`;
  }

  function openSheet(id) {
    const s = document.getElementById(id);
    s.classList.add('open');
    s.scrollTop = 0;
    if (!openSheets.includes(id)) openSheets.push(id);
    syncScrim();
    moveSheet(id, true);
  }
  function closeSheet(id, v) {
    document.getElementById(id).classList.remove('open');
    moveSheet(id, false, v);
    openSheets = openSheets.filter(x => x !== id);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (id === 'mini-sheet' && currentView === 'settings') renderSettings();
    if (id === 'scan-sheet' && window.Scan) Scan.stop();
    syncScrim();
  }
  function syncScrim() {
    $('#scrim').classList.toggle('show', openSheets.length > 0);
    document.documentElement.classList.toggle('locked', openSheets.length > 0);
  }
  // Zatvorenie vrchného panela (ťuknutím mimo, klávesou Esc alebo stiahnutím prstom)
  function dismissTop(v) {
    const top = openSheets[openSheets.length - 1];
    if (top === 'entry-sheet') cancelEntry(v); else if (top) closeSheet(top, v);
  }

  // ---------- Panel sa dá stiahnuť prstom ----------
  // Ide za prstom 1:1, nad horným okrajom pruží, po pustení rozhodne rýchlosť švihnutia.
  let drag = null;
  function dragBegin(target, x, y, mouse) {
    const el = target.closest && target.closest('.sheet');
    if (!el || el.id !== openSheets[openSheets.length - 1]) return;
    const head = !!target.closest('.sheet-head');
    if (mouse && !head) return;   // myšou sa ťahá len za hlavičku, inak by to rušilo označovanie textu
    drag = { el, id: el.id, x0: x, y0: y, head, mode: null, hist: [] };
  }
  function dragMove(x, y, ev) {
    if (!drag) return;
    const dx = x - drag.x0, dy = y - drag.y0;
    const atTop = drag.el.scrollTop <= 0;
    if (!drag.mode) {
      // pri vrchu panela potiahnutie nadol nemá čo posúvať, tak ho hneď zachytíme
      if (ev && ev.cancelable && dy > 0 && dy >= Math.abs(dx) && (drag.head || atTop)) ev.preventDefault();
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;   // malý pohyb ešte nie je ťahanie
      if (dy > 0 && Math.abs(dy) > Math.abs(dx) && (drag.head || atTop)) {
        const st = sheetSt(drag.id);
        cancelAnimationFrame(st.raf);   // chytený aj počas animácie: pokračuje z aktuálnej polohy
        drag.mode = 'sheet';
        drag.base = st.x;
        drag.ys = y;
        drag.H = sheetH(drag.el);
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      } else { drag = null; return; }
    }
    if (ev && ev.cancelable) ev.preventDefault();
    const st = sheetSt(drag.id);
    let ny = drag.base + (y - drag.ys);
    if (ny < 0) ny = -rubberband(-ny, drag.H);
    st.x = ny; st.v = 0; st.o = 1;
    paintSheet(drag.el, st);
    const now = performance.now();
    drag.hist.push({ y, t: now });
    while (drag.hist.length > 2 && now - drag.hist[0].t > 100) drag.hist.shift();
  }
  function dragEnd() {
    const d = drag;
    drag = null;
    if (!d || d.mode !== 'sheet') return;
    const h = d.hist, a = h[0], b = h[h.length - 1];
    const v = h.length > 1 && b.t > a.t ? (b.y - a.y) / ((b.t - a.t) / 1000) : 0;
    const st = sheetSt(d.id);
    // rozhoduje miesto, kam by panel dobehol, nie kde ho prst pustil
    if (st.x + project(v) > d.H * 0.5 && v > -200) dismissTop(v);
    else moveSheet(d.id, true, v, SPRING_BACK);
  }
  document.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1) { drag = null; return; }
    dragBegin(ev.target, ev.touches[0].clientX, ev.touches[0].clientY, false);
  }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (drag && ev.touches.length === 1) dragMove(ev.touches[0].clientX, ev.touches[0].clientY, ev);
  }, { passive: false });
  document.addEventListener('touchend', dragEnd);
  document.addEventListener('touchcancel', dragEnd);
  document.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse' && ev.button === 0) dragBegin(ev.target, ev.clientX, ev.clientY, true); });
  document.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse' && drag) dragMove(ev.clientX, ev.clientY, ev); });
  document.addEventListener('pointerup', ev => {
    if (ev.pointerType !== 'mouse' || !drag) return;
    // po ťahaní myšou nesmie klik zavrieť panel cez tlačidlo pod kurzorom
    if (drag.mode === 'sheet') {
      const swallow = e => { e.stopPropagation(); e.preventDefault(); };
      addEventListener('click', swallow, true);
      setTimeout(() => removeEventListener('click', swallow, true), 0);
    }
    dragEnd();
  });

  function render() {
    const v = currentView;
    if (v === 'today') renderToday();
    if (v === 'list') renderList();
    if (v === 'insights') renderInsights();
    if (v === 'settings') renderSettings();
    syncNavbar();
  }

  // Pri posúvaní sa veľký nadpis schová a hore ostane úzka lišta s názvom
  function syncNavbar() {
    const bar = document.getElementById('navbar');
    if (!bar) return;
    const h1 = $('.view.active .lt h1');
    bar.firstElementChild.textContent = h1 ? h1.textContent : '';
    bar.classList.toggle('show', window.scrollY > 46);
  }

  let doneTimer;
  function showDone() {
    const d = document.getElementById('done');
    d.classList.remove('show');
    void d.offsetWidth;   // znovu spustí animáciu
    d.classList.add('show');
    buzz(12);   // v tom istom okamihu ako fajka
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => d.classList.remove('show'), 800);
  }

  function switchView(v) {
    currentView = v;
    $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    $$('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    render();
    window.scrollTo(0, 0);
  }

  // Obsah dňa prichádza zo strany, kde ten deň leží v pásiku
  let dayAnimTimer;
  function goDay(d) {
    const prev = selDay;
    selDay = d;
    followToday = d === todayStr();
    if (currentView !== 'today') { switchView('today'); return; }
    renderToday();
    syncNavbar();
    if (d === prev) return;
    const v = $('#view-today');
    v.classList.remove('go-next', 'go-prev');
    void v.offsetWidth;
    v.classList.add(d > prev ? 'go-next' : 'go-prev');
    clearTimeout(dayAnimTimer);
    dayAnimTimer = setTimeout(() => v.classList.remove('go-next', 'go-prev'), 400);
  }

  // ---------- Čipy (tlačidlá na výber) ----------
  function chipGroup(field, options, opts) {
    opts = opts || {};
    const cur = opts.value !== undefined ? opts.value : draft[field];
    const kind = opts.kind || 'str';
    const multi = !!opts.multi;
    const attrs = opts.day ? ` data-day="${opts.day}"` : '';
    return `<div class="chips ${opts.cls || ''}" data-field="${field}" data-kind="${kind}"${multi ? ' data-multi="1"' : ''}${attrs}>` +
      options.map(o => {
        const v = Array.isArray(o) ? o[0] : o;
        const label = Array.isArray(o) ? o[1] : o;
        const on = multi ? (cur || []).includes(v) : cur === v;
        const extra = opts.chipCls ? ' ' + opts.chipCls(v) : '';
        return `<button type="button" class="chip${on ? ' on' : ''}${extra}" data-v="${esc(String(v))}">${esc(label)}</button>`;
      }).join('') + '</div>';
  }

  function parseChip(group, raw) {
    const k = group.dataset.kind;
    if (k === 'num') return Number(raw);
    if (k === 'bool') return raw === 'true';
    return raw;
  }

  function refreshGroup(group, cur) {
    const multi = !!group.dataset.multi;
    $$('.chip', group).forEach(c => {
      const v = parseChip(group, c.dataset.v);
      c.classList.toggle('on', multi ? (cur || []).includes(v) : cur === v);
    });
  }

  // ---------- Dnes ----------
  function needsBackup() {
    if (!entries.length) return null;
    const ref = meta.lastBackup || meta.firstUse;
    if (!ref) return null;
    const n = Math.floor((Date.now() - ref) / DAY);
    return n >= 7 ? n : null;
  }

  function bannerHtml() {
    const n = needsBackup();
    if (n == null) return '';
    const when = meta.lastBackup ? 'Posledná záloha ' + daysAgoText(n) + '.' : 'Zatiaľ si zálohu neurobila.';
    return `<div class="banner"><div><b>Čas na zálohu</b>${when}</div>
      <button type="button" class="btn small primary" data-act="backup">Zálohovať</button></div>`;
  }

  function dayRows(date, v) {
    return DAY_FIELDS.map(([f, l, list, kind]) =>
      `<div class="row"><span class="k">${l}</span>${chipGroup(f, list, { value: v[f], kind, cls: 'seg', day: date })}</div>`
    ).join('');
  }

  function noSymBtn(d) {
    if (entries.some(e => e.type === 'symptom' && dayOf(e.ts) === d)) return '';
    const on = days[d] && days[d].noSymptoms;
    const lbl = d === todayStr() ? 'Dnes bez ťažkostí' : 'Deň bez ťažkostí';
    return `<button type="button" class="btn block nosym${on ? ' on' : ''}" data-act="no-sym" data-date="${d}">${lbl}${on ? ' ✓' : ''}</button>`;
  }

  function dayText(v) {
    if (!v) return '';
    const parts = [];
    if (v.noSymptoms) parts.push('bez ťažkostí');
    if (v.sleep != null) parts.push('spánok ' + lab(SLEEP, v.sleep));
    if (v.period != null) parts.push(v.period ? 'menštruácia' : 'bez menštruácie');
    if (v.activity != null) parts.push('pohyb ' + lab(ACTIVITY, v.activity));
    if (v.water != null) parts.push('pitie ' + lab(WATER, v.water));
    return parts.join(' · ');
  }

  function dayFilled(v) { return v ? DAY_FIELDS.filter(([f]) => v[f] != null).length : 0; }

  function dayIndex() {
    const sev = {}, has = new Set();
    entries.forEach(e => {
      const d = dayOf(e.ts);
      has.add(d);
      if (e.type === 'symptom') sev[d] = Math.max(sev[d] || 0, e.severity || 1);
    });
    return { sev, has };
  }
  function dayLevel(d, ix) {
    const s = ix.sev[d];
    if (s) return s >= 7 ? 'high' : s >= 4 ? 'mid' : 'low';
    if (days[d] && days[d].noSymptoms) return 'ok';
    return ix.has.has(d) ? 'none' : 'empty';
  }
  const parseDay = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
  const WD_SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
  const MONTHS_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];

  function dayTitle(d) {
    const dt = parseDay(d);
    const date = dt.getDate() + '. ' + MONTHS_GEN[dt.getMonth()];
    const yr = dt.getFullYear() !== new Date().getFullYear() ? ' ' + dt.getFullYear() : '';
    const wd = WEEKDAYS[dt.getDay()];
    if (d === todayStr()) return ['Dnes', wd + ' ' + date];
    if (d === dayOf(Date.now() - DAY)) return ['Včera', wd + ' ' + date];
    return [wd.charAt(0).toUpperCase() + wd.slice(1), date + yr];
  }

  function stripHtml() {
    const ix = dayIndex(), today = todayStr();
    let end = parseDay(today);
    const sel = parseDay(selDay);
    if ((end - sel) / DAY > 29) end = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate() + 14);
    let h = '<div class="strip" id="strip">';
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const d = dateStr(dt.getTime());
      h += `<button type="button" class="ds d-${dayLevel(d, ix)}${d === selDay ? ' sel' : ''}${d === today ? ' today' : ''}" data-pick="${d}" aria-label="${fmtDateLong(d)}">
        <span>${WD_SHORT[dt.getDay()]}</span><b>${dt.getDate()}</b><i></i></button>`;
    }
    return h + '</div>';
  }

  function daySummary(list, d, short) {
    const n = t => list.filter(e => e.type === t).length;
    const sym = list.filter(e => e.type === 'symptom');
    const p = [];
    if (n('food')) p.push(n('food') + '× jedlo');
    if (sym.length) p.push(short ? sym.length + '× ťažkosti' : sym.length + '× ťažkosti (najviac ' + Math.max(...sym.map(e => e.severity || 1)) + '/10)');
    else if (days[d] && days[d].noSymptoms) p.push('bez ťažkostí');
    if (n('stool')) p.push(n('stool') + '× stolica');
    if (n('med')) p.push(n('med') + '× lieky');
    return p.join(', ');
  }

  // Stuha dňa: jedlá hore, ťažkosti dole, na spoločnej časovej osi
  function ribbonHtml(list, d) {
    const base = parseDay(d).getTime();
    // deň trvá do 4:00 rána nasledujúceho dátumu
    const minOf = ts => Math.max(0, Math.min(1440 + DAY_START_H * 60, (ts - base) / 60000));
    let startH = 6, endH = 24;
    list.forEach(e => { startH = Math.min(startH, Math.floor(minOf(e.ts) / 60)); endH = Math.max(endH, Math.ceil(minOf(e.ts) / 60)); });
    const span = endH * 60 - startH * 60;
    const x = m => ((m - startH * 60) / span * 100).toFixed(1);
    let marks = '<div class="rb-line"></div>';
    list.forEach(e => {
      const left = x(minOf(e.ts));
      if (e.type === 'symptom') {
        const s = e.severity || 3, size = 12 + s * 2;
        marks += `<div class="rb-s" style="left:${left}%;width:${size}px;height:${size}px;background:${sevColor(s)}"></div>`;
      } else {
        marks += `<div class="rb-m${e.type === 'food' ? '' : ' ' + e.type}" style="left:${left}%"></div>`;
      }
    });
    const isToday = d === todayStr();
    const nowM = minOf(Date.now());
    if (isToday && nowM >= startH * 60) marks += `<div class="rb-now" style="left:${x(nowM)}%"></div>`;
    const hours = [startH].concat([6, 12, 18, 24].filter(h => h > startH + 2));
    const ticks = hours.map(h => `<span style="left:${x(h * 60)}%">${h}:00</span>`).join('');
    return `<div class="card ribbon-card"><h3>${esc(daySummary(list, d, true))}</h3>
      <div class="ribbon" aria-hidden="true">${marks}</div><div class="rb-ticks" aria-hidden="true">${ticks}</div>
      ${dayIndex().has.size > 4 ? '' : `<div class="rb-legend"><span><i></i>jedlo</span><span><i class="s"></i>ťažkosti (väčší kruh = silnejšie)</span>${isToday ? '<span><i class="n"></i>teraz</span>' : ''}</div>`}${riskLineHtml(list)}</div>`;
  }

  function riskLineHtml(list) {
    const risk = riskTags();
    if (!risk.length) return '';
    const cnt = {};
    list.filter(e => e.type === 'food').forEach(e => Analysis.mealTags(e).forEach(t => { if (risk.includes(t)) cnt[t] = (cnt[t] || 0) + 1; }));
    const keys = Object.keys(cnt);
    if (!keys.length) return '';
    return `<p class="risk-line">Rizikové suroviny v tento deň: ${keys.map(t => `<b>${esc(tagLabel(t))} ${cnt[t]}×</b>`).join(', ')}</p>`;
  }

  function entryRow(e) {
    const sev = e.type === 'symptom' && e.severity ? ` <span class="sev-pill" style="background:${sevColor(e.severity)}">${e.severity}/10</span>` : '';
    return `<div role="button" tabindex="0" class="entry ${e.type}${e.id === flashId ? ' flash' : ''}" data-id="${e.id}">
      <span class="time">${fmtTime(e.ts)}</span><span class="node"></span>
      <span class="ecard"><span class="desc">${e.type === 'food' ? '' : `<span class="tico ${e.type}">${TYPES[e.type].ico}</span> `}${esc(e.desc)}${sev}</span>${metaText(e)}${
        e.type === 'symptom' ? `<button type="button" class="trace-in" data-trace="${e.id}">Čo predchádzalo? ›</button>` : ''}</span></div>`;
  }

  function dayCardHtml(d) {
    const v = days[d] || {};
    const isToday = d === todayStr();
    const ns = noSymBtn(d);
    const nsHtml = ns ? `<div style="margin-top:10px">${ns}${isToday ? '<p class="tiny" style="margin:6px 0 0;text-align:center">Ťukni večer, ak dnes nebolo nič. Spresní to vyhodnotenie.</p>' : ''}</div>` : '';
    if (dayFilled(v) === DAY_FIELDS.length && !todayExpanded) {
      return `<div class="card"><div class="today-summary"><span class="txt">${esc(dayText(v))}</span>
        <button type="button" class="btn ghost small" data-act="today-edit">Upraviť</button></div>${nsHtml}</div>`;
    }
    return `<div class="card today"><h3>${isToday ? 'Aký bol dnešný deň?' : 'Aký bol tento deň?'}</h3>
      <p class="tiny" style="margin:-4px 0 12px">Stačí raz za deň, nepovinné.</p>
      ${dayRows(d, v)}
      ${todayExpanded ? '<div class="sheet-actions" style="text-align:right"><button type="button" class="btn small" data-act="today-done">Hotovo</button></div>' : ''}
      ${nsHtml}
    </div>`;
  }

  function renderToday() {
    const el = $('#view-today');
    const d = selDay, isToday = d === todayStr();
    const list = entries.filter(e => dayOf(e.ts) === d).sort((a, b) => a.ts - b.ts);
    const [title, sub] = dayTitle(d);
    let h = `<header class="lt"><div><h1>${title}</h1><p>${sub}</p></div><button type="button" class="help-q" data-act="help" data-sec="today" aria-label="Pomocník">?</button>
      ${isToday ? '' : '<button type="button" class="btn small" data-act="go-today">Späť na dnes</button>'}</header>`;
    h += stripHtml();
    if (isToday) h += nudgeHtml(d, list) + bannerHtml() + testBannerHtml() + reintroBannerHtml() + weekHtml();
    if (list.length) {
      h += ribbonHtml(list, d);
      h += '<div class="tl">' + list.map(entryRow).join('') + '</div>';
    } else {
      h += `<div class="card empty"><div class="big"></div>
        <p><b>${isToday ? 'Dnes zatiaľ nič zapísané' : 'V tento deň nie je nič zapísané'}</b><br>Ťukni dole na ＋ a zapíš jedlo alebo ťažkosti.</p></div>`;
    }
    h += quickToolsHtml(d, list);
    h += dayCardHtml(d);
    el.innerHTML = h;
    flashId = null;
    const strip = $('#strip'), cur = strip && $('.ds.sel', strip);
    if (cur) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2;
  }

  // minúty od polnoci; rozdiel dvoch časov dňa (cez polnoc tiež)
  const minOfDay = ts => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
  const clockGap = (a, b) => { const x = Math.abs(minOfDay(a) - minOfDay(b)); return Math.min(x, 1440 - x); };

  // Návrhy: čo sa jedáva často, nedávno a hlavne v túto dennú dobu (ráno raňajky, na obed obed)
  // ---------- Rýchly zápis na obrazovke Dnes ----------
  const recurring = () => meta.recurring || [];
  const recKey = (type, desc) => type + ':' + String(desc || '').trim().toLowerCase();
  const isRecurring = (type, desc) => recurring().some(r => recKey(r.type, r.desc) === recKey(type, desc));
  // čas v danom dni (h = hodina s desatinami)
  const atHour = (d, h) => parseDay(d).getTime() + h * 3600e3;
  const MEAL_SLOTS = [['raňajky', 4, 10.5, 7.5], ['obed', 10.5, 15.5, 12.5], ['večera', 16.5, 22, 18.5]];

  // Čo chýba: hneď po otvorení navrchu obrazovky Dnes
  function missingMeals(d, list) {
    const food = list.filter(e => e.type === 'food');
    const nowH = d === todayStr() ? (Date.now() - parseDay(d).getTime()) / 3600e3 : 99;
    return MEAL_SLOTS.filter(([, a, b]) => nowH >= b && !food.some(e => {
      const x = (e.ts - parseDay(d).getTime()) / 3600e3;
      return x >= a && x < b;
    }));
  }
  function nudgeHtml(d, list) {
    let h = '';
    // dnes: chýba jedlo, ktorého čas už prešiel (len ak sa dnes už niečo zapisovalo alebo je po 10:00)
    const nowH = (Date.now() - parseDay(d).getTime()) / 3600e3;
    // nový používateľ bez záznamov za posledné dni sa nemá cítiť napomínaný
    if (list.length || (nowH >= 10 && entries.some(e => e.ts > Date.now() - 3 * DAY))) {
      const miss = missingMeals(d, list);
      if (miss.length) {
        const names = miss.map(m => m[0]);
        h += `<div class="banner nudge"><div><b>Nezapísala si ${names.length > 1 ? names.slice(0, -1).join(', ') + ' a ' + names[names.length - 1] : names[0]}</b>Ak si jedla, zapíš to teraz. Ak nie, nič nerob.</div>
          <div class="nudge-btns">${miss.map(([n, , , at]) => `<button type="button" class="btn small primary" data-act="add-at" data-h="${at}">＋ ${n}</button>`).join('')}</div></div>`;
      }
    }
    // včera: niečo zapísané, ale nevieme, či boli ťažkosti
    const y = dayOf(Date.now() - DAY);
    const yList = entries.filter(e => dayOf(e.ts) === y);
    if (yList.some(e => e.type === 'food') && !yList.some(e => e.type === 'symptom') && !(days[y] && days[y].noSymptoms)) {
      h += `<div class="banner nudge"><div><b>Včera bez ťažkostí?</b>Včera nie sú zapísané ťažkosti ani „Deň bez ťažkostí“.</div>
        <div class="nudge-btns"><button type="button" class="btn small primary" data-act="no-sym" data-date="${y}">Áno, bez ťažkostí</button>
        <button type="button" class="btn small" data-act="sym-at" data-date="${y}">Zapísať ťažkosti</button></div></div>`;
    }
    return h;
  }

  function quickToolsHtml(d, list) {
    const isToday = d === todayStr();
    const now = Date.now();
    let h = '';
    // pravidelné záznamy, ktoré dnes ešte nie sú zapísané a ich čas sa blíži alebo prešiel
    if (isToday) {
      const todayKeys = new Set(list.map(e => recKey(e.type, e.desc)));
      const due = recurring().filter(r => !todayKeys.has(recKey(r.type, r.desc)) && now >= atHour(d, r.h + r.m / 60) - 30 * 60e3);
      if (due.length) {
        h += `<div class="card quick"><h3>Pravidelné</h3><div class="chips">` + due.map(r =>
          `<button type="button" class="chip rec" data-act="rec-log" data-id="${r.id}"><span class="tico ${r.type}">${TYPES[r.type].ico}</span> ${esc(r.desc)} <span class="tiny">${pad(r.h)}:${pad(r.m)}</span></button>`).join('') +
          '</div><p class="tiny" style="margin:8px 0 0">Ťuknutím zapíšeš.</p></div>';
      }
    }
    // zabudnuté jedlo v minulých dňoch (dnešok je navrchu obrazovky)
    const food = list.filter(e => e.type === 'food');
    if (!isToday && food.length) {
      const nowH = isToday ? (now - parseDay(d).getTime()) / 3600e3 : 99;
      const miss = MEAL_SLOTS.filter(([, a, b]) => nowH >= b && !food.some(e => {
        const x = (e.ts - parseDay(d).getTime()) / 3600e3;
        return x >= a && x < b;
      }));
      if (miss.length && miss.length < 3) {
        h += `<div class="card quick miss"><span>${miss.length === 1 ? 'Chýba ' + miss[0][0] + '?' : 'Chýbajú ' + miss.map(m => m[0]).join(' a ') + '?'}</span><div class="chips">` +
          miss.map(([n, , , at]) => `<button type="button" class="chip" data-act="add-at" data-h="${at}">＋ ${n}</button>`).join('') + '</div></div>';
      }
    }
    // rýchly zápis ťažkostí jedným ťuknutím
    if (isToday) {
      h += `<div class="card quick"><h3>Máš teraz ťažkosti?</h3><div class="chips sevrow">` +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" class="chip sev-${n}" data-act="quick-sym" data-v="${n}" style="--sc:${sevColor(n)}">${n}</button>`).join('') +
        '</div><div class="scale-ends"><span>slabé</span><span>neznesiteľné</span></div></div>';
    }
    return h;
  }

  function quickFor(type) {
    const m = new Map();
    const now = Date.now();
    const at = draft && draft.ts ? draft.ts : now;
    for (const e of entries) {
      if (e.type !== type || !e.desc) continue;
      const text = e.desc.trim();
      const k = text.toLowerCase();
      const r = m.get(k) || { text, n: 0, last: 0, near: 0 };
      r.n++;
      if (clockGap(e.ts, at) <= 120) r.near++;
      r.last = Math.max(r.last, e.ts);
      m.set(k, r);
    }
    const list = [...m.values()]
      .map(r => ({ ...r, score: r.n + r.near * 2 + (now - r.last < 3 * DAY ? 2 : 0) }))
      .sort((a, b) => b.score - a.score || b.last - a.last)
      .map(r => r.text);
    if (type === 'med') MED_DEFAULTS.forEach(d => { if (!list.some(x => x.toLowerCase() === d.toLowerCase())) list.push(d); });
    return list.slice(0, 12);
  }

  function field(label, inner, opt) {
    return `<div class="field"><span class="label">${label}${opt ? ' <span class="opt">(nepovinné)</span>' : ''}</span>${inner}</div>`;
  }

  const grp = (title, inner, extra) => `<section class="grp"${extra || ''}>${title ? `<h4>${title}</h4>` : ''}${inner}</section>`;
  const sw = (id, label, on) => `<label class="sw"><span>${label}</span><input type="checkbox" id="${id}"${on ? ' checked' : ''}></label>`;

  function descField(placeholder) {
    const isFood = draft.type === 'food';
    const favs = isFood ? favorites() : [];
    const favSet = new Set(favs.map(f => f.desc.toLowerCase()));
    const q = quickFor(draft.type).filter(t => !favSet.has(t.toLowerCase()));
    const chipsHtml = favs.map((f, i) => `<button type="button" class="chip fav" data-fav="${i}">★ ${esc(f.desc)}</button>`).join('') +
      q.map(t => `<button type="button" class="chip" data-q="${esc(t)}">${esc(t)}</button>`).join('');
    const n = favs.length + q.length;
    // „Ako včera“: čo bolo zapísané včera v podobnom čase (±2,5 h)
    const yd = dayOf(draft.ts - DAY);
    const yest = editingId ? null : entries.filter(e => e.type === draft.type && e.desc && dayOf(e.ts) === yd && clockGap(e.ts, draft.ts) <= 150)
      .sort((a, b) => clockGap(a.ts, draft.ts) - clockGap(b.ts, draft.ts))[0];
    const again = yest && !draft.desc ? `<button type="button" class="chip again" data-q="${esc(yest.desc.trim())}"><span class="tiny">Ako včera</span> ${esc(yest.desc.trim())}</button>` : '';
    const quick = (again ? `<div class="again-row">${again}</div>` : '') + (chipsHtml ? `<details class="quick-dd"${draft.quickOpen ? ' open' : ''}><summary>Naposledy ${isFood ? 'jedené' : 'zapísané'} <span>${n}</span></summary>
      <div class="chips quick">${chipsHtml}</div><p class="tiny" style="margin:8px 0 0">Ťukni na viac položiek, pridajú sa za seba. Opätovným ťuknutím položku odoberieš.</p></details>` : '');
    const star = isFood ? `<button type="button" class="star${isFav(draft.desc) ? ' on' : ''}" id="fav-btn" data-act="fav" aria-label="Uložiť medzi obľúbené">${favBtnText()}</button>` : '';
    return grp('', `<div class="desc-row"><textarea id="f-desc" class="big" rows="1" placeholder="${esc(placeholder)}" enterkeyhint="done">${esc(draft.desc)}</textarea>${isFood ? `<span class="desc-btns">${star}<button type="button" class="star" data-act="scan" aria-label="Skenovať čiarový kód">${ic('scan')}</button></span>` : ''}</div>${quick}`);
  }

  // ---------- Skenovanie balených výrobkov ----------
  const products = () => meta.products || {};

  function productHtml() {
    const p = draft.product;
    if (!p) return '';
    const al = (p.allergens || []).concat((p.traces || []).map(x => 'stopy: ' + x));
    return `<section class="grp prod"><div class="prod-top"><span class="tbadge food">${ic('scan')}</span>
        <span><b>${esc(p.name || 'Naskenovaný výrobok')}</b><small>${esc([p.brand, p.quantity, p.code].filter(Boolean).join(' · '))}</small></span>
        <button type="button" class="x" data-act="prod-clear" aria-label="Odpojiť výrobok">✕</button></div>
      ${al.length ? '<span class="pills">' + al.map(x => `<span class="pill">${esc(x)}</span>`).join('') + '</span>' : ''}
      ${p.ingredients ? `<details class="more" style="margin:8px 0 0"><summary>Zloženie z obalu</summary><p class="small muted" style="margin:0">${esc(p.ingredients)}</p></details>`
        : '<p class="tiny" style="margin:8px 0 0">Zloženie v databáze nie je. Skupiny v časti Obsahovalo doplň ručne.</p>'}</section>`;
  }

  function scanBody(msg, retry) {
    return `<div class="sheet-head"><h2>Skenovať výrobok</h2><button type="button" class="x" data-act="scan-close" aria-label="Zavrieť">✕</button></div>
      <div class="scanbox" id="scan-box"></div>
      <p class="small" id="scan-msg" style="text-align:center;margin:10px 0 14px">${msg}</p>
      ${retry ? '<button type="button" class="btn block" data-act="scan-retry" style="margin-bottom:12px">Skenovať znova</button>' : ''}` +
      grp('Nejde to?', `<div class="desc-row"><input type="text" id="scan-code" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="číslo pod čiarovým kódom">
          <button type="button" class="btn small primary" data-act="scan-manual">Hľadať</button></div>
        <label class="btn small" style="margin-top:10px">Odfotiť kód<input type="file" id="scan-photo" accept="image/*" capture="environment" hidden></label>`);
  }

  function scanStart() {
    if (!window.Scan) { $('#scan-msg').textContent = 'Skener sa nenačítal. Zadaj číslo ručne.'; return; }
    Scan.start($('#scan-box'), {
      onCode: handleCode,
      onError: m => { const el = $('#scan-msg'); if (el) el.textContent = m; },
    });
  }

  function openScan() {
    $('#scan-sheet').innerHTML = scanBody('Namier kameru na čiarový kód a chvíľu ju drž pokojne.');
    openSheet('scan-sheet');
    scanStart();
  }

  function scanFail(msg) {
    if (!openSheets.includes('scan-sheet')) return;
    $('#scan-sheet').innerHTML = scanBody(esc(msg), true);
  }

  async function handleCode(code) {
    const msg = $('#scan-msg');
    if (msg) msg.textContent = 'Hľadám výrobok ' + code + '…';
    const known = products()[code];
    if (known) { applyProduct(known, true); return; }
    const r = window.Scan ? await Scan.lookup(code) : { status: 'error', reason: 'network' };
    if (!openSheets.includes('scan-sheet')) return;   // medzitým zavreté
    if (r.status === 'found') { applyProduct(r.product, false); return; }
    if (r.status === 'notfound') {
      draft.product = { code };
      if (!draft.place) draft.place = 'kupovane';
      closeSheet('scan-sheet');
      renderForm();
      toast('Výrobok v databáze nie je. Napíš názov, nabudúce ho už spoznám.');
      const inp = $('#f-desc');
      if (inp) inp.focus();
      return;
    }
    scanFail(r.reason === 'offline' ? 'Si bez internetu a tento výrobok ešte nepoznám. Zapíš ho ručne.'
      : r.reason === 'timeout' ? 'Databáza neodpovedá. Skús to o chvíľu znova.'
        : 'Výrobok sa nepodarilo vyhľadať. Skús to znova.');
  }

  function applyProduct(p, fromCache) {
    const name = (p.desc || [p.brand, p.name].filter((x, i, a) => x && !(i === 0 && a[1] && a[1].toLowerCase().includes(x.toLowerCase()))).join(' ')).trim();
    if (name) draft.desc = name;
    const tags = new Set(draft.tags);
    (p.tags || []).forEach(t => { if (TAGS.some(x => x[0] === t)) tags.add(t); });
    draft.tags = [...tags];
    draft.noTags = draft.noTags.filter(t => !tags.has(t));
    draft.product = { code: p.code, name: p.name || '', brand: p.brand || '', quantity: p.quantity || '',
      ingredients: p.ingredients || '', allergens: p.allergens || [], traces: p.traces || [] };
    if (!draft.place) draft.place = 'kupovane';
    closeSheet('scan-sheet');
    renderForm();
    toast(fromCache ? 'Známy výrobok, vyplnené' : 'Výrobok nájdený, vyplnené');
  }

  // Po uložení si výrobok zapamätáme aj s názvom a skupinami, ako ich používateľka nechala
  async function rememberProduct(e) {
    const p = e.product;
    if (!p || !p.code) return;
    const all = Object.assign({}, products());
    all[p.code] = Object.assign({}, p, { desc: e.desc, tags: e.tags || [] });
    await setMeta('products', all);
  }

  function isFav(desc) { const d = desc.trim().toLowerCase(); return !!d && favorites().some(f => f.desc.toLowerCase() === d); }
  function favBtnText() { return isFav(draft.desc) ? '★' : '☆'; }

  // Ukáže len rozpoznané, zvolené a rizikové skupiny; ostatné po ťuknutí na „ďalšie“
  function tagChips() {
    const eff = effectiveTags(), auto = autoTags(), risk = riskTags();
    const shown = TAGS.filter(([v]) => draft.tagsAll || eff.includes(v) || risk.includes(v));
    return '<div class="chips" id="tag-chips">' + shown.map(([v, e, tt]) => {
      const on = eff.includes(v);
      const isAuto = on && auto.includes(v) && !draft.tags.includes(v);
      return `<button type="button" class="chip${on ? ' on' : ''}${risk.includes(v) ? ' risk' : ''}" data-tag="${v}">${esc(tt)}${isAuto ? ' ✦' : ''}</button>`;
    }).join('') + (draft.tagsAll ? '' : '<button type="button" class="chip add" data-act="tags-all">＋ ďalšie</button>') + '</div>';
  }

  function riskWarnHtml() {
    const eff = effectiveTags();
    const r = eff.filter(t => riskTags().includes(t));
    let h = r.length ? `<div class="risk-warn">${ic('warn')} Pozor, pravdepodobne obsahuje: <b>${r.map(t => esc(tagLabel(t))).join(', ')}</b></div>` : '';
    const ts = meta.test;
    if (ts && ts.tag && eff.includes(ts.tag)) h += `<div class="risk-warn">Toto máš počas testu vynechať: <b>${esc(ts.what)}</b></div>`;
    return h;
  }

  // ak je popis jedno z Mojich jedál, ukáže jeho suroviny
  function recipeHint() {
    const r = Analysis.recipeOf(draft.desc);
    return r.length ? 'Z Mojich jedál: <b>' + esc(r.map(x => x.ing).join(', ')) + '</b>' : '';
  }

  function refreshFoodExtras() {
    if (draft.type !== 'food') return;
    const tc = $('#tag-chips');
    if (tc) tc.outerHTML = tagChips();
    const rw = $('#risk-warn');
    if (rw) rw.innerHTML = riskWarnHtml();
    const rh = $('#rc-hint');
    if (rh) rh.innerHTML = recipeHint();
    const fb = $('#fav-btn');
    if (fb) { fb.textContent = favBtnText(); fb.classList.toggle('on', isFav(draft.desc)); }
  }

  async function toggleFav() {
    const d = draft.desc.trim();
    if (!d) { toast('Najprv napíš, čo to bolo'); return; }
    let list = favorites().slice();
    if (isFav(d)) {
      list = list.filter(f => f.desc.toLowerCase() !== d.toLowerCase());
      toast('Odobraté z obľúbených');
    } else {
      list.unshift({ desc: d, tags: draft.tags.slice(), noTags: draft.noTags.slice(), place: draft.place, portion: draft.portion });
      toast('Uložené medzi obľúbené ');
    }
    await setMeta('favorites', list.slice(0, 20));
    refreshFoodExtras();
  }

  // Pri rýchlom výbere prenesie aj skupiny a miesto z predchádzajúceho záznamu
  function applyQuick(desc, src) {
    const cur = draft.desc.trim();
    const append = draft.type === 'food' && cur && !cur.toLowerCase().includes(desc.toLowerCase());
    draft.desc = append ? cur + ', ' + desc : desc;
    if (draft.type === 'food' && src) {
      const tags = new Set(append ? draft.tags : []);
      (src.tags || []).forEach(t => tags.add(t));
      draft.tags = [...tags];
      draft.noTags = append ? draft.noTags.concat(src.noTags || []) : (src.noTags || []).slice();
      if (src.place && (!append || !draft.place)) { draft.place = src.place; const g = $('.chips[data-field="place"]'); if (g) refreshGroup(g, draft.place); const dt = $('#ctx-more'); if (dt) dt.open = true; }
      if (src.product && !append) draft.product = src.product;
      if (src.portion && !append) { draft.portion = src.portion; const g = $('.chips[data-field="portion"]'); if (g) refreshGroup(g, draft.portion); }
    }
    const inp = $('#f-desc');
    if (inp) { inp.value = draft.desc; inp.classList.remove('invalid'); growDesc(); }
    refreshFoodExtras();
  }

  function timeField() {
    if (!draft.tsTouched && !editingId) draft.ts = Date.now();
    const custom = !!(editingId || draft.tsCustom);
    const chip = (m, l) => `<button type="button" class="chip${!custom && draft.tsOff === m ? ' on' : ''}" data-time="${m}">${l}</button>`;
    return grp('Kedy?', `<div class="time-row">${chip(0, 'teraz')}${chip(30, '−30 min')}${chip(60, '−1 h')}${chip(120, '−2 h')}</div>
      <div class="dt-row">
        <label>Iný dátum<input type="date" id="f-date" value="${dateStr(draft.ts)}" max="${dateStr(Date.now())}"></label>
        <label>Iný čas<input type="time" id="f-time" value="${fmtTime(draft.ts)}"></label>
      </div>`);
  }

  // Pole s názvom jedla rastie podľa dĺžky textu
  // Rýchle voľby, ktoré už sú v popise, sú označené
  function descParts() { return draft.desc.split(/\s*,\s*/).map(x => x.trim().toLowerCase()).filter(Boolean); }
  function markQuick() {
    const parts = descParts();
    $$('.chips.quick .chip[data-q]').forEach(c => c.classList.toggle('on', parts.includes(c.dataset.q.toLowerCase())));
    $$('.chips.quick .chip[data-fav]').forEach(c => {
      const f = favorites()[Number(c.dataset.fav)];
      c.classList.toggle('on', !!f && parts.includes(f.desc.trim().toLowerCase()));
    });
  }
  // Ak je položka už v popise, odoberie ju a vráti true
  function quickOff(val) {
    const parts = draft.desc.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
    const i = parts.findIndex(x => x.toLowerCase() === val.trim().toLowerCase());
    if (i < 0) return false;
    parts.splice(i, 1);
    draft.desc = parts.join(', ');
    const inp = $('#f-desc');
    if (inp) inp.value = draft.desc;
    growDesc();
    refreshFoodExtras();
    return true;
  }

  function growDesc() {
    markQuick();
    const t = document.getElementById('f-desc');
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }

  function setTimeInputs() {
    const d = $('#f-date'), t = $('#f-time');
    if (d) d.value = dateStr(draft.ts);
    if (t) t.value = fmtTime(draft.ts);
  }

  function moreBlock() {
    const open = draft.stress != null || draft.mood != null || draft.note;
    return `<details class="grp more"${open ? ' open' : ''}><summary>Stres, nálada, poznámka</summary>` +
      field('Stres teraz', chipGroup('stress', [1, 2, 3, 4, 5].map(n => [n, String(n)]), { kind: 'num', cls: 'scale s5' }) +
        '<div class="scale-ends"><span>pokoj</span><span>veľký stres</span></div>') +
      field('Nálada', chipGroup('mood', MOODS, { kind: 'num', cls: 'scale s5 emoji' })) +
      `<div class="field" style="margin:0"><span class="label">Poznámka</span><textarea id="f-note" placeholder="napr. jedla som neskoro, cestovanie…">${esc(draft.note)}</textarea></div>` +
      '</details>';
  }

  const sevWord = n => n == null ? 'Ťukni na číslo: 1 je slabé, 10 neznesiteľné' : n + ' – ' + (n <= 3 ? 'slabé' : n <= 6 ? 'stredné' : n <= 8 ? 'silné' : 'neznesiteľné');

  // Úvodný krok: jedným ťuknutím zopakovať obľúbené alebo časté jedlo
  function againHtml() {
    const favs = favorites();
    const favSet = new Set(favs.map(f => f.desc.toLowerCase()));
    const q = quickFor('food').filter(t => !favSet.has(t.toLowerCase())).slice(0, 8);
    if (!favs.length && !q.length) return '';
    return `<h4 class="again-h">Zapísať znova</h4><div class="chips quick">` +
      favs.map((f, i) => `<button type="button" class="chip fav" data-af="${i}">★ ${esc(f.desc)}</button>`).join('') +
      q.map(t => `<button type="button" class="chip" data-aq="${esc(t)}">${esc(t)}</button>`).join('') + '</div>';
  }

  function renderForm() {
    const f = $('#entry-form');
    const t = draft.type;
    $('#entry-sheet').classList.toggle('tall', !!t);
    const close = '<button type="button" class="x" data-act="cancel-edit" aria-label="Zavrieť">✕</button>';

    if (!t) {
      const ns = currentView === 'today' && selDay === todayStr() ? noSymBtn(todayStr()) : '';
      f.innerHTML = `<div class="sheet-head"><h2>Čo chceš zapísať?</h2>${close}</div>
        <div class="acts">` + Object.entries(TYPES).map(([k, v]) =>
          `<button type="button" class="type-btn act" data-type="${k}"><span class="ico">${v.ico}</span><span>${v.short}</span></button>`).join('') + `</div>
        ${againHtml()}${ns ? `<div class="sheet-actions">${ns}</div>` : ''}`;
      return;
    }

    // nový záznam: typ sa prepína priamo hore, bez samostatného kroku výberu
    let h = editingId
      ? `<div class="sheet-head"><span class="tbadge ${t}">${TYPES[t].ico}</span><h2>Upraviť záznam</h2>${close}</div>`
      : `<div class="sheet-head"><h2>Nový záznam</h2>${close}</div>
        <div class="segbar typeseg" role="tablist" aria-label="Typ záznamu">` + Object.entries(TYPES).map(([k, v]) =>
          `<button type="button" role="tab" aria-selected="${k === t}" class="type-btn tseg ${k}${k === t ? ' on' : ''}" data-type="${k}">${v.ico}<span>${v.short}</span></button>`).join('') + '</div>';

    if (t === 'food') {
      h += descField('Čo si jedla alebo pila?');
      h += productHtml();
      h += `<div id="risk-warn">${riskWarnHtml()}</div>`;
      h += timeField();
      h += grp('Koľko?', chipGroup('portion', PORTION, { cls: 'seg' }) +
        `<input type="text" id="f-amount" style="margin-top:10px" value="${esc(draft.amount)}" placeholder="presnejšie, napr. pol balenia, 5 ks" enterkeyhint="done">` +
        (draft.product && draft.product.quantity ? `<p class="tiny" style="margin:6px 0 0">Celé balenie: ${esc(draft.product.quantity)}</p>` : ''));
      h += grp('Obsahovalo', tagChips() + `<p class="tiny" id="rc-hint" style="margin:8px 0 0">${recipeHint()}</p>` +
        '<p class="tiny" style="margin:8px 0 0">✦ = rozpoznané z popisu. Ťuknutím zrušíš alebo pridáš.</p>');
      h += grp('', sw('f-enzyme', 'Užila som laktázu / enzým', draft.enzyme) + sw('f-rushed', 'Jedla som v zhone', draft.rushed));
      h += grp('Odkiaľ je jedlo?', chipGroup('place', PLACES, { cls: 'col' }) +
        '<p class="tiny" style="margin:8px 0 0">Kto jedlo pripravil. Ukáže, či vadí skôr jedlo, ktoré nie je z domu.</p>');
    } else if (t === 'symptom') {
      h += grp('Aké ťažkosti?', chipGroup('kinds', KINDS, { multi: true }));
      h += grp('Aké silné?', chipGroup('severity', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]),
        { kind: 'num', cls: 'sevrow', chipCls: v => 'sev-' + v }) + `<div class="sev-word" id="sev-word">${sevWord(draft.severity)}</div>`);
      h += timeField();
      h += grp('Kde to bolí?', chipGroup('location', LOCATION, {}));
      h += grp('Ako dlho to trvalo?', chipGroup('duration', DURATIONS, {}) +
        `<input type="text" id="f-duration" style="margin-top:10px" value="${esc(draft.duration)}" placeholder="alebo napíš, napr. 40 min" enterkeyhint="done">`);
      h += descField('Popis vlastnými slovami (nepovinné)');
    } else if (t === 'stool') {
      h += grp('Aká bola?', chipGroup('stool', BRISTOL, { cls: 'col' }) +
        '<p class="tiny" style="margin:8px 0 0">Bristolská škála, ktorú používajú lekári: 1–2 zápcha, 3–4 v poriadku, 5–7 riedka.</p>');
      h += timeField();
      h += descField('Popis (nepovinné), napr. s hlienom');
    } else if (t === 'med') {
      h += descField('Aký liek alebo čo iné?');
      h += timeField();
    }
    if (t === 'food' || t === 'med') h += grp('', sw('f-rec', 'Opakovať každý deň o ' + fmtTime(draft.ts), draft.rec) +
      '<p class="tiny" style="margin:6px 0 0">Na obrazovke Dnes sa potom ukáže na zápis jedným ťuknutím.</p>');
    h += moreBlock();

    // pri úprave jedla či lieku: jedným ťuknutím zapísať to isté znova, teraz
    if (editingId && (t === 'food' || t === 'med')) {
      h += `<button type="button" class="btn block again-now" data-act="dup-now">${ic('open')} Zapísať znova teraz</button>`;
    }
    h += `<div class="savebar">
      ${editingId ? '<button type="button" class="btn danger" data-act="delete">Zmazať</button>' : ''}
      <button type="submit" class="btn primary">${editingId ? 'Uložiť zmeny' : 'Uložiť'}</button>
    </div>`;
    f.innerHTML = h;
    growDesc();
  }

  function validate() {
    const d = draft;
    const desc = d.desc.trim();
    if (d.type === 'food' || d.type === 'med') {
      if (!desc) return ['f-desc', 'Napíš, čo to bolo'];
    } else if (d.type === 'symptom') {
      if (!desc && !d.kinds.length) return [null, 'Vyber aspoň druh ťažkostí'];
    } else if (d.type === 'stool') {
      if (!desc && !d.stool) return [null, 'Vyber typ stolice'];
    }
    if (!d.ts || isNaN(d.ts)) return ['f-time', 'Skontroluj dátum a čas'];
    return null;
  }

  async function saveDraft() {
    const err = validate();
    if (err) {
      if (err[0]) { const el = document.getElementById(err[0]); if (el) { el.classList.add('invalid'); el.focus(); } }
      toast(err[1]);
      return;
    }
    const d = draft;
    const type = d.type;
    let desc = d.desc.trim();
    if (!desc && type === 'symptom') desc = d.kinds.join(', ');
    if (!desc && type === 'stool') desc = lab(STOOL, d.stool);
    const ts = (d.tsTouched || editingId) ? d.ts : Date.now();
    const old = editingId ? entries.find(e => e.id === editingId) : null;
    const e = {
      id: editingId || uid(), type, ts, desc,
      stress: d.stress, mood: d.mood, note: d.note.trim(),
      created: old ? old.created : Date.now(), updated: Date.now(),
    };
    if (type === 'food') Object.assign(e, {
      portion: d.portion, rushed: !!d.rushed, tags: effectiveTags(), noTags: d.noTags.slice(),
      amount: (d.amount || '').trim(), product: d.product || null,
      place: d.place, enzyme: !!d.enzyme,
    });
    if (type === 'symptom') Object.assign(e, { severity: d.severity, duration: d.duration.trim(), kinds: d.kinds.slice(), location: d.location });
    if (type === 'stool') Object.assign(e, { stool: d.stool });

    try {
      await DB.put('entries', e);
    } catch (ex) {
      toast('Nepodarilo sa uložiť ');
      console.error(ex);
      return;
    }
    if (old) entries[entries.indexOf(old)] = e; else entries.push(e);
    if (!meta.firstUse) await setMeta('firstUse', Date.now());
    if (type === 'food') await rememberProduct(e);
    // pravidelný záznam: pridať, posunúť čas alebo (pri úprave) zrušiť
    if (type === 'food' || type === 'med') {
      const key = recKey(type, desc), dt = new Date(e.ts);
      const rest = recurring().filter(r => recKey(r.type, r.desc) !== key);
      if (d.rec) await setMeta('recurring', rest.concat([{ id: uid(), type, desc, h: dt.getHours(), m: dt.getMinutes(), portion: e.portion || null, tags: e.tags || [], noTags: e.noTags || [] }]));
      else if (editingId && rest.length !== recurring().length) await setMeta('recurring', rest);
    }
    // ťažkosti v deň označený „bez ťažkostí“ → zrušiť označenie
    const dd = days[dayOf(e.ts)];
    if (type === 'symptom' && dd && dd.noSymptoms) { delete dd.noSymptoms; await DB.put('days', dd); }

    const wasEditing = !!editingId;
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet');
    flashId = e.id;
    showDone();
    if (currentView === 'today') { selDay = dayOf(e.ts); followToday = selDay === todayStr(); }
    render();
    const fresh = $('.entry.flash');
    if (fresh) fresh.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function openEntry() {
    editingId = null;
    draft = newDraft('food');   // najčastejší zápis je jedlo, otvorí sa rovno
    if (currentView === 'today' && selDay !== todayStr()) {
      draft.ts = parseDay(selDay).getTime() + 12 * 3600e3;
      draft.tsTouched = true;
      draft.tsCustom = true;
    }
    renderForm();
    openSheet('entry-sheet');
    // kurzor rovno do poľa (musí byť ešte v rámci ťuknutia, inak iPhone neukáže klávesnicu)
    const d = $('#f-desc');
    if (d) d.focus({ preventScroll: true });
  }

  function draftDirty() {
    const d = draft;
    return !!(d.desc.trim() || d.kinds.length || d.severity != null || d.stool || d.note.trim());
  }

  // Rozpracovaný záznam sa zahodí hneď, ale dá sa vrátiť tlačidlom Späť
  function cancelEntry(v) {
    const lost = !editingId && draftDirty() ? draft : null;
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet', v);
    if (lost) toast('Rozpracovaný záznam zahodený', { run: () => {
      editingId = null;
      draft = lost;
      renderForm();
      openSheet('entry-sheet');
    } });
  }

  function startEdit(id) {
    const e = entries.find(x => x.id === id);
    if (!e) return;
    editingId = id;
    draft = Object.assign(newDraft(e.type), JSON.parse(JSON.stringify(e)), { tsTouched: true });
    draft.desc = draft.desc || '';
    draft.note = draft.note || '';
    draft.duration = draft.duration || '';
    draft.tags = draft.tags || [];
    draft.noTags = draft.noTags || [];
    draft.kinds = draft.kinds || [];
    draft.enzyme = !!draft.enzyme;
    draft.amount = draft.amount || '';
    draft.product = draft.product || null;
    draft.rec = isRecurring(e.type, e.desc);
    renderForm();
    openSheet('entry-sheet');
  }

  async function deleteCurrent() {
    if (!editingId) return;
    const old = entries.find(e => e.id === editingId);
    await DB.del('entries', editingId);
    entries = entries.filter(e => e.id !== editingId);
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet');
    buzz();
    render();
    if (old) toast('Záznam zmazaný', { run: async () => {
      await DB.put('entries', old);
      if (!entries.some(e => e.id === old.id)) entries.push(old);
      flashId = old.id;
      render();
    } });
  }

  async function setDayField(date, f, value) {
    const v = days[date] || { date };
    if (v[f] === value) delete v[f]; else v[f] = value;
    days[date] = v;
    await DB.put('days', v);
    if (!meta.firstUse) await setMeta('firstUse', Date.now());
    return v[f];
  }

  // ---------- Prehľad ----------
  function sevColor(s) { return s >= 7 ? '#d4483a' : s >= 4 ? '#e0a030' : '#5fa873'; }

  // Podrobnosti záznamu ako malé štítky; rizikové suroviny červenou
  function metaText(e) {
    const p = [];
    if (e.type === 'food') {
      if (e.place && e.place !== 'doma') p.push([lab(PLACES, e.place)]);
      if (e.portion && e.portion !== 'normalna') p.push([lab(PORTION, e.portion) + ' porcia']);
      const risk = riskTags();
      Analysis.mealTags(e).forEach(t => { const x = TAGS.find(y => y[0] === t); if (x) p.push([x[2], risk.includes(t) ? 'risk' : '']); });
      if (e.enzyme) p.push(['enzým']);
      if (e.amount) p.push([e.amount]);
      if (e.rushed) p.push(['v zhone']);
    }
    if (e.type === 'symptom') {
      if (e.kinds && e.kinds.length && e.desc !== e.kinds.join(', ')) e.kinds.forEach(k => p.push([k]));
      if (e.location) p.push([lab(LOCATION, e.location)]);
      if (e.duration) p.push([e.duration]);
    }
    if (e.type === 'stool' && e.stool && e.desc !== lab(STOOL, e.stool)) p.push([lab(STOOL, e.stool)]);
    if (e.stress != null) p.push(['stres ' + e.stress]);
    if (e.mood != null) p.push(['nálada ' + MOODS.find(m => m[0] === e.mood)[1]]);
    let h = p.length ? '<span class="pills">' + p.map(([t, c]) => `<span class="pill${c ? ' ' + c : ''}">${esc(t)}</span>`).join('') + '</span>' : '';
    if (e.note) h += `<span class="meta">${esc(e.note)}</span>`;
    return h;
  }

  function renderList() {
    const el = $('#view-list');
    let h = `<header class="lt"><div><h1>Kalendár</h1><p>Ťukni na deň a otvorí sa jeho denník.</p></div><button type="button" class="help-q" data-act="help" data-sec="list" aria-label="Pomocník">?</button></header>
      <input type="search" id="q" value="${esc(searchQ)}" placeholder="Hľadať v denníku, napr. jogurt" enterkeyhint="search"><div id="q-res"></div>` + renderCalendar();
    const byDay = new Map();
    entries.forEach(e => {
      const d = dayOf(e.ts);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    });
    const dates = [...byDay.keys()].sort().reverse();
    if (!dates.length) {
      el.innerHTML = h + `<div class="card empty"><div class="big"></div><p><b>Zatiaľ žiadne záznamy</b><br>Prvý zapíšeš tlačidlom ＋ dole.</p></div>`;
      return;
    }
    const ix = dayIndex();
    h += '<h2 class="sub">Posledné dni</h2><div class="dayrows">';
    for (const d of dates.slice(0, listDays)) {
      const sev = ix.sev[d];
      const info = daySummary(byDay.get(d), d, true);
      h += `<button type="button" class="dayrow" data-cal="${d}"><span class="dot c-${dayLevel(d, ix)}"></span>
        <span><b>${fmtDayHead(d)}</b><small>${esc(info)}</small></span>
        ${sev ? `<span class="sev-pill" style="background:${sevColor(sev)}">${sev}/10</span>` : '<span></span>'}<span class="chev">›</span></button>`;
    }
    h += '</div>';
    if (dates.length > listDays) h += `<button type="button" class="btn block" data-act="more-days">Zobraziť staršie dni</button>`;
    el.innerHTML = h;
    renderSearch();
  }

  let searchQ = '';
  function renderSearch() {
    const box = $('#q-res');
    if (!box) return;
    const q = Analysis.norm(searchQ.trim());
    if (q.length < 2) { box.innerHTML = ''; return; }
    const hits = entries.filter(e => Analysis.norm([e.desc, e.note, (e.kinds || []).join(' '),
      e.type === 'food' ? Analysis.mealTags(e).map(tagLabel).join(' ') : ''].join(' ')).includes(q)).sort((a, b) => b.ts - a.ts);
    box.innerHTML = hits.length
      ? `<p class="tiny" style="margin:0 4px 6px">Nájdené: ${hits.length}×</p><div class="dayrows">` + hits.slice(0, 40).map(e =>
        `<button type="button" class="dayrow fnd" data-cal="${dayOf(e.ts)}"><span>${TYPES[e.type].ico}</span>
          <span><b>${esc(e.desc)}</b><small>${fmtDayHead(dayOf(e.ts))} o ${fmtTime(e.ts)}</small></span><span></span><span class="chev">›</span></button>`).join('') + '</div>'
      : '<p class="muted small" style="margin:0 4px 14px">Nič sa nenašlo.</p>';
  }

  // ---------- Čo predchádzalo ťažkostiam ----------
  function agoText(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return 'pred ' + m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return 'pred ' + h + ' h' + (r && h < 6 ? ' ' + r + ' min' : '');
  }

  function openTrace(id) {
    const s = entries.find(e => e.id === id);
    if (!s) return;
    const from = s.ts - 48 * 3600e3;
    const prior = entries.filter(e => e.id !== id && e.ts <= s.ts && e.ts >= from).sort((a, b) => b.ts - a.ts);
    const risk = riskTags();
    const tagCount = {};
    let away = 0;
    prior.filter(e => e.type === 'food').forEach(e => {
      Analysis.mealTags(e).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
      if (e.place && e.place !== 'doma') away++;
    });
    const sumTags = Object.entries(tagCount).sort((a, b) => (risk.includes(b[0]) - risk.includes(a[0])) || b[1] - a[1]);
    let h = `<div class="sheet-head"><h2>Čo predchádzalo</h2><button type="button" class="x" data-act="trace-close" aria-label="Zavrieť">✕</button></div>
      <p class="small muted" style="margin-top:-6px">${esc(s.desc)}${s.severity ? ' · sila ' + s.severity + '/10' : ''} · ${fmtDayHead(dayOf(s.ts))} ${fmtTime(s.ts)}</p>`;
    if (sumTags.length) {
      h += `<div class="trace-sum"><b>Za posledných 48 h:</b><div class="pending" style="margin-top:6px">` +
        sumTags.map(([t, n]) => `<span class="${risk.includes(t) ? 'risk' : ''}">${esc(tagLabel(t))} ${n}×</span>`).join('') +
        (away ? `<span>jedlo nie z domu ${away}×</span>` : '') + '</div></div>';
    }
    const dset = [...new Set([dayOf(s.ts), dayOf(s.ts - 864e5), dayOf(from)])];
    const dinfo = dset.map(d => days[d] && dayText(days[d]) ? `<div class="tiny">${fmtDayHead(d)}: ${esc(dayText(days[d]))}</div>` : '').join('');
    if (dinfo) h += `<div style="margin:8px 0">${dinfo}</div>`;
    if (!prior.length) h += '<p class="muted">Za posledných 48 hodín nie je nič zapísané.</p>';
    h += '<div class="trace-list">' + prior.map(e => {
      const tags = e.type === 'food' ? Analysis.mealTags(e) : [];
      const rt = tags.filter(t => risk.includes(t));
      const extra = [];
      if (e.type === 'food') {
        if (e.place && e.place !== 'doma') extra.push(lab(PLACES, e.place));
        if (e.enzyme) extra.push('enzým');
        if (e.rushed) extra.push('v zhone');
        if (e.portion === 'velka') extra.push('veľká porcia');
      }
      if (e.type === 'symptom' && e.severity) extra.push('sila ' + e.severity);
      if (e.stress >= 4) extra.push('stres ' + e.stress);
      return `<div class="trace-row${rt.length ? ' hot' : ''}">
        <span class="ago">${agoText(s.ts - e.ts)}</span>
        <span><b>${TYPES[e.type].ico} ${esc(e.desc)}</b>
        ${tags.length ? `<div class="tiny">${tags.map(t => (risk.includes(t) ? '' : '') + esc(tagLabel(t))).join(' · ')}</div>` : ''}
        ${extra.length ? `<div class="tiny">${esc(extra.join(' · '))}</div>` : ''}</span></div>`;
    }).join('') + '</div>';
    $('#trace-dialog').innerHTML = h;
    openSheet('trace-dialog');
  }

  // ---------- Kalendár ----------
  let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];

  function renderCalendar() {
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    const first = new Date(y, mo, 1);
    const daysIn = new Date(y, mo + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // pondelok = 0
    const ix = dayIndex();
    const today = todayStr();
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<span></span>';
    for (let n = 1; n <= daysIn; n++) {
      const d = y + '-' + pad(mo + 1) + '-' + pad(n);
      const v = days[d] || {};
      const cls = 'c-' + dayLevel(d, ix);
      cells += `<button type="button" class="cal-d ${cls}${d === today ? ' today' : ''}" data-cal="${d}"${d > today ? ' disabled' : ''}>${n}${v.period ? '<i></i>' : ''}</button>`;
    }
    const isCur = y === new Date().getFullYear() && mo === new Date().getMonth();
    return `<div class="card cal">
      <div class="cal-head"><button type="button" class="btn ghost small" data-act="cal-prev" aria-label="Predchádzajúci mesiac">‹</button>
        <b>${MONTHS[mo]} ${y}</b>
        <button type="button" class="btn ghost small" data-act="cal-next" aria-label="Ďalší mesiac"${isCur ? ' disabled' : ''}>›</button></div>
      <div class="cal-grid">${['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(x => `<span class="cal-w">${x}</span>`).join('')}${cells}</div>
      <div class="cal-legend"><span><i class="c-ok"></i>bez ťažkostí</span><span><i class="c-low"></i>slabé</span><span><i class="c-mid"></i>stredné</span><span><i class="c-high"></i>silné</span><span><i class="dot"></i>menštruácia</span></div>
    </div>`;
  }

  // ---------- Súvislosti ----------
  function ratioText(r) {
    if (r.ratio === Infinity) return 'výrazne';
    return (Math.round(r.ratio * 10) / 10).toString().replace('.', ',') + '×';
  }

  function conf(r) { return r.withN >= 10 && r.withHit >= 3 ? 3 : r.withN >= 6 ? 2 : 1; }
  const CONF_TXT = ['', 'málo údajov', 'náznak', 'silnejší vzorec'];
  function resName(r) {
    let n = r.group === 'food' ? r.label : (CTX_LABELS[r.key] || r.key);
    if (r.group === 'stack') n += ' – 2× a viac za 12 h';
    return n;
  }

  function resItem(r, kind) {
    const name = resName(r);
    let txt, a = 's tým', b = 'inak';
    const w = `<b>${r.withHit} z ${r.withN}</b>`, o = `${r.outHit} z ${r.outN}`;
    if (kind === 'day') txt = `V takéto dni boli ťažkosti ${w} dní. V ostatné dni ${o}.`;
    else if (kind === 'load') { txt = `Keď sa to za deň nazbieralo, boli ťažkosti ${w} dní. Inak ${o} dní.`; a = '2 a viac'; b = 'menej'; }
    else if (kind === 'stack') { txt = `Pri 2× a viac za 12 h prišli ťažkosti po ${w} jedál. Pri 1× po ${o}.`; a = '2× a viac'; b = '1×'; }
    else if (kind === 'risk') txt = `Ťažkosti prišli po ${w} takých jedál. Inak po ${o}.`;
    else { txt = `Ťažkosti prišli po ${w} jedál. Po ostatných jedlách ${o}.`; if (r.group === 'food') a = 's ním'; }
    const c = conf(r);
    return `<div class="res lvl-${r.level}">
      <div class="res-top"><span class="res-name">${esc(name)}</span><span class="ratio">${ratioText(r)}</span></div>
      <div class="res-txt">${txt}</div>
      <div class="bars">
        <span>${a}</span><div class="bar w"><i style="width:${Math.round(r.rateWith * 100)}%"></i></div><span>${pct(r.rateWith)}</span>
        <span>${b}</span><div class="bar o"><i style="width:${Math.round(r.rateWithout * 100)}%"></i></div><span>${pct(r.rateWithout)}</span>
      </div>
      <div class="res-foot"><span class="conf c${c}"><i></i><i></i><i></i>${CONF_TXT[c]}</span>
        <button type="button" class="pin" data-pin="${esc(name)}">Zapísať zistenie</button></div></div>`;
  }

  // Položky s málo údajmi sú zbalené do jedného riadku, aby nezahlcovali výsledky
  function pendingList(list, minN, isFood) {
    if (!list.length) return '';
    return `<details class="more pend"><summary>Zatiaľ málo údajov (${list.length})</summary>
      <p class="tiny" style="margin:0 0 6px">Vyhodnotí sa, keď sa zje aspoň ${minN}×.</p><div class="pending">` +
      list.slice(0, 20).map(p => `<span>${esc(isFood ? p.label : (CTX_LABELS[p.key] || p.key))} ${p.n}/${minN}</span>`).join('') + '</div></details>';
  }

  // ---------- Spojený verdikt: všetky pohľady na jedno podozrivé ----------
  // Rovnakú vec (napr. mliečne) hodnotí viac výpočtov: po jedle, dávka za deň, na druhý deň,
  // hromadenie, najhoršie dni. Tu sa spoja do jedného verdiktu, aby si výsledky neodporovali.
  const SIG_W = { meal: 1, load: 1, late: 0.8, stack: 0.7, day: 0.9 };
  let lastSus = new Map();

  function buildSuspects(r, r2, bw) {
    const S = new Map();
    const add = (id, name, x, kind) => {
      let s = S.get(id);
      if (!s) { s = { id, name, sig: [], score: 0, bad: 0 }; S.set(id, s); }
      s.sig.push({ kind, x });
    };
    const ctxName = k => CTX_LABELS[k] || k;
    r.foods.forEach(x => add(x.key, x.label, x, 'meal'));
    r.ctx.forEach(x => add(x.key, x.key.startsWith('tag:') ? tagLabel(x.label) : ctxName(x.key), x, 'meal'));
    (r.loads || []).forEach(x => add('tag:' + x.label, tagLabel(x.label), x, 'load'));
    (r.stacking || []).forEach(x => add('tag:' + x.label, tagLabel(x.label), x, 'stack'));
    r.days.forEach(x => add(x.key, ctxName(x.key), x, 'day'));
    if (r2) {
      r2.foods.forEach(x => add(x.key, x.label, x, 'late'));
      r2.ctx.filter(x => x.key.startsWith('tag:')).forEach(x => add(x.key, tagLabel(x.label), x, 'late'));
    }
    const bwId = k => k.startsWith('w:') ? k.slice(2) : k;
    const bwName = x => x.key.startsWith('tag:') ? tagLabel(x.label) : x.label;
    if (bw) {
      bw.onlyWorst.forEach(x => add(bwId(x.key), bwName(x), { n: x.n, of: bw.worst.length }, 'worst'));
      bw.onlyBest.forEach(x => add(bwId(x.key), bwName(x), { n: x.n, of: bw.best.length }, 'best'));
      bw.both.forEach(x => add(bwId(x.key), bwName(x), { n: x.n }, 'both'));
    }
    for (const s of S.values()) {
      for (const g of s.sig) {
        if (!SIG_W[g.kind] || g.x.level === 'none') continue;
        s.score += (g.x.level === 'high' ? 2 : 1) * conf(g.x) * SIG_W[g.kind];
        s.bad++;
      }
      // najhoršie dni samy nič nedokazujú, len podporia iný výsledok
      if (s.bad && s.sig.some(g => g.kind === 'worst')) s.score += 0.5;
      s.verdict = s.score >= 4 || s.bad >= 2 ? 'strong' : s.score >= 1 ? 'sus' : 'none';
      // najsilnejší výpočet určuje číslo, ktoré sa ukáže pri názve
      s.top = s.sig.filter(g => SIG_W[g.kind] && g.x.level !== 'none').sort((a, b) => b.x.ratio - a.x.ratio)[0] || null;
    }
    lastSus = S;
    return [...S.values()].filter(s => s.verdict !== 'none').sort((a, b) => b.score - a.score);
  }

  const hasBad = (s, kind) => s.sig.some(g => g.kind === kind && g.x.level !== 'none');
  const hasKind = (s, kind) => s.sig.find(g => g.kind === kind);

  // Jedna veta ku každému výpočtu, ľudskou rečou
  function sigSentence(g, s) {
    const x = g.x, w = `${x.withHit} z ${x.withN}`, o = x.outN ? pct(x.rateWithout) : '';
    switch (g.kind) {
      case 'meal':
        if (!s.id.includes(':') || s.id.startsWith('tag:')) {
          return x.level === 'none'
            ? (hasBad(s, 'load') ? 'Po jednom jedle sa to neprejaví. Vadí až väčšie množstvo za deň.' : `Po jednotlivých jedlách súvis nevidno (${w}).`)
            : `Po ${w} takých jedál prišli do ${(lastR && lastR.opts.toH) || 6} h ťažkosti. Po ostatných jedlách v ${o} prípadov.`;
        }
        return `Po ${w} takých jedál prišli ťažkosti. Po ostatných v ${o} prípadov.`;
      case 'load': return x.level === 'none' ? `Ani pri 2 a viac porciách za deň sa ťažkosti nezvyšujú (${w} dní).`
        : `V dni s 2 a viac porciami boli ťažkosti ${w} dní. V ostatné dni ${x.outHit} z ${x.outN}.`;
      case 'late': return `Na druhý deň (12–48 h) prišli ťažkosti po ${w} takých jedál. Inak v ${o} prípadov.`;
      case 'stack': return `Keď sa to za 12 h zjedlo 2× a viac, prišli ťažkosti po ${w} jedál. Pri 1× v ${o} prípadov.`;
      case 'day': return `V takéto dni boli ťažkosti ${w} dní. V ostatné dni ${x.outHit} z ${x.outN}.`;
      case 'worst': return `Bolo v ${x.n} z ${x.of} najhorších dní a v žiadnom z najlepších.`;
      case 'best': return `Bolo v ${x.n} z ${x.of} najlepších dní a v žiadnom z najhorších.`;
      case 'both': return doseOnly(s) ? 'Bolo aj v dobrých dňoch. Rozhoduje teda skôr množstvo než samotná surovina.' : 'Bolo v najlepších aj najhorších dňoch.';
    }
    return '';
  }
  // vadí len väčšie množstvo za deň, jedno jedlo samo nie
  const doseOnly = s => hasBad(s, 'load') && !hasBad(s, 'meal');
  const VERDICT_TXT = { strong: 'Silné podozrenie', sus: 'Podozrenie', none: 'Bez jasného súvisu' };
  const susConf = s => Math.max(1, ...s.sig.filter(g => SIG_W[g.kind] && g.x.level !== 'none').map(g => conf(g.x)));
  const susRatio = s => s.top ? ratioText(s.top.x) : '';

  // Hlavné podozrenie navrchu Súvislostí
  function heroHtml(s) {
    const lines = s.sig.filter(g => SIG_W[g.kind] && g.x.level !== 'none').sort((a, b) => b.x.ratio - a.x.ratio)
      .concat(s.sig.filter(g => (g.kind === 'meal' && g.x.level === 'none' && doseOnly(s)) || g.kind === 'worst' || (g.kind === 'both' && doseOnly(s))))
      .slice(0, 3);
    const c = susConf(s);
    const testable = s.id.startsWith('tag:') || !s.id.includes(':');
    return `<div class="card hero v-${s.verdict}"><p class="eyebrow">Hlavné podozrenie</p>
      <div class="res-top"><h2 class="res-name">${esc(s.name)}</h2><span class="ratio">${susRatio(s)}</span></div>
      <ul class="why">${lines.map(g => `<li>${sigSentence(g, s)}</li>`).join('')}</ul>
      <div class="res-foot"><span class="conf c${c}"><i></i><i></i><i></i>${CONF_TXT[c]}</span></div>
      <div class="hero-btns"><button type="button" class="btn small" data-sus="${esc(s.id)}">Podrobnosti</button>
        ${testable ? `<button type="button" class="btn small primary" data-act="test-for" data-sus-id="${esc(s.id)}">Vyskúšať bez toho</button>` : ''}</div></div>`;
  }
  // Ďalšie podozrenia ako krátky zoznam; detail sa otvorí ťuknutím
  function susRowsHtml(list) {
    return '<div class="dayrows flat">' + list.map(s => {
      const g = s.top;
      return `<button type="button" class="dayrow sus-row v-${s.verdict}" data-sus="${esc(s.id)}"><span class="dot"></span>
        <span><b>${esc(s.name)}</b><small>${g ? sigSentence(g, s) : ''}</small></span><span class="ratio">${susRatio(s)}</span><span class="chev">›</span></button>`;
    }).join('') + '</div>';
  }

  // Detail podozrivého: všetky výpočty, kedy prichádzajú ťažkosti a konkrétne jedlá
  function openSuspect(id) {
    const s = lastSus.get(id);
    if (!s) return;
    const ev = Analysis.evidence(entries, days, id, Date.now());
    const testable = s.id.startsWith('tag:') || !s.id.includes(':');
    const order = ['meal', 'load', 'late', 'stack', 'day', 'worst', 'best', 'both'];
    const sigs = s.sig.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    let h = `<div class="sheet-head"><h2>${esc(s.name)}</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>
      <p class="verdict v-${s.verdict}">${VERDICT_TXT[s.verdict]}${s.top ? ' · ' + susRatio(s) : ''}</p>`;
    h += grp('Čo ukazujú údaje', '<ul class="why">' + sigs.map(g => `<li class="${SIG_W[g.kind] && g.x.level !== 'none' ? 'bad' : g.kind === 'best' ? 'good' : ''}">${sigSentence(g, s)}</li>`).join('') + '</ul>');
    if (ev && ev.mine.n >= 3) {
      const lab = ['do 1 h', '1–2 h', '2–4 h', '4–8 h', '8–24 h'];
      const rows = ev.buckets.map((_, i) => `<span>${lab[i]}</span>
        <div class="bar2"><i class="m" style="width:${Math.round(ev.mine.b[i] * 100)}%"></i><i class="o" style="width:${Math.round(ev.rest.b[i] * 100)}%"></i></div>
        <span>${pct(ev.mine.b[i])}</span>`).join('');
      h += grp('Za koľko po jedle prišli ťažkosti', `<div class="delay">${rows}</div>
        <p class="tiny" style="margin:10px 0 0"><i class="key m"></i> po tomto jedle (${ev.mine.n}×) &nbsp; <i class="key o"></i> po ostatných jedlách</p>
        ${ev.peak >= 0 ? `<p class="small" style="margin:8px 0 0">Najčastejšie <b>${lab[ev.peak]}</b> po jedle, častejšie ako po iných jedlách.</p>` : ''}
        <p class="tiny" style="margin:6px 0 0">Bez ťažkostí do 24 h: ${pct(ev.mine.none)} takých jedál, inak ${pct(ev.rest.none)}.</p>`);
    }
    if (ev && ev.list.length) {
      h += grp('Kedy si to jedla', '<div class="evlist">' + ev.list.slice(0, 15).map(x => {
        // ťažkosti v sledovanom okne sú červené, neskoršie len sivé
        const win = (lastR && lastR.opts.toH) || 6;
        const after = d => 'o ' + (d < 1 ? Math.max(1, Math.round(d * 60)) + ' min' : Math.round(d) + ' h');
        const out = !x.ripe && x.delay == null ? ['wait', 'čaká sa'] : x.delay != null && x.delay < 24
          ? [x.delay <= win ? 'hit' : 'wait', 'ťažkosti ' + after(x.delay) + (x.sev ? ' · ' + x.sev + '/10' : '')]
          : x.known ? ['ok', 'bez ťažkostí'] : ['wait', 'deň nezapísaný'];
        return `<button type="button" class="ev" data-goday="${dayOf(x.ts)}"><span class="ev-t">${esc(x.desc)}<small>${fmtDayHead(dayOf(x.ts))} · ${fmtTime(x.ts)}</small></span>
          <span class="ev-o ${out[0]}">${out[1]}</span></button>`;
      }).join('') + '</div>' + (ev.list.length > 15 ? `<p class="tiny" style="margin:8px 0 0">a ďalších ${ev.list.length - 15} starších</p>` : ''));
    }
    h += `<p class="tiny" style="margin:0 4px 12px">Čísla ukazujú, čo sa časovo zhoduje. Istotu dá až test: na čas vynechať a sledovať, či je lepšie.</p>
      <div class="savebar"><button type="button" class="btn" data-pin="${esc(s.name)}">Zapísať zistenie</button>
      ${testable ? `<button type="button" class="btn primary" data-act="test-for" data-sus-id="${esc(s.id)}">Vyskúšať bez toho</button>` : ''}</div>`;
    $('#mini-sheet').innerHTML = h;
    openSheet('mini-sheet');
  }

  // Podozrivé ukáže hneď, ostatné schová do rozbaľovacieho zoznamu
  function resList(list, kind, emptyTxt) {
    if (!list.length) return emptyTxt ? `<p class="muted small">${emptyTxt}</p>` : '';
    const sus = list.filter(x => x.level !== 'none');
    const rest = list.filter(x => x.level === 'none');
    let h = sus.length ? sus.map(x => resItem(x, kind)).join('') : '<p class="muted small" style="margin:4px 0">Zatiaľ nič nevyzerá podozrivo. </p>';
    if (rest.length) h += `<details class="more"><summary>Bez zjavného súvisu (${rest.length})</summary>${rest.map(x => resItem(x, kind)).join('')}</details>`;
    return h;
  }

  function sel(id, val, options) {
    return `<select id="${id}">${options.map(([v, l]) => `<option value="${v}"${v === val ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  }

  // Po čom ťažkosti prichádzajú zriedkavejšie
  function toleratedList(r) {
    if (r.totalHit < 3) return [];
    return r.foods.concat(r.ctx.filter(x => x.key.startsWith('tag:')))
      .filter(x => x.ratio <= 0.6 && x.rateWith <= 0.2)
      .sort((a, b) => a.rateWith - b.rateWith || b.withN - a.withN).slice(0, 14);
  }

  // ---------- Moje zistenia ----------
  const FND_ICO = { bad: '<span class="fi bad">' + ic('x') + '</span>', ok: '<span class="fi ok">' + ic('check') + '</span>', sus: '<span class="fi sus">' + ic('q') + '</span>' };
  const FND_TXT = { bad: 'vadí', ok: 'nevadí', sus: 'podozrivé' };
  const findings = () => meta.findings || [];
  let fDraft = null;

  function findingsHtml() {
    const list = findings();
    return `<div class="card"><h2>Moje zistenia</h2>` + (list.length
      ? '<div class="dayrows flat">' + list.map(f => `<button type="button" class="dayrow fnd" data-fnd="${f.id}"><span>${FND_ICO[f.status]}</span>
          <span><b>${esc(f.text)}</b>${f.note ? `<small>${esc(f.note)}</small>` : ''}</span><span></span><span class="chev">›</span></button>`).join('') + '</div>'
      : '<p class="small muted" style="margin:0 0 10px">Sem si zapíš, čo ste už potvrdili alebo vylúčili. Postupne z toho vznikne tvoj vlastný zoznam.</p>') +
      `<button type="button" class="btn small" data-act="fnd-new">＋ Pridať zistenie</button></div>`;
  }

  function openFinding(f) {
    fDraft = Object.assign({ text: '', status: 'sus', note: '' }, f);
    const t = fDraft.fromTest;
    const opt = t
      ? [['bad', 'Bez toho mi bolo lepšie'], ['ok', 'Žiadny rozdiel'], ['sus', 'Neviem povedať']]
      : [['bad', 'Vadí mi to'], ['ok', 'Nevadí mi to'], ['sus', 'Podozrivé, treba overiť']];
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>${t ? 'Ako dopadol test?' : fDraft.id ? 'Upraviť zistenie' : 'Nové zistenie'}</h2>
        <button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>` +
      grp('', `<input type="text" id="fd-text" class="big" value="${esc(fDraft.text)}" placeholder="napr. smotana, káva nalačno" enterkeyhint="done">`) +
      grp('Čo ste zistili?', '<div class="chips col">' + opt.map(([v, l]) => `<button type="button" class="chip${fDraft.status === v ? ' on' : ''}" data-fs="${v}">${l}</button>`).join('') + '</div>') +
      grp('Poznámka', `<textarea id="fd-note" placeholder="napr. malá porcia nevadí, veľká áno">${esc(fDraft.note)}</textarea>`) +
      (t ? '<p class="tiny" style="margin:0 4px 12px">Ak bolo bez toho lepšie, skús to v pokojný deň zaradiť späť v malej porcii a sleduj 48 hodín. Až návrat ťažkostí podozrenie potvrdí.</p>' : '') +
      `<div class="savebar">${fDraft.id ? '<button type="button" class="btn danger" data-act="fnd-del">Zmazať</button>' : ''}
        <button type="button" class="btn primary" data-act="fnd-save">Uložiť</button></div>`;
    openSheet('mini-sheet');
  }

  async function saveFinding() {
    const text = $('#fd-text').value.trim();
    if (!text) { toast('Napíš, čoho sa zistenie týka'); return; }
    const f = { id: fDraft.id || uid(), text, status: fDraft.status, note: $('#fd-note').value.trim(), ts: fDraft.ts || Date.now() };
    const list = findings().filter(x => x.id !== f.id);
    list.unshift(f);
    await setMeta('findings', list);
    const wasTest = fDraft.fromTest ? meta.test : null;
    if (fDraft.fromTest) await setMeta('test', null);
    if (fDraft.fromReintro) await setMeta('reintro', null);
    closeSheet('mini-sheet');
    render();
    // po teste, kde bolo bez toho lepšie, je ďalší krok opätovné zavedenie
    if (wasTest && f.status === 'bad' && !meta.reintro) toast('Zistenie uložené ✓', { label: 'Zaviesť späť', run: () => openReintroNew({ text: wasTest.what, tag: wasTest.tag }) });
    else toast('Zistenie uložené ✓');
  }

  // ---------- Test podozrivého ----------
  let tDraft = null;
  function testInfo() {
    const t = meta.test;
    if (!t) return null;
    const day0 = parseDay(todayStr()).getTime();
    const passed = Math.round((day0 - t.start) / DAY);
    const elapsed = Math.max(1, Math.min(t.days, passed + 1));
    const symDays = new Set(entries.filter(e => e.type === 'symptom').map(e => dayOf(e.ts)));
    const cnt = from => { let c = 0; for (let i = 0; i < elapsed; i++) if (symDays.has(dateStr(from + i * DAY + 12 * 3600e3))) c++; return c; };
    const slips = t.tag ? entries.filter(e => e.type === 'food' && e.ts >= t.start && Analysis.mealTags(e).includes(t.tag)).length : 0;
    return { t, elapsed, during: cnt(t.start), before: cnt(t.start - elapsed * DAY), slips, done: passed >= t.days };
  }

  function testBannerHtml() {
    const i = testInfo();
    if (!i) return '';
    return `<div class="banner test"><div><b>Test: bez ${esc(i.t.what)}</b>${i.done ? 'Test je na konci. Výsledok zapíšeš v Súvislostiach.' : 'Deň ' + i.elapsed + ' z ' + i.t.days}</div></div>`;
  }

  function testHtml() {
    const i = testInfo();
    if (!i) {
      return `<div class="card"><h2>Test podozrivého</h2><p class="small muted" style="margin:0 0 10px">Čísla ukážu len podozrenie.
        Istotu dá až skúška: jednu vec na čas vynechať a sledovať, či je lepšie. Vždy len jednu vec naraz.</p>
        <button type="button" class="btn small" data-act="test-new">Začať test</button></div>`;
    }
    return `<div class="card"><h2>Test: bez ${esc(i.t.what)}</h2>
      <div class="prog"><i style="width:${Math.round(i.elapsed / i.t.days * 100)}%"></i></div>
      <p class="small" style="margin:8px 0">Deň <b>${i.elapsed} z ${i.t.days}</b>${i.done ? ' – test je na konci' : ''}</p>
      <p class="small muted" style="margin:0 0 12px">Dni s ťažkosťami počas testu: <b>${i.during} z ${i.elapsed}</b>.
        Rovnako dlho pred testom: <b>${i.before} z ${i.elapsed}</b>.${i.slips ? ` Počas testu si to ${i.slips}× zjedla.` : ''}</p>
      <div class="stack"><button type="button" class="btn small primary" data-act="test-end">Ukončiť a zapísať výsledok</button>
        <button type="button" class="btn small ghost" data-act="test-cancel">Zrušiť test</button></div></div>`;
  }

  // pre = predvyplnené z podozrivého: { tag } alebo { text }
  function openTestNew(pre) {
    pre = pre || {};
    tDraft = { tag: pre.tag || null, days: 14 };
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>Nový test</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>` +
      grp('Čo na čas vynecháš?', '<div class="chips">' + TAGS.map(([v, e, t]) => `<button type="button" class="chip${v === tDraft.tag ? ' on' : ''}" data-tt="${v}">${esc(t)}</button>`).join('') + '</div>' +
        `<input type="text" id="tt-text" style="margin-top:10px" value="${esc(pre.text || '')}" placeholder="alebo napíš vlastné, napr. paradajky" enterkeyhint="done">`) +
      grp('Ako dlho?', '<div class="chips seg">' + [7, 14, 21].map(n => `<button type="button" class="chip${n === 14 ? ' on' : ''}" data-td="${n}">${n} dní</button>`).join('') + '</div>') +
      '<p class="tiny" style="margin:0 4px 12px">Väčšie zmeny v strave a lieky vždy najprv preber s lekárom.</p>' +
      `<div class="savebar"><button type="button" class="btn primary" data-act="test-start">Začať dnes</button></div>`;
    openSheet('mini-sheet');
  }

  // Spojený verdikt s aktuálnym nastavením výpočtu (pre Dnes a prehľad pre lekára)
  function computeSuspects() {
    const fromH = meta.fromH != null ? meta.fromH : 0, toH = meta.toH != null ? meta.toH : 6, minN = meta.minN || 5;
    const r = Analysis.analyze(entries, days, { fromH, toH, minN, riskTags: riskTags() });
    if (r.totalN < 10 || r.symptomCount < 3) return [];
    lastR = r;
    const r2 = toH < 12 ? Analysis.analyze(entries, days, { fromH: 12, toH: 48, minN, riskTags: riskTags() }) : null;
    return buildSuspects(r, r2 && r2.totalN >= 10 ? r2 : null, Analysis.bestWorst ? Analysis.bestWorst(entries, days) : null);
  }

  // ---------- Týždenný prehľad ----------
  // V nedeľu večer, v pondelok a utorok ukáže zhrnutie posledného týždňa v porovnaní s predošlým.
  function weekStats(endDay) {
    const list = [];
    for (let i = 0; i < 7; i++) list.push(dateStr(parseDay(endDay).getTime() - i * DAY + 12 * 3600e3));
    const set = new Set(list);
    const E = entries.filter(e => set.has(dayOf(e.ts)));
    const sym = E.filter(e => e.type === 'symptom');
    const symDays = new Set(sym.map(e => dayOf(e.ts)));
    const logged = new Set(E.map(e => dayOf(e.ts)));
    const known = list.filter(d => symDays.has(d) || (days[d] && days[d].noSymptoms)).length;
    const sev = sym.map(e => e.severity).filter(x => x != null);
    const risk = riskTags();
    let riskN = 0;
    E.filter(e => e.type === 'food').forEach(e => { if (Analysis.mealTags(e).some(t => risk.includes(t))) riskN++; });
    return { symDays: symDays.size, logged: logged.size, known, avg: sev.length ? sev.reduce((a, b) => a + b, 0) / sev.length : null, riskN, food: E.filter(e => e.type === 'food').length };
  }

  function weekHtml() {
    const now = new Date();
    const wd = now.getDay(), hr = now.getHours();
    if (!((wd === 0 && hr >= 17) || wd === 1 || wd === 2)) return '';
    // týždeň končí v nedeľu: v nedeľu večer dnešok, inak posledná nedeľa
    const back = wd === 0 ? 0 : wd;
    const end = dateStr(parseDay(todayStr()).getTime() - back * DAY + 12 * 3600e3);
    if (meta.weekSeen === end) return '';
    const A = weekStats(end), B = weekStats(dateStr(parseDay(end).getTime() - 7 * DAY + 12 * 3600e3));
    if (A.logged < 3) return '';
    const cmp = B.logged >= 3 ? (A.symDays < B.symDays ? `o ${B.symDays - A.symDays} menej ako minulý týždeň` : A.symDays > B.symDays ? `o ${A.symDays - B.symDays} viac ako minulý týždeň` : 'rovnako ako minulý týždeň') : '';
    let tip;
    if (A.known < 5) tip = 'Pri ' + (7 - A.known) + ' dňoch nevieme, či boli bez ťažkostí. Ťukni večer na „Deň bez ťažkostí“, spresní to vyhodnotenie.';
    else {
      const top = computeSuspects()[0];
      tip = top && top.score >= 2 ? `Najväčšie podozrenie zostáva ${top.name}. Podrobnosti sú v Súvislostiach.` : 'Zapisuj ďalej, údaje pribúdajú.';
    }
    const bar = n => `<span class="wk-bar"><i style="width:${Math.round(n / 7 * 100)}%"></i></span>`;
    return `<div class="card week"><div class="res-top"><h3>Tvoj týždeň</h3><button type="button" class="x" data-act="week-hide" data-end="${end}" aria-label="Skryť">✕</button></div>
      <div class="wk"><span>Dni s ťažkosťami</span>${bar(A.symDays)}<b>${A.symDays} zo 7</b></div>
      ${cmp ? `<p class="tiny" style="margin:2px 0 8px">${cmp}</p>` : ''}
      <div class="wk"><span>Dni so záznamom</span>${bar(A.logged)}<b>${A.logged} zo 7</b></div>
      ${A.avg != null ? `<p class="small muted" style="margin:8px 0 0">Priemerná sila ťažkostí ${A.avg.toFixed(1).replace('.', ',')}/10${B.avg != null ? ' (minulý týždeň ' + B.avg.toFixed(1).replace('.', ',') + ')' : ''}.</p>` : ''}
      ${riskTags().length ? `<p class="small muted" style="margin:4px 0 0">Jedlá s tvojimi rizikovými surovinami: ${A.riskN}×${B.logged >= 3 ? ' (minulý týždeň ' + B.riskN + '×)' : ''}.</p>` : ''}
      <p class="small" style="margin:10px 0 0">${esc(tip)}</p></div>`;
  }

  // ---------- Opätovné zavedenie (po vzore Monash) ----------
  // Po vynechaní sa podozrivá vec 3 dni za sebou zje v stúpajúcej dávke a sleduje sa, či a kedy prídu ťažkosti.
  // [porcia, názov, koho/čo (zjedz …), po čom (prišli po …)]
  const RI_DOSES = [['mala', 'malá porcia', 'malú porciu', 'malej porcii'], ['normalna', 'bežná porcia', 'bežnú porciu', 'bežnej porcii'], ['velka', 'väčšia porcia', 'väčšiu porciu', 'väčšej porcii']];
  let riDraft = null;

  function reintroInfo() {
    const r = meta.reintro;
    if (!r) return null;
    const day = Math.floor((parseDay(todayStr()).getTime() - r.start) / DAY);   // 0, 1, 2 = dni dávok
    const sym = entries.filter(e => e.type === 'symptom');
    // ťažkosti do 24 h po každej zjedenej dávke
    const res = r.doses.map((d, i) => {
      if (!d.ts) return { i, eaten: false };
      const after = sym.filter(e => e.ts >= d.ts && e.ts <= d.ts + 24 * 3600e3);
      return { i, eaten: true, ts: d.ts, n: after.length, max: after.length ? Math.max(...after.map(e => e.severity || 1)) : 0,
        delay: after.length ? (Math.min(...after.map(e => e.ts)) - d.ts) / 3600e3 : null };
    });
    // porovnanie: koľko dní s ťažkosťami bolo 14 dní pred začiatkom
    const symDays = new Set(sym.map(e => dayOf(e.ts)));
    let base = 0;
    for (let i = 1; i <= 14; i++) if (symDays.has(dateStr(r.start - i * DAY + 12 * 3600e3))) base++;
    const lastEaten = res.filter(x => x.eaten).pop();
    const finished = day >= 4 || (res.every(x => x.eaten) && Date.now() - res[2].ts > 24 * 3600e3);
    return { r, day, res, base, finished, todayDose: day >= 0 && day <= 2 ? day : -1, lastEaten };
  }

  // výsledok jednou vetou
  function reintroVerdict(i) {
    const bad = i.res.filter(x => x.eaten && x.max >= 4);
    const mild = i.res.filter(x => x.eaten && x.n && x.max < 4);
    if (!i.res.some(x => x.eaten)) return ['sus', 'Žiadna dávka nie je zapísaná.'];
    if (!bad.length) return ['ok', mild.length ? 'Prišli len slabé ťažkosti. Zdá sa, že to znášaš dobre.' : 'Po žiadnej dávke neprišli ťažkosti. Zdá sa, že to znášaš dobre.'];
    if (bad[0].i === 0) return ['bad', 'Ťažkosti prišli už po malej porcii. Vadí aj malé množstvo.'];
    return ['bad', `Malú porciu si zniesla, ťažkosti prišli až po ${RI_DOSES[bad[0].i][3]}. Rozhoduje teda množstvo.`];
  }

  function reintroBannerHtml() {
    const i = reintroInfo();
    if (!i) return '';
    if (i.finished) return `<div class="banner test"><div><b>Zavádzanie: ${esc(i.r.what)}</b>Hotovo. Výsledok nájdeš v Súvislostiach, časť Moje.</div></div>`;
    if (i.todayDose < 0) return '';
    const d = i.r.doses[i.todayDose];
    if (d.ts) {
      const h = (Date.now() - d.ts) / 3600e3;
      return `<div class="banner test"><div><b>Zavádzanie: ${esc(i.r.what)} · deň ${i.todayDose + 1} z 3</b>${h < 8 ? 'Dávka zjedená. Ak prídu ťažkosti, zapíš ich hneď nižšie.' : 'Dnešná dávka je za tebou.'}</div></div>`;
    }
    return `<div class="banner test"><div><b>Zavádzanie: ${esc(i.r.what)} · deň ${i.todayDose + 1} z 3</b>Dnes zjedz <b>${RI_DOSES[i.todayDose][2]}</b>, ideálne na obed.</div>
      <button type="button" class="btn small primary" data-act="ri-dose">Zjedla som</button></div>`;
  }

  function reintroHtml() {
    const i = reintroInfo();
    if (!i) {
      return `<div class="card"><h2>Opätovné zavedenie</h2><p class="small muted" style="margin:0 0 10px">Keď bolo bez niečoho lepšie, overí sa to návratom:
        3 dni po sebe malá, bežná a väčšia porcia. Ukáže, či to vadí a od akého množstva.</p>
        <button type="button" class="btn small" data-act="ri-new">Začať zavádzanie</button></div>`;
    }
    const rows = i.res.map(x => `<div class="ri-row"><span>Deň ${x.i + 1} · ${RI_DOSES[x.i][1]}</span>${!x.eaten ? '<span class="ev-o wait">nezjedené</span>'
      : x.n ? `<span class="ev-o ${x.max >= 4 ? 'hit' : 'wait'}">ťažkosti ${x.max}/10${x.delay != null ? ' o ' + Math.max(1, Math.round(x.delay)) + ' h' : ''}</span>`
      : Date.now() - x.ts < 24 * 3600e3 ? '<span class="ev-o wait">sleduje sa</span>' : '<span class="ev-o ok">bez ťažkostí</span>'}</div>`).join('');
    const vt = reintroVerdict(i)[1];
    const showV = i.finished || i.res.some(x => x.eaten && x.max >= 4);
    return `<div class="card"><h2>Zavádzanie: ${esc(i.r.what)}</h2>${rows}
      <p class="tiny" style="margin:10px 0 0">Pred začiatkom: ťažkosti ${i.base} zo 14 dní.</p>
      ${showV ? `<p class="small" style="margin:10px 0 0"><b>${vt}</b></p>` : '<p class="small muted" style="margin:10px 0 0">Ťažkosti sa sledujú 24 h po každej dávke.</p>'}
      <div class="stack" style="margin-top:12px">${i.res.some(x => x.eaten) ? `<button type="button" class="btn small primary" data-act="ri-end">Ukončiť a zapísať výsledok</button>` : ''}
        <button type="button" class="btn small ghost" data-act="ri-cancel">Zrušiť zavádzanie</button></div></div>`;
  }

  function openReintroNew(pre) {
    pre = pre || {};
    if (meta.test) { toast('Najprv ukonči prebiehajúci test.'); return; }
    riDraft = { tag: pre.tag || null };
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>Opätovné zavedenie</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>` +
      grp('Čo zavedieš späť?', '<div class="chips">' + TAGS.map(([v, e, t]) => `<button type="button" class="chip${v === riDraft.tag ? ' on' : ''}" data-rt="${v}">${esc(t)}</button>`).join('') + '</div>' +
        `<input type="text" id="ri-text" style="margin-top:10px" value="${esc(pre.text || '')}" placeholder="alebo konkrétne jedlo, napr. mlieko" enterkeyhint="done">`) +
      grp('Ako na to', `<ol class="steps small"><li>Deň 1: <b>malá porcia</b>, deň 2: <b>bežná</b>, deň 3: <b>väčšia</b>.</li>
        <li>Inak jedz ako počas vynechania, nič ďalšie nové.</li><li>Ak prídu silné ťažkosti, ďalšiu dávku vynechaj.</li></ol>`) +
      '<p class="tiny" style="margin:0 4px 12px">Pri alergii (vyrážky, opuch, dýchavičnosť) zavádzanie nerob a choď k lekárovi.</p>' +
      `<div class="savebar"><button type="button" class="btn primary" data-act="ri-start">Začať dnes</button></div>`;
    openSheet('mini-sheet');
  }

  // ---------- Najlepšie a najhoršie dni ----------
  function bestWorstHtml() {
    const bw = Analysis.bestWorst ? Analysis.bestWorst(entries, days) : null;
    if (!bw) return '';
    const lab2 = r => r.key.startsWith('tag:') ? tagLabel(r.label) : r.label;
    const chips = (list, cls) => list.length ? '<div class="pending">' + list.map(r => `<span class="${cls}">${esc(lab2(r))}</span>`).join('') + '</div>' : '<p class="tiny" style="margin:0">nič výrazné</p>';
    return `<div class="card"><h2>Najhoršie a najlepšie dni</h2>
      <p class="tiny" style="margin:0 0 10px">Najhoršie: ${bw.worst.map(x => fmtDayHead(x.date) + ' (' + x.sev + '/10)').join(', ')}.<br>Najlepšie: ${bw.best.map(fmtDayHead).join(', ')}.</p>
      <h4 class="mini-h">Jedlo sa len v najhorších dňoch</h4>${chips(bw.onlyWorst, 'risk')}
      <h4 class="mini-h">Jedlo sa len v najlepších dňoch</h4>${chips(bw.onlyBest, 'good')}
      ${bothHtml(bw.both, chips)}</div>`;
  }
  // Čo bolo v najlepších aj najhorších dňoch: ak je to podozrivé z inej strany (napr. dávka za deň),
  // netvrdíme, že to nerozhoduje
  function bothHtml(both, chips) {
    if (!both.length) return '';
    const id = x => x.key.startsWith('w:') ? x.key.slice(2) : x.key;
    const susOf = x => { const s = lastSus.get(id(x)); return s && s.verdict !== 'none' ? s : null; };
    const dose = both.filter(x => susOf(x) && doseOnly(susOf(x)));
    const other = both.filter(x => susOf(x) && !dose.includes(x));
    const plain = both.filter(x => !susOf(x));
    return (dose.length ? `<h4 class="mini-h">Bolo v oboch, ale záleží asi na množstve</h4>${chips(dose, 'risk')}` : '') +
      (other.length ? `<h4 class="mini-h">Bolo v oboch, no po jedle vyzerá podozrivo</h4>${chips(other, 'risk')}` : '') +
      (plain.length ? `<h4 class="mini-h">Bolo v oboch, takže asi nerozhoduje</h4>${chips(plain, '')}` : '');
  }

  let insTab = 'sus';
  let lastR = null;
  const INS_TABS = [['sus', 'Podozrivé'], ['good', 'Dobré'], ['days', 'Dni'], ['mine', 'Moje']];

  function renderInsights() {
    const el = $('#view-insights');
    const fromH = meta.fromH != null ? meta.fromH : 0;
    const toH = meta.toH != null ? meta.toH : 6;
    const minN = meta.minN || 5;
    const r = Analysis.analyze(entries, days, { fromH, toH, minN, riskTags: riskTags() });

    let h = `<header class="lt"><div><h1>Súvislosti</h1><p>Po čom je horšie a po čom dobre.</p></div><button type="button" class="help-q" data-act="help" data-sec="insights" aria-label="Pomocník">?</button></header>
      <div class="segbar">${INS_TABS.map(([k, l]) => `<button type="button" class="${k === insTab ? 'on' : ''}" data-ins="${k}">${l}</button>`).join('')}</div>`;
    const note = `<p class="foot">Len pomôcka, nie diagnóza. Čísla ukazujú, čo sa časovo zhoduje, nie čo ťažkosti naozaj spôsobuje. Jedlo ani lieky nevynechávaj bez dohody s lekárom.</p>`;

    if (insTab === 'mine') {
      h += findingsHtml() + reintroHtml() + testHtml();
      h += `<div class="card"><h2>Prehľad pre lekára</h2><p class="small muted" style="margin:0 0 10px">Krátke zhrnutie posledných 30 dní na jednu stranu.</p>
        <button type="button" class="btn small" data-act="report">Otvoriť prehľad</button></div>`;
      h += `<div class="card"><h3>Ako čítať výsledky</h3><p class="small muted" style="margin:0">
        <b>2×</b> znamená, že po tomto jedle prišli ťažkosti dvakrát častejšie ako po ostatných.
        Jedno jedlo obsahuje viac surovín, preto môže vyzerať podozrivo aj niečo, čo sa jedáva spolu s pravým vinníkom.
        Bodky ukazujú, koľko údajov za číslom je: jedna bodka je málo údajov, tri sú silnejší vzorec.
        „Výrazne“ znamená, že inak sa ťažkosti v sledovanom čase neobjavili vôbec.</p></div>`;
      h += `<div class="card"><h3>Nastavenie výpočtu</h3><div class="opts">
        <label>Ťažkosti od${sel('o-from', fromH, [[0, '0 h'], [1, '1 h'], [2, '2 h'], [3, '3 h']])}</label>
        <label>do${sel('o-to', toH, [[2, '2 h'], [3, '3 h'], [4, '4 h'], [6, '6 h'], [8, '8 h'], [12, '12 h'], [24, '24 h']])}</label>
        <label>Min. výskytov${sel('o-min', minN, [[3, '3×'], [5, '5×'], [8, '8×'], [10, '10×']])}</label>
      </div><p class="tiny" style="margin:8px 0 0">Ťažkosti sa priradia k jedlu, ak prišli ${fromH}–${toH} h po ňom.</p></div>`;
      el.innerHTML = h + note;
      return;
    }

    if (r.totalN < 10 || r.symptomCount < 3) {
      const p = Math.round((Math.min(r.totalN, 10) / 10 * 0.6 + Math.min(r.symptomCount, 3) / 3 * 0.4) * 100);
      h += `<div class="card"><h3>Zbierame údaje</h3><div class="prog"><i style="width:${p}%"></i></div>
        <p class="muted small" style="margin:10px 0 0">Zatiaľ ${r.totalN} z 10 jedál a ${r.symptomCount} z 3 záznamov ťažkostí.
        Vyhodnotenie začne dávať zmysel asi po 2 týždňoch. Zapisuj aj dni bez ťažkostí, sú rovnako dôležité.</p>
        ${pendingList(r.foodsPending, minN, true)}</div>`;
      el.innerHTML = h + note;
      return;
    }

    lastR = r;
    const r2 = toH < 12 ? Analysis.analyze(entries, days, { fromH: 12, toH: 48, minN, riskTags: riskTags() }) : null;
    const bw = Analysis.bestWorst ? Analysis.bestWorst(entries, days) : null;
    const sus = buildSuspects(r, r2 && r2.totalN >= 10 ? r2 : null, bw);
    // čo je podozrivé z iného pohľadu (napr. dávka za deň), nepatrí medzi dobre znášané
    const tol = toleratedList(r).filter(x => !sus.some(s => s.id === x.key));
    if (insTab === 'sus') {
      const hero = sus[0] && sus[0].score >= 2 ? sus[0] : null;
      const others = sus.filter(s => s !== hero).slice(0, 8);
      h += hero ? heroHtml(hero) : `<div class="card"><h2>V skratke</h2><p class="small muted" style="margin:0">Zatiaľ nič nevyzerá výrazne podozrivo.
        Zapisuj ďalej, najmä aj dni bez ťažkostí.</p></div>`;
      if (others.length) h += `<div class="card"><h2>${hero ? 'Ďalšie podozrenia' : 'Možné podozrenia'}</h2>${susRowsHtml(others)}</div>`;
      h += `<div class="card"><h2>Najlepšie znášané</h2>` + (tol.length
        ? '<div class="pending">' + tol.slice(0, 6).map(x => `<span class="good">${esc(resName(x))}</span>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Zatiaľ málo údajov.</p>') +
        `<p class="tiny" style="margin:12px 0 0">Z ${r.totalN} jedál a ${r.symptomCount} záznamov ťažkostí. Ťažkosti prišli po ${pct(r.baseRate)} jedál.</p></div>`;

      // pôvodné podrobné výpočty ostávajú, ale zbalené
      h += `<details class="calc"><summary>Všetky výpočty</summary>`;
      h += `<div class="card"><h2>Jedlá a suroviny</h2>`;
      h += resList(r.foods, 'meal', `Zatiaľ žiadna surovina nemá ${minN} výskytov.`);
      h += pendingList(r.foodsPending, minN, true) + '</div>';

      if (r.ctx.length || r.ctxPending.length) {
        h += `<div class="card"><h2>Skupiny a okolnosti jedla</h2>`;
        h += resList(r.ctx, 'meal');
        h += pendingList(r.ctxPending, minN, false) + '</div>';
      }

      h += `<div class="card"><h2>Rizikové jedlo – kedy vadí viac</h2>`;
      if (!riskTags().length) {
        h += `<p class="small muted" style="margin:0">Nastav si svoje intolerancie v <b>Nastaveniach</b>. Potom tu uvidíš, či rizikové jedlo vadí viac
          keď nie je z domu, pri strese, počas menštruácie a či pomáha enzým.</p>`;
      } else if (!r.riskCtx.length) {
        h += `<p class="small muted" style="margin:0">Zatiaľ málo rizikových jedál na porovnanie (treba aspoň 3 v každej skupine).</p>`;
      } else {
        h += `<p class="tiny" style="margin:0 0 6px">Porovnáva len jedlá s tvojimi rizikovými surovinami. Zelená = ťažkosti zriedkavejšie.</p>`;
        h += r.riskCtx.map(x => resItem(x.ratio < 0.7 && x.withN >= 3 ? Object.assign({}, x, { level: 'good' }) : x, 'risk')).join('');
      }
      h += '</div>';

      if (r.stacking.length) {
        h += `<div class="card"><h2>Hromadenie</h2><p class="tiny" style="margin:0 0 6px">Vadí, keď sa tá istá skupina za 12 h nazbiera viackrát?</p>`;
        h += resList(r.stacking, 'stack');
        h += '</div>';
      }

      if (r2 && r2.totalN >= 10) {
        const late = r2.foods.concat(r2.ctx.filter(x => x.key.startsWith('tag:'))).filter(x => x.level !== 'none').sort((a, b) => b.ratio - a.ratio || b.rateWith - a.rateWith);
        h += `<div class="card"><h2>Na druhý deň (12–48 h)</h2><p class="tiny" style="margin:0 0 6px">Niektoré intolerancie sa prejavia až neskôr. Tu sú jedlá, po ktorých prišli ťažkosti o 12–48 h.</p>`;
        h += late.length ? late.slice(0, 15).map(x => resItem(x, 'meal')).join('') : '<p class="muted small" style="margin:4px 0">Nič výrazné.</p>';
        h += '</div>';
      }
      h += '</details>';
      if (r.skipped) h += `<p class="foot">${r.skipped} jedál nie je zarátaných, lebo v ten deň nie sú zapísané ťažkosti ani „Deň bez ťažkostí“.</p>`;
    }

    if (insTab === 'good') {
      h += `<div class="card"><h2>Čo znášam dobre</h2>` + (tol.length
        ? `<p class="tiny" style="margin:0 0 6px">Po týchto jedlách prichádzajú ťažkosti zriedkavo.</p>` +
          tol.map(x => `<div class="res lvl-good"><div class="res-top"><span class="res-name">${esc(resName(x))}</span><span class="ratio">${x.withHit} z ${x.withN}</span></div>
            <div class="res-txt">Ťažkosti prišli po <b>${x.withHit} z ${x.withN}</b> jedál. Po ostatných ${x.outHit} z ${x.outN}.</div></div>`).join('')
        : '<p class="small muted" style="margin:0">Zatiaľ málo údajov. Objavia sa tu jedlá, po ktorých býva pokoj.</p>') + '</div>';
      const goodCtx = r.riskCtx.filter(x => x.ratio < 0.7 && x.withN >= 3);
      if (goodCtx.length) {
        h += `<div class="card"><h2>Kedy rizikové jedlo vadí menej</h2>` + goodCtx.map(x => resItem(Object.assign({}, x, { level: 'good' }), 'risk')).join('') + '</div>';
      }
      const bw = Analysis.bestWorst ? Analysis.bestWorst(entries, days) : null;
      if (bw && bw.onlyBest.length) {
        h += `<div class="card"><h2>Jedlo sa len v najlepších dňoch</h2><p class="tiny" style="margin:0 0 8px">Najlepšie dni: ${bw.best.map(fmtDayHead).join(', ')}.</p>
          <div class="pending">${bw.onlyBest.map(x => `<span class="good">${esc(x.key.startsWith('tag:') ? tagLabel(x.label) : x.label)}</span>`).join('')}</div></div>`;
      }
    }

    if (insTab === 'days') {
      if (r.loads && r.loads.length) {
        h += `<div class="card"><h2>Dávka za deň</h2><p class="tiny" style="margin:0 0 6px">Pri intoleranciách rozhoduje množstvo. Porovnáva dni, keď sa skupina nazbierala (2 a viac porcií), s ostatnými. Veľká porcia sa ráta viac, s enzýmom menej.</p>`;
        h += resList(r.loads, 'load');
        h += '</div>';
      }
      h += `<div class="card"><h2>Okolnosti dňa</h2><p class="tiny" style="margin:0 0 6px">Porovnáva dni s ťažkosťami a bez nich (${r.dayTotal} dní s údajmi).</p>`;
      h += (r.days.length ? resList(r.days, 'day') : '<p class="small muted" style="margin:0">Zatiaľ málo údajov o spánku, pohybe, pití a menštruácii.</p>');
      h += pendingList(r.daysPending, minN, false) + '</div>';
      h += bestWorstHtml();
    }

    el.innerHTML = h + note;
  }

  // ---------- Prehľad pre lekára ----------
  function buildReport() {
    const all = [...entries].sort((a, b) => a.ts - b.ts);
    if (!all.length) return null;
    const now = Date.now();
    const from = Math.max(all[0].ts, now - 30 * DAY);
    const E = all.filter(e => e.ts >= from);
    const dset = new Set(E.map(e => dayOf(e.ts)));
    const sym = E.filter(e => e.type === 'symptom');
    const symDays = new Set(sym.map(e => dayOf(e.ts)));
    const top = (arr, n) => {
      const m = new Map();
      arr.filter(Boolean).forEach(x => m.set(x, (m.get(x) || 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 6).map(([k, v]) => k + ' ' + v + '×').join(', ') || '–';
    };
    const fd = ts => { const d = new Date(ts); return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(); };
    const part = ts => { const h = new Date(ts).getHours(); return h < 5 ? 'v noci' : h < 11 ? 'ráno' : h < 17 ? 'cez deň' : h < 23 ? 'večer' : 'v noci'; };
    const sevs = sym.map(e => e.severity).filter(x => x != null);
    const r = Analysis.analyze(entries, days, { fromH: 0, toH: 6, minN: meta.minN || 5, riskTags: riskTags() });
    const line = x => `${resName(x)}: ťažkosti ${x.withHit} z ${x.withN} (${pct(x.rateWith)}), inak ${pct(x.rateWithout)}`;
    const sus = r.foods.concat(r.ctx).filter(x => x.level !== 'none').sort((a, b) => b.ratio - a.ratio).slice(0, 8);
    const dayF = r.days.concat(r.loads || []).filter(x => x.level !== 'none');
    const S = [];
    S.push(['Obdobie', [`${fd(from)} – ${fd(now)}`, `Záznamy v ${dset.size} dňoch, ${E.filter(e => e.type === 'food').length} jedál a nápojov`]]);
    S.push(['Ťažkosti', sym.length ? [
      `${sym.length} záznamov v ${symDays.size} dňoch z ${dset.size}`,
      sevs.length ? `Sila (1–10): priemer ${(sevs.reduce((a, b) => a + b, 0) / sevs.length).toFixed(1).replace('.', ',')}, najviac ${Math.max(...sevs)}` : '',
      'Druh: ' + top(sym.flatMap(e => e.kinds || [])),
      'Čas dňa: ' + top(sym.map(e => part(e.ts))),
      'Miesto: ' + top(sym.map(e => e.location ? lab(LOCATION, e.location) : '')),
      'Trvanie: ' + top(sym.map(e => e.duration)),
    ].filter(Boolean) : ['Žiadne záznamy ťažkostí']]);
    S.push(['Stolica', [top(E.filter(e => e.type === 'stool').map(e => e.stool ? lab(STOOL, e.stool) : e.desc), 7)]]);
    S.push(['Známe intolerancie', [riskTags().map(t => tagLabel(t)).join(', ') || 'neuvedené']]);
    const merged = computeSuspects().slice(0, 6);
    S.push(['Podozrenia (spojené výpočty)', merged.length ? merged.map(m => `${m.name} – ${VERDICT_TXT[m.verdict].toLowerCase()}${m.top ? ', ' + susRatio(m) : ''}: ` +
      m.sig.filter(g => SIG_W[g.kind] && g.x.level !== 'none').map(g => sigSentence(g, m)).join(' ')) : ['Zatiaľ nič výrazné alebo málo údajov']]);
    if (sus.length) S.push(['Po čom prichádzajú ťažkosti častejšie (do 6 h po jedle)', sus.map(line)]);
    const tol = toleratedList(r);
    if (tol.length) S.push(['Čo znáša dobre', [tol.map(x => resName(x) + ' (' + x.withHit + ' z ' + x.withN + ')').join(', ')]]);
    if (dayF.length) S.push(['Okolnosti dňa', dayF.map(x => `${resName(x)}: ťažkosti ${x.withHit} z ${x.withN} dní, inak ${x.outHit} z ${x.outN}`)]);
    if (findings().length) S.push(['Vlastné zistenia', findings().map(f => `${f.text} – ${FND_TXT[f.status]}${f.note ? ' (' + f.note + ')' : ''}`)]);
    S.push(['Lieky a iné', [top(E.filter(e => e.type === 'med').map(e => e.desc), 8)]]);
    return S;
  }

  function reportText(S) {
    return 'DENNÍK JEDLA A TRÁVENIA – PREHĽAD\n\n' + S.map(([h, l]) => h.toUpperCase() + '\n' + l.map(x => '• ' + x.replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, '').trim()).join('\n')).join('\n\n') +
      '\n\nÚdaje zapísala pacientka sama. Súvislosti sú len časová zhoda, nie diagnóza.';
  }

  // Grafy do prehľadu: sila ťažkostí po dňoch (30 dní) a stolica podľa Bristolskej škály
  function reportCharts() {
    const today = parseDay(todayStr()).getTime();
    const ix = dayIndex();
    const N = 30, W = 300, Hh = 90, bw = W / N;
    let bars = '';
    for (let i = 0; i < N; i++) {
      const d = dateStr(today - (N - 1 - i) * DAY + 12 * 3600e3);
      const sev = ix.sev[d], x = (i * bw + 1).toFixed(1);
      if (sev) {
        const h = (sev / 10 * (Hh - 14)).toFixed(1);
        bars += `<rect x="${x}" y="${(Hh - 12 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h}" rx="1.5" fill="${sevColor(sev)}"><title>${fmtDayHead(d)}: ${sev}/10</title></rect>`;
      } else if (days[d] && days[d].noSymptoms) {
        bars += `<circle cx="${(i * bw + bw / 2).toFixed(1)}" cy="${Hh - 15}" r="2.2" fill="var(--food)"><title>${fmtDayHead(d)}: bez ťažkostí</title></circle>`;
      }
    }
    const tick = (i, t) => `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${Hh - 1}" text-anchor="middle">${t}</text>`;
    const d0 = new Date(today - (N - 1) * DAY), dm = new Date(today - 15 * DAY), d1 = new Date(today);
    const lab = d => d.getDate() + '. ' + (d.getMonth() + 1) + '.';
    let h = `<h3>Ťažkosti za posledných 30 dní</h3><svg class="rchart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Najsilnejšie ťažkosti v jednotlivých dňoch">
      <line x1="0" y1="${Hh - 12}" x2="${W}" y2="${Hh - 12}" stroke="var(--line)"/>
      <text x="0" y="8">10</text>${bars}${tick(0, lab(d0))}${tick(14, lab(dm))}${tick(N - 1, lab(d1))}</svg>
      <p class="tiny" style="margin:2px 0 0">Stĺpec = najsilnejšie ťažkosti v ten deň (1–10). Zelená bodka = deň bez ťažkostí.</p>`;
    const st = entries.filter(e => e.type === 'stool' && e.ts >= today - N * DAY && /^b[1-7]$/.test(e.stool || ''));
    if (st.length >= 3) {
      const cnt = [0, 0, 0, 0, 0, 0, 0];
      st.forEach(e => { cnt[Number(e.stool[1]) - 1]++; });
      const mx = Math.max(...cnt);
      h += `<h3>Stolica (Bristolská škála, ${st.length}×)</h3><div class="bristol">` + cnt.map((n, i) =>
        `<span>${i + 1}</span><span class="bbar"><i class="${i < 2 ? 'hard' : i < 4 ? 'ok' : 'soft'}" style="width:${mx ? Math.round(n / mx * 100) : 0}%"></i></span><span>${n}</span>`).join('') +
        '</div><p class="tiny" style="margin:2px 0 0">1–2 zápcha, 3–4 v poriadku, 5–7 riedka.</p>';
    }
    return h;
  }

  function openReport() {
    const S = buildReport();
    if (!S) { toast('Zatiaľ žiadne záznamy'); return; }
    $('#report-sheet').innerHTML = `<div class="sheet-head noprint"><h2>Prehľad pre lekára</h2><button type="button" class="x" data-act="report-close" aria-label="Zavrieť">✕</button></div>
      <div class="report"><h1>Denník jedla a trávenia – prehľad</h1>` + reportCharts() +
      S.map(([h, l]) => `<h3>${esc(h)}</h3><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('') +
      `<p class="tiny">Údaje zapísala pacientka sama. Súvislosti sú len časová zhoda, nie diagnóza.</p></div>
      <div class="savebar noprint"><button type="button" class="btn" data-act="report-share">Zdieľať ako text</button>
        <button type="button" class="btn primary" data-act="report-print">Tlačiť / PDF</button></div>`;
    openSheet('report-sheet');
  }

  async function shareReport() {
    const text = reportText(buildReport());
    try {
      if (navigator.share) { await navigator.share({ title: 'Denník jedla – prehľad', text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Skopírované ✓');
    } catch (ex) {
      if (!ex || ex.name !== 'AbortError') toast('Nepodarilo sa zdieľať');
    }
  }

  // ---------- Večerná pripomienka (udalosť do Kalendára) ----------
  // [id, text vo formulári, predvolená hodina, nadpis v Kalendári]
  const REMINDERS = [['ranaj', 'Po raňajkách', 9, 'Denník: zapíš raňajky'], ['obed', 'Po obede', 14, 'Denník: zapíš obed'],
    ['vecer', 'Večer (celý deň)', 20, 'Denník: aký bol dnešný deň?']];
  async function doReminder() {
    const chosen = REMINDERS.filter(([id]) => $('#rem-' + id) && $('#rem-' + id).checked);
    if (!chosen.length) { toast('Zapni aspoň jednu pripomienku'); return; }
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    const day = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate());
    const stamp = d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ev = chosen.map(([id, , , title]) => {
      const hh = z(Number($('#remh-' + id).value));
      return ['BEGIN:VEVENT', 'UID:pripomienka-' + id + '-' + hh + '@dennik-jedla', 'DTSTAMP:' + stamp, 'DTSTART:' + day + 'T' + hh + '0000', 'DURATION:PT5M',
        'RRULE:FREQ=DAILY', 'SUMMARY:' + title, 'DESCRIPTION:Otvor Denník jedla a zapíš to.', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + title,
        'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dennik-jedla//SK'].concat(ev, ['END:VCALENDAR']).join('\r\n');
    await saveFile('dennik-pripomienky.ics', 'text/calendar', ics);
  }


  // ---------- Záloha a export ----------
  async function saveFile(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    try {
      const file = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return true;
      }
    } catch (ex) {
      if (ex && ex.name === 'AbortError') return false;
      console.warn('share failed, fallback to download', ex);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return true;
  }

  async function doBackup() {
    if (!entries.length && !Object.keys(days).length) { toast('Zatiaľ nie je čo zálohovať'); return; }
    const settings = {};
    ['products', 'customTags', 'intol', 'favorites', 'fromH', 'toH', 'minN', 'findings', 'test', 'recipes', 'recurring', 'reintro'].forEach(k => { if (meta[k] !== undefined) settings[k] = meta[k]; });
    const data = { app: 'dennik-jedla', version: 2, exported: new Date().toISOString(), entries, days: Object.values(days), settings };
    const ok = await saveFile('dennik-zaloha-' + todayStr() + '.json', 'application/json', JSON.stringify(data, null, 1));
    if (ok) {
      await setMeta('lastBackup', Date.now());
      toast('Záloha uložená ✓');
      render();
    }
  }

  function csvCell(v) {
    if (v == null) return '';
    const s = String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv() {
    const head = ['Dátum', 'Čas', 'Typ', 'Popis', 'Sila', 'Trvanie', 'Stolica', 'Stres', 'Poznámka',
      'Nálada', 'Porcia', 'V zhone', 'Obsahovalo', 'Druh ťažkostí', 'Miesto', 'Spánok', 'Menštruácia', 'Pohyb', 'Pitie',
      'Odkiaľ jedlo', 'Enzým', 'Deň bez ťažkostí', 'Množstvo', 'Čiarový kód'];
    const rows = [head];
    [...entries].sort((a, b) => a.ts - b.ts).forEach(e => {
      const d = new Date(e.ts);
      const day = days[dayOf(e.ts)] || {};
      rows.push([
        d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(), fmtTime(e.ts), TYPES[e.type].csv, e.desc,
        e.severity != null ? e.severity : '', e.duration || '', e.stool ? lab(STOOL, e.stool) : '',
        e.stress != null ? e.stress : '', e.note || '',
        e.mood != null ? e.mood + ' (' + MOOD_TXT[e.mood] + ')' : '',
        e.portion ? lab(PORTION, e.portion) : '', e.type === 'food' ? (e.rushed ? 'áno' : 'nie') : '',
        e.type === 'food' ? Analysis.mealTags(e).map(t => { const x = TAGS.find(y => y[0] === t); return x ? x[2] : t; }).join(', ') : '',
        (e.kinds || []).join(', '), e.location ? lab(LOCATION, e.location) : '',
        day.sleep ? lab(SLEEP, day.sleep) : '', day.period != null ? (day.period ? 'áno' : 'nie') : '',
        day.activity ? lab(ACTIVITY, day.activity) : '', day.water ? lab(WATER, day.water) : '',
        e.place ? lab(PLACES, e.place) : '', e.type === 'food' ? (e.enzyme ? 'áno' : 'nie') : '',
        day.noSymptoms ? 'áno' : '', e.amount || '', e.product && e.product.code ? e.product.code : '',
      ]);
    });
    return '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  }

  async function doCsv() {
    if (!entries.length) { toast('Zatiaľ žiadne záznamy'); return; }
    await saveFile('dennik-jedla-' + todayStr() + '.csv', 'text/csv', buildCsv());
  }

  async function doImport(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (ex) { toast('Súbor sa nedá prečítať'); return; }
    if (!data || data.app !== 'dennik-jedla' || !Array.isArray(data.entries)) { toast('Toto nie je záloha denníka'); return; }
    const valid = data.entries.filter(e => e && e.id && TYPES[e.type] && typeof e.ts === 'number');
    const dayList = Array.isArray(data.days) ? data.days.filter(d => d && /^\d{4}-\d\d-\d\d$/.test(d.date)) : [];
    if (!confirm(`Načítať zálohu s ${valid.length} záznamami?\n\nSúčasné záznamy zostanú, rovnaké sa prepíšu verziou zo zálohy.`)) return;
    await DB.putMany('entries', valid);
    if (dayList.length) await DB.putMany('days', dayList);
    if (data.settings && typeof data.settings === 'object') {
      for (const k of ['products', 'customTags', 'intol', 'favorites', 'fromH', 'toH', 'minN', 'findings', 'test', 'recipes', 'recurring', 'reintro']) {
        if (data.settings[k] !== undefined && meta[k] === undefined) await setMeta(k, data.settings[k]);
      }
    }
    await load();
    toast('Obnovených ' + valid.length + ' záznamov ✓');
    renderSettings();
  }

  async function wipeAll() {
    if (!confirm('Naozaj vymazať VŠETKY záznamy z tohto telefónu?')) return;
    if (!confirm('Je to nevratné. Máš uloženú zálohu? Vymazať?')) return;
    await Promise.all([DB.clear('entries'), DB.clear('days'), DB.clear('meta')]);
    await load();
    toast('Všetko vymazané');
    renderSettings();
  }

  function srow(act, icon, color, title, sub, val, danger) {
    return `<button type="button" class="srow${danger ? ' danger' : ''}" data-act="${act}"><span class="si" style="background:var(--${color})">${ic(icon)}</span>
      <span class="st"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="sv">${val || ''}</span><span class="chev">›</span></button>`;
  }

  function renderSettings() {
    const el = $('#view-settings');
    const lb = meta.lastBackup;
    const lbTxt = lb ? 'Naposledy ' + daysAgoText(Math.floor((Date.now() - lb) / DAY)) +
      ' (' + new Date(lb).toLocaleDateString('sk-SK') + ')' : 'Zatiaľ žiadna záloha';
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const risk = TAGS.filter(([v]) => riskTags().includes(v)).map(x => x[2]);
    el.innerHTML = `<header class="lt"><div><h1>Nastavenia</h1></div><button type="button" class="help-q" data-act="help" data-sec="settings" aria-label="Pomocník">?</button></header>
      <h2 class="sub">Pomoc</h2><div class="dayrows">
        ${srow('help', 'q', 'accent', 'Pomocník', 'Čo znamená ktorá časť aplikácie')}
        ${srow('welcome', 'phone', 'food', 'Úvod znova', 'Krátke predstavenie denníka')}
      </div>
      <h2 class="sub">Moje jedlo</h2><div class="dayrows">
        ${srow('intol-edit', 'warn', 'sym', 'Moje intolerancie', esc(risk.join(', ')) || 'Zatiaľ nič vybrané', risk.length || '')}
        ${srow('favs', 'star', 'sun', 'Obľúbené jedlá', '', favorites().length || '')}
        ${srow('recipes', 'doc', 'food', 'Moje jedlá', 'Jedlá rozpísané na suroviny', recipes().length || '')}
        ${srow('rec-open', 'bell', 'med', 'Pravidelné záznamy', 'Napr. ranná káva, lieky', recurring().length || '')}
      </div>
      <h2 class="sub">Záloha</h2><div class="dayrows">
        ${srow('backup', 'save', 'accent', 'Uložiť zálohu', esc(lbTxt))}
        ${srow('restore', 'open', 'med', 'Obnoviť zo zálohy', '')}
      </div>
      <p class="foot">Údaje sú uložené len v tomto telefóne. Raz týždenne si ulož zálohu, napr. do aplikácie Súbory alebo na iCloud.</p>
      <h2 class="sub">Pre lekára</h2><div class="dayrows">
        ${srow('report', 'doc', 'food', 'Prehľad na jednu stranu', 'Krátke zhrnutie na vizitu')}
        ${srow('csv', 'table', 'stool', 'Všetky záznamy do tabuľky', 'Súbor CSV pre Excel alebo Numbers')}
      </div>
      <h2 class="sub">Ostatné</h2><div class="dayrows">
        ${srow('rem-open', 'bell', 'sun', 'Pripomienky', 'Raňajky, obed, večer cez Kalendár')}
        ${standalone ? '' : srow('install', 'phone', 'med', 'Pridať na plochu', 'Aby sa denník otváral ako aplikácia')}
        ${srow('shortcut', 'open', 'accent', 'Skratky a Siri', 'Zápis jedným ťuknutím z plochy')}
        ${srow('wipe', 'trash', 'danger', 'Vymazať všetky údaje', entries.length + ' záznamov, ' + Object.keys(days).length + ' dní s údajmi', '', true)}
      </div>
      <p class="foot" style="text-align:center">Denník jedla ${APP_VERSION} · funguje aj bez internetu</p>
      <p class="foot" style="text-align:center">Záznamy ostávajú len v telefóne. Pri skenovaní sa do databázy Open Food Facts pošle iba číslo čiarového kódu.</p>`;
  }

  function openInfo(kind) {
    let title, body;
    if (kind === 'favs') {
      const favs = favorites();
      title = 'Obľúbené jedlá';
      body = grp('', favs.length ? '<div class="fav-list">' + favs.map((f, i) => `<div class="fav-row"><span>${esc(f.desc)}</span>
          <button type="button" class="btn ghost small" data-act="fav-del" data-i="${i}" aria-label="Odobrať">✕</button></div>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Pri zápise jedla ťukni na hviezdičku vedľa názvu. Potom ho zapíšeš jedným ťuknutím.</p>');
    } else if (kind === 'recipes') {
      const list = recipes();
      title = 'Moje jedlá';
      body = grp('', '<p class="small muted" style="margin:0 0 12px">Jedlo, ktoré často varíš, rozpíš na suroviny. Keď ho potom zapíšeš len názvom, suroviny sa zarátajú do vyhodnotenia.</p>' +
        `<input type="text" id="rc-name" placeholder="Názov, napr. mamine halušky" enterkeyhint="next">
         <input type="text" id="rc-ing" style="margin-top:8px" placeholder="Suroviny, napr. halušky, bryndza, slanina" enterkeyhint="done">
         <button type="button" class="btn block" style="margin-top:10px" data-act="rc-add">Pridať jedlo</button>`) +
        (list.length ? grp('Uložené', '<div class="fav-list">' + list.map((r, i) => `<div class="fav-row"><span>${esc(r.name)}<br><span class="tiny">${esc(r.ingredients)}</span></span>
          <button type="button" class="btn ghost small" data-act="rc-del" data-i="${i}" aria-label="Zmazať">✕</button></div>`).join('') + '</div>') : '');
    } else if (kind === 'rec') {
      const list = recurring();
      title = 'Pravidelné záznamy';
      body = grp('', list.length ? '<div class="fav-list">' + list.map(r => `<div class="fav-row"><span>${esc(r.desc)} <span class="tiny">${pad(r.h)}:${pad(r.m)}</span></span>
          <button type="button" class="btn ghost small" data-act="rec-del" data-id="${r.id}" aria-label="Zrušiť">✕</button></div>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Pri zápise jedla alebo lieku zapni „Opakovať každý deň“. Napríklad ranná káva alebo večerné probiotiká.</p>');
    } else if (kind === 'rem') {
      title = 'Pripomienky';
      const opt = (id, sel) => `<select id="${id}">${[...Array(17)].map((_, i) => i + 6).map(h => `<option value="${h}"${h === sel ? ' selected' : ''}>${pad(h)}:00</option>`).join('')}</select>`;
      body = grp('', `<p class="small muted" style="margin:0">Denník je webová stránka a tie v iPhone nemôžu samy plánovať upozornenia. Preto pripomienky pridá do <b>Kalendára</b>:
          ten ich potom pripomenie každý deň, aj keď je denník zatvorený.</p>`) +
        grp('Kedy pripomenúť', REMINDERS.map(([id, label, h]) => `<div class="rem-row">${sw('rem-' + id, label, id === 'vecer')}${opt('remh-' + id, h)}</div>`).join('') +
          `<button type="button" class="btn block" style="margin-top:12px" data-act="reminder">Pridať do Kalendára</button>`) +
        '<p class="tiny" style="margin:0 4px 12px">Ak si pripomienky už raz pridala, staré v Kalendári zmaž, aby neprišli dvakrát. Navyše ti denník po otvorení sám povie, ak niečo chýba (napríklad obed).</p>';
    } else {
      title = 'Pridať na plochu';
      body = grp('', `<ol class="steps small"><li>Otvor túto stránku v <b>Safari</b>.</li><li>Ťukni na tlačidlo <b>Zdieľať</b> (štvorec so šípkou).</li>
        <li>Vyber <b>Pridať na plochu</b> a potvrď.</li><li>Odteraz otváraj denník len ikonou na ploche. Safari a ikona majú oddelené údaje.</li></ol>`);
    }
    if (kind === 'shortcut') {
      title = 'Skratky a Siri';
      const row = (ty, l) => `<div class="fav-row"><span>${l}<br><span class="tiny link-txt">${esc(appLink(ty))}</span></span>
        <button type="button" class="btn ghost small" data-act="copy-link" data-ty="${ty}">Kopírovať</button></div>`;
      body = grp('Android', '<p class="small muted" style="margin:0">Podrž prst na ikone denníka na ploche. Ponúkne Zapísať jedlo, ťažkosti alebo stolicu.</p>') +
        grp('iPhone', `<ol class="steps small"><li>Otvor aplikáciu <b>Skratky</b> a ťukni na <b>＋</b>.</li><li>Pridaj akciu <b>Otvoriť URL</b> a vlož odkaz nižšie.</li>
          <li>Skratku pomenuj, napr. „Zapíš jedlo“. Potom stačí povedať „Hej Siri, zapíš jedlo“ alebo ju dať na plochu.</li></ol>
          <div class="fav-list" style="margin-top:10px">${row('food', 'Zapísať jedlo')}${row('symptom', 'Zapísať ťažkosti')}${row('stool', 'Zapísať stolicu')}</div>
          <p class="tiny" style="margin:8px 0 0">Skratka otvorí denník v Safari. Ak používaš ikonu na ploche, údaje sú tam zvlášť, preto je pohodlnejší Android alebo zápis cez ikonu.</p>`);
    }
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>${title}</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>${body}
      <div class="savebar"><button type="button" class="btn primary" data-act="mini-close">Hotovo</button></div>`;
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

  function openIntol() {
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>Čo ti vadí?</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>` +
      grp('', '<div class="chips col pick">' + TAGS.map(([v, e, t]) =>
        `<button type="button" class="chip${riskTags().includes(v) ? ' on' : ''}" data-intol="${v}">${esc(t)}</button>`).join('') + '</div>') +
      grp('Iné, čo v zozname nie je', `<div class="desc-row"><input type="text" id="ct-text" placeholder="napr. paradajky" enterkeyhint="done">
          <button type="button" class="btn small primary" data-act="ct-add">Pridať</button></div>
        <p class="tiny" style="margin:8px 0 0">Aplikácia to slovo odteraz hľadá v popise jedla (aj v starších záznamoch) a ráta s ním vo vyhodnotení rovnako ako s ostatnými.</p>
        ${customTags().length ? '<div class="fav-list" style="margin-top:10px">' + customTags().map(c => `<div class="fav-row"><span>${esc(c.label)}</span>
          <button type="button" class="btn ghost small" data-act="ct-del" data-id="${c.id}" aria-label="Zmazať">✕</button></div>`).join('') + '</div>' : ''}`) +
      `<div class="savebar"><button type="button" class="btn primary" data-act="mini-close">Hotovo</button></div>`;
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

  // ---------- Úvod pri prvom spustení ----------
  // Tri krátke obrazovky. Ukáže sa raz, potom už len z Pomocníka („Úvod znova“).
  let welcomeStep = 0;
  function welcomeHtml() {
    const risk = riskTags();
    const steps = [
      `<div class="wl-ico">${ic('food')}</div><h2>Vitaj v Denníku jedla</h2>
        <p>Zapisuješ, čo ješ a kedy ťa trápi brucho. Denník potom sám hľadá, po čom sú ťažkosti častejšie a po čom je pokoj.</p>
        <p class="muted">Všetko ostáva len v tomto telefóne. Nič sa nikam neposiela.</p>`,
      `<div class="wl-ico">${ic('check')}</div><h2>Čo zapisovať</h2>
        <ul class="why wl-list"><li><b>Jedlo a pitie</b> tlačidlom ＋ dole, čo najskôr po jedle.</li>
          <li><b>Ťažkosti</b> hneď, keď prídu. Stačí ťuknúť na číslo 1 až 10 na obrazovke Dnes.</li>
          <li><b>Večer „Deň bez ťažkostí“</b>, ak nebolo nič. Je to rovnako dôležité.</li></ul>
        <p class="muted">Prvé výsledky budú asi po dvoch týždňoch. Ak niečomu nerozumieš, ťukni na ? pri nadpise.</p>`,
      `<div class="wl-ico">${ic('warn')}</div><h2>Vieš, čo ti vadí?</h2>
        <p>Označ, čo už tušíš. Denník na to upozorní pri zápise a bude to sledovať podrobnejšie.</p>
        <div class="chips">${TAGS.filter(x => !x[0].startsWith('c_')).map(([v, e, t]) => `<button type="button" class="chip${risk.includes(v) ? ' on' : ''}" data-intol="${v}">${esc(t)}</button>`).join('')}</div>
        <p class="muted">Nevieš? Nevadí, nastavíš to neskôr v Nastaveniach.</p>`,
    ];
    const last = welcomeStep === steps.length - 1;
    return `<div class="welcome">${steps[welcomeStep]}</div>
      <div class="wl-dots">${steps.map((_, i) => `<i class="${i === welcomeStep ? 'on' : ''}"></i>`).join('')}</div>
      <div class="savebar">${last ? '' : '<button type="button" class="btn" data-act="wl-done">Preskočiť</button>'}
        <button type="button" class="btn primary" data-act="${last ? 'wl-done' : 'wl-next'}">${last ? 'Začať' : 'Ďalej'}</button></div>`;
  }
  function openWelcome() {
    welcomeStep = 0;
    // ukáže sa len raz, aj keď ho používateľ zavrie potiahnutím
    if (!meta.onboarded) setMeta('onboarded', true).catch(() => {});
    $('#mini-sheet').innerHTML = welcomeHtml();
    if (openSheets.includes('help-sheet')) closeSheet('help-sheet');
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

  // ---------- Pomocník ----------
  // Vysvetlenie každej časti aplikácie; hľadá sa podľa názvu, ktorý používateľ vidí na obrazovke.
  const HELP_SECS = [['today', 'Dnes'], ['entry', 'Zápis (tlačidlo ＋)'], ['list', 'Kalendár'], ['insights', 'Súvislosti'], ['mine', 'Súvislosti – Moje'], ['settings', 'Nastavenia']];
  const HELP = [
    ['today', 'Pásik dní', 'Posledné týždne. Ťuknutím otvoríš deň. Bodka pod dňom: zelená = bez ťažkostí, žltá, oranžová, červená = slabé, stredné, silné ťažkosti, sivá = niečo zapísané, ale nevieme, či boli ťažkosti.'],
    ['today', 'Stuha dňa', 'Celý deň na jednej čiare. Zelené čiarky hore sú jedlá, farebné krúžky dole ťažkosti (väčší = silnejšie). Prerušovaná čiara je teraz. Deň trvá od 4:00 do 4:00, takže neskorá večera patrí k správnemu dňu.'],
    ['today', 'Rizikové suroviny v tento deň', 'Koľkokrát si v ten deň zjedla niečo z tvojich intolerancií (nastavuješ ich v Nastaveniach).'],
    ['today', 'Máš teraz ťažkosti?', 'Najrýchlejší zápis: ťukni na číslo 1 až 10 a ťažkosti sú zapísané s aktuálnym časom. Druh a miesto môžeš doplniť cez „Doplniť“ v ozname.'],
    ['today', 'Chýba obed? (raňajky, večera)', 'Ak v dni so záznamami chýba bežné jedlo, denník sa spýta. Ťuknutím ho zapíšeš s typickým časom, ktorý môžeš zmeniť. Ak si naozaj nejedla, nič nerob.'],
    ['today', 'Pravidelné', 'Veci, ktoré si nastavila na každý deň (napr. ranná káva, probiotiká). Keď sa blíži ich čas, zapíšeš ich jedným ťuknutím.'],
    ['today', 'Aký bol dnešný deň?', 'Spánok, menštruácia, pohyb a pitie raz za deň. Nepovinné, ale pomáha zistiť, či ťažkosti nesúvisia s dňom, nielen s jedlom.'],
    ['today', 'Deň bez ťažkostí', 'Ťukni večer, ak v ten deň nebolo nič. Je to rovnako dôležité ako zapisovať ťažkosti: bez toho denník nevie, či bol deň pokojný, alebo si len nezapisovala.'],
    ['today', 'Tvoj týždeň', 'V nedeľu večer až v utorok zhrnutie týždňa: koľko dní bolo s ťažkosťami v porovnaní s minulým týždňom a jedna rada. Krížikom ho skryješ.'],
    ['today', 'Zavádzanie (pruh hore)', 'Prebieha opätovné zavedenie: každý deň ti povie, akú porciu zjesť. Po zjedení ťukni „Zjedla som“ a sleduj ťažkosti. Viac v časti Súvislosti – Moje.'],
    ['entry', 'Typ záznamu', 'Hore prepínaš Jedlo, Ťažkosti, Stolica a Lieky. Napísaný text sa pri prepnutí nestratí.'],
    ['entry', 'Ako včera', 'Čo si včera zapísala v podobnom čase. Jedným ťuknutím to isté dnes.'],
    ['entry', 'Naposledy jedené', 'Časté jedlá, ráno najmä raňajky, na obed obedy. Ťuknutím na viac položiek sa pridajú za seba, druhým ťuknutím položku odoberieš. Hviezdička vedľa názvu uloží jedlo medzi obľúbené.'],
    ['entry', 'Kedy?', '„teraz“, „–30 min“ a ďalšie posunú čas. Iný dátum a čas nastavíš v políčkach pod tým.'],
    ['entry', 'Koľko?', 'Veľkosť porcie. Pri intoleranciách často rozhoduje množstvo, preto sa veľká porcia ráta viac a malá menej.'],
    ['entry', 'Obsahovalo (skupiny potravín)', 'Skupiny ako mliečne, lepok, cibuľa a cesnak. Značka ✦ znamená, že ich denník rozpoznal z popisu sám. Ťuknutím skupinu zrušíš alebo pridáš.'],
    ['entry', 'Laktáza / enzým', 'Zapni, ak si k jedlu vzala tabletku laktázy alebo iný enzým. Vyhodnotenie potom ukáže, či pomáha.'],
    ['entry', 'Jedla som v zhone', 'Jedenie v rýchlosti niekedy samo zhorší trávenie. Denník to porovná.'],
    ['entry', 'Odkiaľ je jedlo?', 'Kto jedlo pripravil: uvarené doma, reštaurácia alebo jedáleň, u niekoho na návšteve, alebo kúpené hotové v obchode či bufete. Ukáže, či vadí skôr jedlo, ktoré nie je z domu (iné suroviny, viac tuku, skryté zloženie).'],
    ['entry', 'Opakovať každý deň', 'Pri jedle alebo lieku, ktoré berieš denne. Na obrazovke Dnes sa potom ukáže na zápis jedným ťuknutím.'],
    ['entry', 'Stres, nálada, poznámka', 'Nepovinné. Stres a nálada pri jedle môžu ovplyvniť trávenie.'],
    ['entry', 'Aké silné? (ťažkosti)', '1 je slabé, 10 neznesiteľné. Farba sa mení od zelenej po červenú.'],
    ['entry', 'Stolica: Bristolská škála', 'Škála, ktorú používajú lekári: 1–2 zápcha, 3–4 v poriadku, 5–7 riedka.'],
    ['entry', 'Skenovanie čiarového kódu', 'Pri balených výrobkoch načíta názov a zloženie z databázy Open Food Facts. Posiela sa tam len číslo kódu.'],
    ['entry', 'Zapísať znova teraz', 'Pri úprave jedla alebo lieku: zapíše to isté s dnešným časom.'],
    ['list', 'Farby v kalendári', 'Zelená = deň bez ťažkostí, žltá, oranžová, červená = slabé, stredné, silné ťažkosti, sivá = zapísané, ale nevieme o ťažkostiach. Ružová bodka = menštruácia.'],
    ['list', 'Hľadať v denníku', 'Napíš jedlo alebo slovo a ukážu sa všetky záznamy, kde sa vyskytuje.'],
    ['insights', 'Hlavné podozrenie', 'Jedlo alebo skupina, ktorá najviac vyzerá, že súvisí s ťažkosťami. Spája všetky výpočty dokopy (po jedle, za deň, na druhý deň, najhoršie dni), aby si výsledky neodporovali.'],
    ['insights', 'Číslo 2,1× (koľkokrát)', '2× znamená, že po tomto jedle prišli ťažkosti dvakrát častejšie ako po ostatných. „Výrazne“ znamená, že inak sa ťažkosti v sledovanom čase neobjavili vôbec.'],
    ['insights', 'Bodky: málo údajov, náznak, silnejší vzorec', 'Koľko údajov je za číslom. Jedna bodka je málo, tri sú silnejší vzorec. Pri jednej bodke ešte nič neuzatváraj.'],
    ['insights', 'Podrobnosti podozrivého', 'Všetky výpočty k jednému jedlu, graf za koľko hodín po jedle prišli ťažkosti a zoznam konkrétnych jedál. Ťuknutím na jedlo otvoríš ten deň.'],
    ['insights', 'Za koľko po jedle prišli ťažkosti', 'Červené pruhy: po tomto jedle. Sivé: po ostatných jedlách. Ak sú ťažkosti po jedle častejšie v istom čase (napr. 1–2 h), je to silnejšia stopa.'],
    ['insights', 'Ďalšie podozrenia', 'Ďalšie jedlá a okolnosti, ktoré vyzerajú podozrivo, ale slabšie.'],
    ['insights', 'Najlepšie znášané', 'Jedlá, po ktorých ťažkosti prichádzajú zriedkavo.'],
    ['insights', 'Zatiaľ málo údajov', 'Jedlá, ktoré ešte neboli zjedené dosť často (štandardne 5×). Vyhodnotia sa, keď údaje pribudnú.'],
    ['insights', 'Všetky výpočty', 'Pôvodné podrobné tabuľky: jedlá, skupiny, rizikové jedlo, hromadenie, na druhý deň.'],
    ['insights', 'Skupiny a okolnosti jedla', 'Skupiny potravín (mliečne, lepok…) a okolnosti: jedlo po 20:00, po dlhej pauze, káva ako prvé za deň, v zhone, odkiaľ je jedlo.'],
    ['insights', 'Rizikové jedlo – kedy vadí viac', 'Porovnáva len jedlá s tvojimi intoleranciami: vadia viac, keď nie sú z domu, pri strese, počas menštruácie, po zlom spánku? A pomáha enzým?'],
    ['insights', 'Hromadenie', 'Vadí, keď sa tá istá skupina za 12 hodín zje viackrát?'],
    ['insights', 'Na druhý deň (12–48 h)', 'Niektoré intolerancie sa prejavia až neskôr. Tu sú jedlá, po ktorých prišli ťažkosti o 12 až 48 hodín.'],
    ['insights', 'Dávka za deň', 'Porovnáva dni, keď sa skupina nazbierala (2 a viac porcií), s ostatnými. Ak vadí až väčšie množstvo, ukáže sa to tu, aj keď jedno jedlo samo nevadí.'],
    ['insights', 'Okolnosti dňa', 'Dni so zlým spánkom, menštruáciou, bez pohybu, s málo pitia, a fázy cyklu: dni pred menštruáciou (luteálna fáza) a po nej (folikulárna).'],
    ['insights', 'Najhoršie a najlepšie dni', 'Čo sa jedlo len v najhorších dňoch a čo len v najlepších. „Bolo v oboch“ zvyčajne nerozhoduje, pokiaľ nevadí až väčšie množstvo.'],
    ['mine', 'Moje zistenia', 'Tvoj vlastný zoznam: čo vadí, čo nevadí a čo je podozrivé. Zapíšeš ho z výsledkov tlačidlom „Zapísať zistenie“ alebo ručne.'],
    ['mine', 'Test podozrivého (vynechanie)', 'Čísla ukážu len podozrenie. Istotu dá test: jednu vec na 7 až 21 dní vynechať a porovnať dni s ťažkosťami pred testom a počas neho. Vždy len jednu vec naraz.'],
    ['mine', 'Opätovné zavedenie', 'Keď bolo bez niečoho lepšie, vráti sa to späť: 3 dni po sebe malá, bežná a väčšia porcia. Denník sleduje ťažkosti 24 h po každej dávke a povie, či to vadí a od akého množstva. Pri alergii to nerob.'],
    ['mine', 'Prehľad pre lekára', 'Zhrnutie posledných 30 dní na jednu stranu: graf ťažkostí, stolica, podozrenia, zistenia a lieky. Dá sa vytlačiť, uložiť ako PDF alebo poslať ako text.'],
    ['mine', 'Nastavenie výpočtu', 'Za koľko hodín po jedle sa ťažkosti priradia k jedlu (štandardne 0–6 h) a koľkokrát treba jedlo zjesť, kým sa vyhodnotí (štandardne 5×).'],
    ['settings', 'Moje intolerancie', 'Suroviny, o ktorých vieš, že ti vadia. Denník na ne upozorní pri zápise a vo výsledkoch ich sleduje podrobnejšie.'],
    ['settings', 'Moje jedlá', 'Jedlo, ktoré často varíš, rozpíšeš na suroviny (napr. mamine halušky = halušky, bryndza, slanina). Keď ho potom zapíšeš len názvom, suroviny sa zarátajú.'],
    ['settings', 'Pravidelné záznamy', 'Zoznam vecí, ktoré sa opakujú každý deň. Tu ich môžeš zrušiť.'],
    ['settings', 'Záloha', 'Údaje sú len v tomto telefóne. Raz týždenne ulož zálohu (napr. do Súborov alebo na iCloud). Ak telefón stratíš alebo vymažeš údaje Safari, bez zálohy sú preč.'],
    ['settings', 'Všetky záznamy do tabuľky', 'Súbor CSV pre Excel alebo Numbers, napríklad pre lekára alebo výživového poradcu.'],
    ['settings', 'Pripomienky', 'Aplikácia na webe sama upozorniť nevie. Pripomienky preto pridá do Kalendára v iPhone a upozornenie pošle Kalendár.'],
    ['settings', 'Skratky a Siri', 'Zápis jedným ťuknutím z plochy (Android: podrž ikonu) alebo cez aplikáciu Skratky na iPhone.'],
  ];
  const normH = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function openHelp(sec) {
    const secs = HELP_SECS.map(([k, l]) => {
      const items = HELP.filter(x => x[0] === k);
      return `<section class="help-sec" data-hs="${k}"><h3>${l}</h3>` + items.map(([, t, txt]) =>
        `<details class="help-item" data-ht="${esc(normH(t + ' ' + txt))}"${sec && k === sec ? '' : ''}><summary>${esc(t)}</summary><p>${esc(txt)}</p></details>`).join('') + '</section>';
    }).join('');
    $('#help-sheet').innerHTML = `<div class="sheet-head"><h2>Pomocník</h2><button type="button" class="x" data-act="help-close" aria-label="Zavrieť">✕</button></div>
      <input type="search" id="help-q" placeholder="Hľadať, napr. bodky, dávka, odkiaľ" enterkeyhint="search">
      <div class="help-tabs">${HELP_SECS.map(([k, l]) => `<button type="button" class="chip${k === sec ? ' on' : ''}" data-hsec="${k}">${l.replace(' (tlačidlo ＋)', '')}</button>`).join('')}</div>
      <div id="help-list">${secs}</div><p class="help-none" hidden>Nič sa nenašlo. Skús iné slovo.</p>
      <div class="savebar"><button type="button" class="btn" data-act="welcome">Úvod znova</button><button type="button" class="btn primary" data-act="help-close">Hotovo</button></div>`;
    openSheet('help-sheet');
    if (sec) jumpHelp(sec);
  }
  function jumpHelp(sec) {
    $$('[data-hsec]').forEach(c => c.classList.toggle('on', c.dataset.hsec === sec));
    const el = $(`.help-sec[data-hs="${sec}"]`);
    if (el) $('#help-sheet').scrollTop = el.offsetTop - 140;
  }
  function filterHelp(q) {
    const n = normH(q.trim());
    let any = false;
    $$('.help-item').forEach(d => {
      const hit = !n || d.dataset.ht.includes(n);
      d.hidden = !hit;
      if (n && hit) d.open = true;
      if (!n) d.open = false;
      any = any || hit;
    });
    $$('.help-sec').forEach(s => { s.hidden = ![...s.querySelectorAll('.help-item')].some(d => !d.hidden); });
    $('.help-none').hidden = any;
  }

  // ---------- Udalosti ----------
  buildShell();

  document.addEventListener('click', async ev => {
    const t = ev.target;

    if (t.id === 'scrim') { dismissTop(); return; }

    const tab = t.closest('.tab');
    if (tab) {
      if (tab.dataset.view === 'today' && currentView === 'today' && selDay !== todayStr()) { goDay(todayStr()); return; }
      switchView(tab.dataset.view);
      return;
    }

    const pick = t.closest('[data-pick]');
    if (pick) { todayExpanded = false; goDay(pick.dataset.pick); return; }

    const typeBtn = t.closest('.type-btn');
    if (typeBtn) {
      const ty = typeBtn.dataset.type;
      if (draft.type === ty) return;
      if (editingId) draft.type = ty;
      else {
        // pri zmene typu ostane napísaný text, poznámka aj zvolený čas
        const keep = { desc: draft.desc, note: draft.note };
        if (draft.tsTouched) Object.assign(keep, { ts: draft.ts, tsTouched: true, tsOff: draft.tsOff, tsCustom: draft.tsCustom });
        draft = Object.assign(newDraft(ty), keep);
      }
      renderForm();
      $('#entry-sheet').scrollTop = 0;
      return;
    }

    // „Zapísať znova“ na úvodnom kroku
    const again = t.closest('[data-aq], [data-af]');
    if (again) {
      const keep = draft.tsCustom ? { ts: draft.ts, tsTouched: true, tsCustom: true } : null;
      draft = newDraft('food');
      if (keep) Object.assign(draft, keep);
      renderForm();
      if (again.dataset.af != null) {
        const f = favorites()[Number(again.dataset.af)];
        if (f) applyQuick(f.desc, f);
      } else {
        const val = again.dataset.aq;
        const src = entries.filter(e => e.type === 'food' && (e.desc || '').trim().toLowerCase() === val.toLowerCase()).sort((a, b) => b.ts - a.ts)[0];
        applyQuick(val, src);
      }
      return;
    }

    const q = t.closest('.chip[data-q]');
    if (q) {
      const val = q.dataset.q;
      if (quickOff(val)) return;
      const src = entries.filter(e => e.type === draft.type && (e.desc || '').trim().toLowerCase() === val.toLowerCase())
        .sort((a, b) => b.ts - a.ts)[0];
      applyQuick(val, src);
      return;
    }

    const fv = t.closest('.chip[data-fav]');
    if (fv) { const f = favorites()[Number(fv.dataset.fav)]; if (f && !quickOff(f.desc)) applyQuick(f.desc, f); return; }

    const tg = t.closest('.chip[data-tag]');
    if (tg && tg.closest('#tag-chips')) {
      const v = tg.dataset.tag;
      if (effectiveTags().includes(v)) {
        draft.tags = draft.tags.filter(x => x !== v);
        if (autoTags().includes(v) && !draft.noTags.includes(v)) draft.noTags.push(v);
      } else {
        draft.noTags = draft.noTags.filter(x => x !== v);
        if (!autoTags().includes(v)) draft.tags.push(v);
      }
      refreshFoodExtras();
      return;
    }

    const it = t.closest('.chip[data-intol]');
    if (it) {
      const v = it.dataset.intol;
      const list = riskTags().includes(v) ? riskTags().filter(x => x !== v) : riskTags().concat([v]);
      await setMeta('intol', list);
      it.classList.toggle('on', list.includes(v));
      return;
    }

    const hs = t.closest('[data-hsec]');
    if (hs) { jumpHelp(hs.dataset.hsec); return; }

    const ins = t.closest('[data-ins]');
    if (ins) { insTab = ins.dataset.ins; renderInsights(); return; }

    const su = t.closest('[data-sus]');
    if (su) { openSuspect(su.dataset.sus); return; }

    // z detailu podozrivého na konkrétny deň
    const gd = t.closest('[data-goday]');
    if (gd) { [...openSheets].reverse().forEach(id => closeSheet(id)); todayExpanded = false; goDay(gd.dataset.goday); return; }

    const pin = t.closest('[data-pin]');
    if (pin) { openFinding({ text: pin.dataset.pin.replace(/^[^\p{L}\p{N}]+/u, ''), status: 'sus' }); return; }

    const fnd = t.closest('[data-fnd]');
    if (fnd) { const f = findings().find(x => x.id === fnd.dataset.fnd); if (f) openFinding(f); return; }

    const fs = t.closest('[data-fs]');
    if (fs) { fDraft.status = fs.dataset.fs; $$('[data-fs]').forEach(c => c.classList.toggle('on', c === fs)); return; }

    const rt = t.closest('[data-rt]');
    if (rt) {
      riDraft.tag = riDraft.tag === rt.dataset.rt ? null : rt.dataset.rt;
      $$('[data-rt]').forEach(c => c.classList.toggle('on', c.dataset.rt === riDraft.tag));
      return;
    }

    const tt = t.closest('[data-tt]');
    if (tt) {
      tDraft.tag = tDraft.tag === tt.dataset.tt ? null : tt.dataset.tt;
      $$('[data-tt]').forEach(c => c.classList.toggle('on', c.dataset.tt === tDraft.tag));
      return;
    }
    const td = t.closest('[data-td]');
    if (td) { tDraft.days = Number(td.dataset.td); $$('[data-td]').forEach(c => c.classList.toggle('on', c === td)); return; }

    const tr = t.closest('[data-trace]');
    if (tr) { openTrace(tr.dataset.trace); return; }

    const cd = t.closest('[data-cal]');
    if (cd) { todayExpanded = false; goDay(cd.dataset.cal); return; }

    const tm = t.closest('[data-time]');
    if (tm) {
      const m = Number(tm.dataset.time);
      draft.ts = Date.now() - m * 60000;
      draft.tsOff = m;
      draft.tsCustom = false;
      draft.tsTouched = m !== 0;
      $$('.time-row .chip').forEach(c => c.classList.toggle('on', c === tm));
      setTimeInputs();
      return;
    }

    const chip = t.closest('.chips[data-field] .chip');
    if (chip) {
      const group = chip.parentElement;
      const f = group.dataset.field;
      const v = parseChip(group, chip.dataset.v);
      if (group.dataset.day) {
        const day = group.dataset.day;
        const nv = await setDayField(day, f, v);
        refreshGroup(group, nv);
        if (!todayExpanded && dayFilled(days[day]) === DAY_FIELDS.length) {
          setTimeout(() => { if (currentView === 'today' && selDay === day) renderToday(); }, 450);
        }
        return;
      }
      if (group.dataset.multi) {
        const arr = draft[f] || [];
        draft[f] = arr.includes(v) ? arr.filter(x => x !== v) : arr.concat([v]);
      } else {
        draft[f] = draft[f] === v ? (f === 'duration' ? '' : null) : v;
      }
      refreshGroup(group, draft[f]);
      if (f === 'severity' && draft.severity >= 7) buzz(8);
      if (f === 'duration') $('#f-duration').value = draft.duration;
      if (f === 'severity') $('#sev-word').textContent = sevWord(draft.severity);
      return;
    }

    const entry = t.closest('.entry[data-id]');
    if (entry) { startEdit(entry.dataset.id); return; }

    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'add': openEntry(); break;
      case 'go-today': todayExpanded = false; goDay(todayStr()); break;
      case 'cancel-edit': cancelEntry(); break;
      case 'delete': deleteCurrent(); break;
      case 'quick-sym': {
        // ťažkosti jedným ťuknutím; podrobnosti sa dajú doplniť z oznamu
        const sev = Number(act.dataset.v), now = Date.now();
        const e = { id: uid(), type: 'symptom', ts: now, desc: 'ťažkosti', severity: sev, duration: '', kinds: [], location: null,
          stress: null, mood: null, note: '', created: now, updated: now };
        await DB.put('entries', e);
        entries.push(e);
        const dd = days[dayOf(now)];
        if (dd && dd.noSymptoms) { delete dd.noSymptoms; await DB.put('days', dd); }
        if (!meta.firstUse) await setMeta('firstUse', now);
        buzz(sev >= 7 ? 15 : 10);
        flashId = e.id;
        render();
        toast(`Zapísané: ťažkosti ${sev}/10`, { label: 'Doplniť', run: () => startEdit(e.id) });
        break;
      }
      case 'sym-at': {
        openEntry();
        draft = Object.assign(newDraft('symptom'), { ts: atHour(act.dataset.date, 18), tsTouched: true, tsCustom: true });
        renderForm();
        break;
      }
      case 'add-at': {
        // zabudnuté jedlo: formulár s časom typického jedla v tom dni
        openEntry();
        draft.ts = atHour(selDay, Number(act.dataset.h));
        draft.tsTouched = true;
        draft.tsCustom = true;
        renderForm();
        break;
      }
      case 'rec-log': {
        const r = recurring().find(x => x.id === act.dataset.id);
        if (!r) break;
        const now = Date.now(), sched = atHour(todayStr(), r.h + r.m / 60);
        const ts = now - sched > 3 * 3600e3 ? sched : now;
        const e = { id: uid(), type: r.type, ts, desc: r.desc, stress: null, mood: null, note: '', created: now, updated: now };
        if (r.type === 'food') Object.assign(e, { portion: r.portion || null, rushed: false, tags: r.tags || [], noTags: r.noTags || [], amount: '', product: null, place: null, enzyme: false });
        await DB.put('entries', e);
        entries.push(e);
        flashId = e.id;
        buzz();
        render();
        toast('Zapísané: ' + r.desc, { run: async () => { await DB.del('entries', e.id); entries = entries.filter(x => x.id !== e.id); render(); } });
        break;
      }
      case 'rec-del': {
        await setMeta('recurring', recurring().filter(x => x.id !== act.dataset.id));
        openInfo('rec');
        break;
      }
      case 'dup-now': {
        const src = entries.find(e => e.id === editingId);
        if (!src) break;
        const now = Date.now();
        const copy = Object.assign(JSON.parse(JSON.stringify(src)), { id: uid(), ts: now, created: now, updated: now });
        await DB.put('entries', copy);
        entries.push(copy);
        editingId = null;
        draft = newDraft();
        closeSheet('entry-sheet');
        flashId = copy.id;
        showDone();
        if (currentView === 'today') { selDay = todayStr(); followToday = true; }
        render();
        toast('Zapísané znova: ' + copy.desc);
        break;
      }
      case 'backup': doBackup(); break;
      case 'restore': $('#import-file').click(); break;
      case 'csv': doCsv(); break;
      case 'wipe': wipeAll(); break;
      case 'today-edit': todayExpanded = true; renderToday(); break;
      case 'today-done': todayExpanded = false; renderToday(); break;
      case 'more-days': listDays += 14; renderList(); break;
      case 'fav': toggleFav(); break;
      case 'fav-del': {
        await setMeta('favorites', favorites().filter((_, i) => i !== Number(act.dataset.i)));
        openInfo('favs');
        break;
      }
      case 'no-sym': {
        const d = act.dataset.date || todayStr();
        await setDayField(d, 'noSymptoms', true);
        if (days[d] && !days[d].noSymptoms) delete days[d].noSymptoms;
        if (days[d] && days[d].noSymptoms) buzz();
        toast(days[d] && days[d].noSymptoms ? 'Super, deň bez ťažkostí ' : 'Označenie zrušené');
        if (openSheets.includes('entry-sheet') && !draft.type) closeSheet('entry-sheet');
        render();
        break;
      }
      case 'time-custom': {
        draft.tsCustom = true;
        draft.tsTouched = true;
        $$('.time-row .chip').forEach(c => c.classList.remove('on'));
        break;
      }
      case 'cal-prev': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderList(); break;
      case 'cal-next': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderList(); break;
      case 'trace-close': closeSheet('trace-dialog'); break;
      case 'form-back': {
        const keep = draft.tsCustom ? { ts: draft.ts, tsTouched: true, tsCustom: true } : null;
        draft = newDraft();
        if (keep) Object.assign(draft, keep);
        renderForm();
        break;
      }
      case 'tags-all': draft.tagsAll = true; refreshFoodExtras(); break;
      case 'mini-close': closeSheet('mini-sheet'); break;
      case 'intol-edit': openIntol(); break;
      case 'favs': openInfo('favs'); break;
      case 'rec-open': openInfo('rec'); break;
      case 'recipes': openInfo('recipes'); break;
      case 'rc-add': {
        const name = $('#rc-name').value.trim(), ing = $('#rc-ing').value.trim();
        if (name.length < 3 || !ing) { toast('Napíš názov aj suroviny'); break; }
        if (recipes().some(r => r.name.toLowerCase() === name.toLowerCase())) { toast('Toto jedlo už v zozname je'); break; }
        await setMeta('recipes', recipes().concat([{ name, ingredients: ing }]));
        Analysis.setRecipes(recipes());
        openInfo('recipes');
        toast('Pridané ✓');
        break;
      }
      case 'rc-del': {
        const i = Number(act.dataset.i), prev = recipes();
        await setMeta('recipes', prev.filter((_, j) => j !== i));
        Analysis.setRecipes(recipes());
        openInfo('recipes');
        toast((prev[i] || {}).name + ' zmazané', { run: async () => { await setMeta('recipes', prev); Analysis.setRecipes(recipes()); if (openSheets.includes('mini-sheet')) openInfo('recipes'); } });
        break;
      }
      case 'scan-test': location.href = 'sken-test.html'; break;
      case 'rem-open': openInfo('rem'); break;
      case 'install': openInfo('install'); break;
      case 'shortcut': openInfo('shortcut'); break;
      case 'copy-link': {
        const link = appLink(act.dataset.ty);
        try { await navigator.clipboard.writeText(link); toast('Odkaz skopírovaný'); } catch (_) { toast('Odkaz podrž prstom a skopíruj'); }
        break;
      }
      case 'ct-add': {
        const label = $('#ct-text').value.trim();
        const words = Analysis.wordsFor(label);
        if (!words.length) { toast('Napíš názov suroviny (aspoň 3 písmená)'); break; }
        if (TAGS.some(x => x[2].toLowerCase() === label.toLowerCase())) { toast('Toto už v zozname je'); break; }
        const c = { id: 'c_' + Date.now().toString(36), label, words };
        await setMeta('customTags', customTags().concat([c]));
        await setMeta('intol', riskTags().concat([c.id]));
        syncCustomTags();
        const top = $('#mini-sheet').scrollTop;
        openIntol();
        $('#mini-sheet').scrollTop = top;
        toast('Pridané ✓');
        break;
      }
      case 'ct-del': {
        const id = act.dataset.id;
        const prev = { customTags: customTags(), intol: riskTags(), test: meta.test || null };
        const label = (prev.customTags.find(c => c.id === id) || {}).label || 'Položka';
        await setMeta('customTags', customTags().filter(c => c.id !== id));
        await setMeta('intol', riskTags().filter(t => t !== id));
        if (meta.test && meta.test.tag === id) await setMeta('test', null);
        syncCustomTags();
        const top = $('#mini-sheet').scrollTop;
        openIntol();
        $('#mini-sheet').scrollTop = top;
        toast(label + ' zmazané', { run: async () => {
          await setMeta('customTags', prev.customTags);
          await setMeta('intol', prev.intol);
          await setMeta('test', prev.test);
          syncCustomTags();
          if (openSheets.includes('mini-sheet')) {
            const tp = $('#mini-sheet').scrollTop;
            openIntol();
            $('#mini-sheet').scrollTop = tp;
          } else render();
        } });
        break;
      }
      case 'fnd-new': openFinding({}); break;
      case 'fnd-save': saveFinding(); break;
      case 'fnd-del': {
        const prevF = findings();
        await setMeta('findings', findings().filter(x => x.id !== fDraft.id));
        closeSheet('mini-sheet');
        render();
        toast('Zistenie zmazané', { run: async () => { await setMeta('findings', prevF); render(); } });
        break;
      }
      case 'test-new': openTestNew(); break;
      case 'ri-new': openReintroNew(); break;
      case 'week-hide': await setMeta('weekSeen', act.dataset.end); renderToday(); break;
      case 'ri-start': {
        const txt = $('#ri-text').value.trim();
        const tg = TAGS.find(x => x[0] === riDraft.tag);
        if (!txt && !tg) { toast('Vyber alebo napíš, čo zavedieš späť'); break; }
        await setMeta('reintro', { what: txt || tg[2], tag: tg ? tg[0] : null, start: parseDay(todayStr()).getTime(), doses: [{}, {}, {}] });
        closeSheet('mini-sheet');
        toast('Zavádzanie sa začalo');
        render();
        break;
      }
      case 'ri-dose': {
        // zapíše dávku ako jedlo s porciou podľa dňa; podrobnosti sa dajú doplniť
        const i = reintroInfo();
        if (!i || i.todayDose < 0) break;
        const now = Date.now(), r = JSON.parse(JSON.stringify(i.r));
        const e = { id: uid(), type: 'food', ts: now, desc: r.what, stress: null, mood: null, note: 'opätovné zavedenie, deň ' + (i.todayDose + 1),
          created: now, updated: now, portion: RI_DOSES[i.todayDose][0], rushed: false, tags: r.tag ? [r.tag] : [], noTags: [], amount: '', product: null, place: 'doma', enzyme: false };
        await DB.put('entries', e);
        entries.push(e);
        r.doses[i.todayDose] = { ts: now, id: e.id };
        await setMeta('reintro', r);
        flashId = e.id;
        showDone();
        render();
        toast('Dávka zapísaná', { label: 'Upraviť', run: () => startEdit(e.id) });
        break;
      }
      case 'ri-end': {
        const i = reintroInfo();
        if (!i) break;
        const [v, txt] = reintroVerdict(i);
        openFinding({ text: i.r.what, status: v, fromReintro: true,
          note: 'Opätovné zavedenie: ' + i.res.map(x => `deň ${x.i + 1} ${!x.eaten ? 'nezjedené' : x.n ? 'ťažkosti ' + x.max + '/10' : 'bez ťažkostí'}`).join(', ') + '. ' + txt });
        break;
      }
      case 'ri-cancel': {
        const prevRi = meta.reintro;
        await setMeta('reintro', null);
        render();
        toast('Zavádzanie zrušené', { run: async () => { await setMeta('reintro', prevRi); render(); } });
        break;
      }
      case 'test-for': {
        const s = lastSus.get(act.dataset.susId);
        if (!s) break;
        if (meta.test) { toast('Už prebieha test. Naraz len jedna vec.'); break; }
        openTestNew(s.id.startsWith('tag:') ? { tag: s.id.slice(4) } : { text: s.name });
        break;
      }
      case 'test-start': {
        const txt = $('#tt-text').value.trim();
        const tg = TAGS.find(x => x[0] === tDraft.tag);
        if (!txt && !tg) { toast('Vyber alebo napíš, čo vynecháš'); break; }
        await setMeta('test', { what: txt || tg[2], tag: txt ? null : tg[0], start: parseDay(todayStr()).getTime(), days: tDraft.days });
        closeSheet('mini-sheet');
        toast('Test sa začal ');
        render();
        break;
      }
      case 'test-end': {
        const i = testInfo();
        if (i) openFinding({ text: i.t.what, status: 'sus', fromTest: true,
          note: `Test ${i.elapsed} dní bez toho: ťažkosti ${i.during} z ${i.elapsed} dní, predtým ${i.before} z ${i.elapsed}.` });
        break;
      }
      case 'test-cancel': {
        const prevT = meta.test;
        await setMeta('test', null);
        render();
        toast('Test zrušený', { run: async () => { await setMeta('test', prevT); render(); } });
        break;
      }
      case 'report': openReport(); break;
      case 'scan': openScan(); break;
      case 'scan-close': closeSheet('scan-sheet'); break;
      case 'scan-retry': $('#scan-sheet').innerHTML = scanBody('Namier kameru na čiarový kód a chvíľu ju drž pokojne.'); scanStart(); break;
      case 'scan-manual': {
        const c = ($('#scan-code').value || '').replace(/\s+/g, '');
        if (!window.Scan || !Scan.validCode(c)) { toast('Číslo nesedí. Skontroluj, či nie je preklep.'); break; }
        Scan.stop();
        handleCode(c);
        break;
      }
      case 'prod-clear': draft.product = null; renderForm(); break;
      case 'report-close': closeSheet('report-sheet'); break;
      case 'help': openHelp(act.dataset.sec || ''); break;
      case 'help-close': closeSheet('help-sheet'); break;
      case 'welcome': openWelcome(); break;
      case 'wl-next': welcomeStep++; $('#mini-sheet').innerHTML = welcomeHtml(); $('#mini-sheet').scrollTop = 0; break;
      case 'wl-done': await setMeta('onboarded', true); closeSheet('mini-sheet'); render(); break;
      case 'report-print': window.print(); break;
      case 'report-share': shareReport(); break;
      case 'reminder': doReminder(); break;
    }
  });

  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'f-desc') {
      // názov je jeden riadok textu: zalomenia (aj z vloženého textu) nahradíme medzerou
      if (/[\r\n]/.test(t.value)) t.value = t.value.replace(/\s*[\r\n]+\s*/g, ' ');
      draft.desc = t.value; t.classList.remove('invalid'); growDesc(); refreshFoodExtras();
    }
    else if (t.id === 'f-note') draft.note = t.value;
    else if (t.id === 'f-amount') draft.amount = t.value;
    else if (t.id === 'q') { searchQ = t.value; renderSearch(); }
    else if (t.id === 'help-q') filterHelp(t.value);
    else if (t.id === 'f-duration') {
      draft.duration = t.value;
      const g = $('.chips[data-field="duration"]');
      if (g) refreshGroup(g, draft.duration);
    }
  });

  document.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.id === 'f-date' || t.id === 'f-time') {
      // dátum a čas sú dve samostatné políčka; zmena jedného druhé nemení
      const v = new Date($('#f-date').value + 'T' + $('#f-time').value).getTime();
      if (!isNaN(v)) {
        draft.ts = v; draft.tsTouched = true; draft.tsCustom = true;
        $$('.time-row .chip').forEach(c => c.classList.remove('on'));
        t.classList.remove('invalid');
      }
    } else if (t.id === 'f-rushed') draft.rushed = t.checked;
    else if (t.id === 'f-enzyme') draft.enzyme = t.checked;
    else if (t.id === 'f-rec') draft.rec = t.checked;
    else if (t.id === 'o-from' || t.id === 'o-to' || t.id === 'o-min') {
      let from = Number($('#o-from').value), to = Number($('#o-to').value);
      if (to <= from) { to = from + 2; }
      await setMeta('fromH', from);
      await setMeta('toH', to);
      await setMeta('minN', Number($('#o-min').value));
      renderInsights();
    } else if (t.id === 'scan-photo' && t.files && t.files[0]) {
      const file = t.files[0];
      t.value = '';
      if (!window.Scan) return;
      Scan.stop();
      const m = $('#scan-msg');
      if (m) m.textContent = 'Čítam fotku…';
      const c = await Scan.decodePhoto(file);
      if (c) handleCode(c); else scanFail('Kód sa z fotky nepodarilo prečítať. Skús to zblízka a rovno, alebo zadaj číslo.');
    } else if (t.id === 'import-file' && t.files && t.files[0]) {
      await doImport(t.files[0]);
      t.value = '';
    }
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.target.id === 'f-desc' || (ev.target.tagName === 'INPUT' && (ev.target.type === 'text' || ev.target.type === 'search')))) {
      ev.preventDefault();
      ev.target.blur();
    }
    if (ev.key === 'Escape' && openSheets.length) $('#scrim').click();
  });

  window.addEventListener('scroll', syncNavbar, { passive: true });

  // zapamätá, či je zoznam posledných jedál rozbalený (aj po prekreslení formulára)
  document.addEventListener('toggle', ev => { if (ev.target.classList && ev.target.classList.contains('quick-dd')) draft.quickOpen = ev.target.open; }, true);

  $('#entry-form').addEventListener('submit', ev => { ev.preventDefault(); saveDraft(); });

  // Pri návrate do aplikácie obnov čas „teraz“ a dnešný deň
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (openSheets.includes('entry-sheet')) {
      if (!draft.tsTouched && !editingId) {
        draft.ts = Date.now();
        setTimeInputs();
      }
      return;
    }
    if (currentView === 'today' && !openSheets.length) {
      if (followToday) selDay = todayStr();
      renderToday();
    }
  });

  // ---------- Štart ----------
  // Skratka z plochy alebo z aplikácie Skratky: ./?add=food otvorí rovno zápis
  function openFromLink() {
    let ty = null;
    try { ty = new URLSearchParams(location.search).get('add'); } catch (_) { /* nič */ }
    if (!ty || !TYPES[ty]) return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (_) { /* nič */ }
    openEntry();
    if (ty !== 'food') { draft = Object.assign(newDraft(ty), { ts: draft.ts, tsTouched: draft.tsTouched, tsCustom: draft.tsCustom }); renderForm(); }
  }
  const appLink = ty => location.origin + location.pathname + '?add=' + ty;

  async function start() {
    try {
      await load();
    } catch (ex) {
      console.error(ex);
      document.querySelector('main').innerHTML = '<div class="card empty"><div class="big"></div><p>Úložisko v tomto prehliadači nefunguje. Skús otvoriť stránku v Safari (nie v súkromnom režime).</p></div>';
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    switchView('today');
    if (!meta.onboarded && !entries.length && !location.search.includes('add=')) openWelcome();
    else openFromLink();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // keď sa nainštaluje nová verzia, stránku raz obnovíme, aby sedeli všetky súbory
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !reloaded && !openSheets.length) { reloaded = true; location.reload(); }
      });
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
    }
  }

  // sprístupnené pre testovanie
  window.__dennik = { buildCsv, get entries() { return entries; }, reload: async () => { await load(); switchView(currentView); } };

  start();
})();
