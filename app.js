/* Denník jedla a trávenia – celá aplikácia. Údaje zostávajú len v telefóne (IndexedDB). */
(function () {
  'use strict';

  const APP_VERSION = '3.0';

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
  const PLACES = [['doma', 'doma'], ['restauracia', 'reštaurácia / jedáleň'], ['niekto', 'u niekoho'], ['kupovane', 'kupované hotové']];
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
    'activity:ziadny': 'deň bez pohybu', 'water:malo': 'málo pitia',
    'risk': 'obsahuje moje rizikové suroviny',
    'risk&enzyme': 's enzýmom (laktáza…)', 'risk&away': 'mimo domu', 'risk&stress': 'pri strese 4–5',
    'risk&period': 'počas menštruácie', 'risk&sleep': 'po zlom spánku', 'risk&rushed': 'v zhone',
  };
  TAGS.forEach(([v, e, t]) => { CTX_LABELS['tag:' + v] = t; CTX_LABELS['stack:' + v] = t; CTX_LABELS['load:' + v] = t + ' – 2 a viac porcií za deň'; });
  Object.assign(CTX_LABELS, { 'late': 'jedlo po 20:00', 'gap:long': 'jedlo po dlhej pauze (5 h a viac)', 'first:kava': 'káva ako prvé v daný deň' });
  PLACES.forEach(([v, l]) => { CTX_LABELS['place:' + v] = l; });
  const tagLabel = t => { const x = TAGS.find(y => y[0] === t); return x ? x[2] : t; };

  // ---------- Pomocné ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const dateStr = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const todayStr = () => dateStr(Date.now());
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
    if (ds === dateStr(Date.now() - DAY)) return 'Včera';
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
  let selDay = dateStr(Date.now());   // deň zobrazený na obrazovke Dnes
  let followToday = true;             // po polnoci preskočí na nový deň
  let flashId = null;                 // práve uložený záznam (krátko sa zvýrazní)
  let openSheets = [];

  function newDraft(type) {
    return {
      type: type || null, ts: Date.now(), tsTouched: false, desc: '', severity: null, duration: '',
      stool: null, stress: null, mood: null, note: '', portion: null, rushed: false,
      tags: [], noTags: [], kinds: [], location: null, place: null, enzyme: false, tsOff: 0, tsCustom: false, tagsAll: false, amount: '', product: null,
    };
  }

  // Skupiny jedla v rozpracovanom zázname: ručne + automaticky rozpoznané – ručne vypnuté
  function autoTags() { return Analysis.detectTags(draft.desc); }
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
  }

  // Vlastné intolerancie sa správajú ako ostatné skupiny: rozpoznanie z popisu, štítky, výpočty
  const customTags = () => meta.customTags || [];
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
    if (entries.some(e => e.type === 'symptom' && dateStr(e.ts) === d)) return '';
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
      const d = dateStr(e.ts);
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
    if (d === dateStr(Date.now() - DAY)) return ['Včera', wd + ' ' + date];
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
    const minOf = ts => Math.max(0, Math.min(1440, (ts - base) / 60000));
    let startH = 6;
    list.forEach(e => { startH = Math.min(startH, Math.floor(minOf(e.ts) / 60)); });
    const span = 1440 - startH * 60;
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
    const list = entries.filter(e => dateStr(e.ts) === d).sort((a, b) => a.ts - b.ts);
    const [title, sub] = dayTitle(d);
    let h = `<header class="lt"><div><h1>${title}</h1><p>${sub}</p></div>
      ${isToday ? '' : '<button type="button" class="btn small" data-act="go-today">Späť na dnes</button>'}</header>`;
    h += stripHtml();
    if (isToday) h += bannerHtml() + testBannerHtml();
    if (list.length) {
      h += ribbonHtml(list, d);
      h += '<div class="tl">' + list.map(entryRow).join('') + '</div>';
    } else {
      h += `<div class="card empty"><div class="big"></div>
        <p><b>${isToday ? 'Dnes zatiaľ nič zapísané' : 'V tento deň nie je nič zapísané'}</b><br>Ťukni dole na ＋ a zapíš jedlo alebo ťažkosti.</p></div>`;
    }
    h += dayCardHtml(d);
    el.innerHTML = h;
    flashId = null;
    const strip = $('#strip'), cur = strip && $('.ds.sel', strip);
    if (cur) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2;
  }

  function quickFor(type) {
    const m = new Map();
    const now = Date.now();
    for (const e of entries) {
      if (e.type !== type || !e.desc) continue;
      const text = e.desc.trim();
      const k = text.toLowerCase();
      const r = m.get(k) || { text, n: 0, last: 0 };
      r.n++;
      r.last = Math.max(r.last, e.ts);
      m.set(k, r);
    }
    const list = [...m.values()]
      .map(r => ({ ...r, score: r.n + (now - r.last < 3 * DAY ? 2 : 0) }))
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
    const quick = chipsHtml ? `<details class="quick-dd"${draft.quickOpen ? ' open' : ''}><summary>Naposledy ${isFood ? 'jedené' : 'zapísané'} <span>${n}</span></summary>
      <div class="chips quick">${chipsHtml}</div><p class="tiny" style="margin:8px 0 0">Ťukni na viac položiek, pridajú sa za seba. Opätovným ťuknutím položku odoberieš.</p></details>` : '';
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

  function refreshFoodExtras() {
    if (draft.type !== 'food') return;
    const tc = $('#tag-chips');
    if (tc) tc.outerHTML = tagChips();
    const rw = $('#risk-warn');
    if (rw) rw.innerHTML = riskWarnHtml();
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
        <label>Iný dátum<input type="date" id="f-date" value="${dateStr(draft.ts)}" max="${todayStr()}"></label>
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
      h += grp('Obsahovalo', tagChips() + '<p class="tiny" style="margin:8px 0 0">✦ = rozpoznané z popisu. Ťuknutím zrušíš alebo pridáš.</p>');
      h += grp('', sw('f-enzyme', 'Užila som laktázu / enzým', draft.enzyme) + sw('f-rushed', 'Jedla som v zhone', draft.rushed));
      h += grp('Kde?', chipGroup('place', PLACES, {}));
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
    h += moreBlock();

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
    // ťažkosti v deň označený „bez ťažkostí“ → zrušiť označenie
    const dd = days[dateStr(e.ts)];
    if (type === 'symptom' && dd && dd.noSymptoms) { delete dd.noSymptoms; await DB.put('days', dd); }

    const wasEditing = !!editingId;
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet');
    flashId = e.id;
    showDone();
    if (currentView === 'today') { selDay = dateStr(e.ts); followToday = selDay === todayStr(); }
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
    let h = `<header class="lt"><div><h1>Kalendár</h1><p>Ťukni na deň a otvorí sa jeho denník.</p></div></header>
      <input type="search" id="q" value="${esc(searchQ)}" placeholder="Hľadať v denníku, napr. jogurt" enterkeyhint="search"><div id="q-res"></div>` + renderCalendar();
    const byDay = new Map();
    entries.forEach(e => {
      const d = dateStr(e.ts);
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
        `<button type="button" class="dayrow fnd" data-cal="${dateStr(e.ts)}"><span>${TYPES[e.type].ico}</span>
          <span><b>${esc(e.desc)}</b><small>${fmtDayHead(dateStr(e.ts))} o ${fmtTime(e.ts)}</small></span><span></span><span class="chev">›</span></button>`).join('') + '</div>'
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
      <p class="small muted" style="margin-top:-6px">${esc(s.desc)}${s.severity ? ' · sila ' + s.severity + '/10' : ''} · ${fmtDayHead(dateStr(s.ts))} ${fmtTime(s.ts)}</p>`;
    if (sumTags.length) {
      h += `<div class="trace-sum"><b>Za posledných 48 h:</b><div class="pending" style="margin-top:6px">` +
        sumTags.map(([t, n]) => `<span class="${risk.includes(t) ? 'risk' : ''}">${esc(tagLabel(t))} ${n}×</span>`).join('') +
        (away ? `<span>mimo domu ${away}×</span>` : '') + '</div></div>';
    }
    const dset = [...new Set([dateStr(s.ts), dateStr(s.ts - 864e5), dateStr(from)])];
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

  function pendingList(list, minN, isFood) {
    if (!list.length) return '';
    return `<p class="tiny" style="margin:12px 0 6px">Zatiaľ málo údajov (treba aspoň ${minN}×):</p><div class="pending">` +
      list.slice(0, 20).map(p => `<span>${esc(isFood ? p.label : (CTX_LABELS[p.key] || p.key))} ${p.n}/${minN}</span>`).join('') + '</div>';
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
    if (fDraft.fromTest) await setMeta('test', null);
    closeSheet('mini-sheet');
    toast('Zistenie uložené ✓');
    render();
  }

  // ---------- Test podozrivého ----------
  let tDraft = null;
  function testInfo() {
    const t = meta.test;
    if (!t) return null;
    const day0 = parseDay(todayStr()).getTime();
    const passed = Math.round((day0 - t.start) / DAY);
    const elapsed = Math.max(1, Math.min(t.days, passed + 1));
    const symDays = new Set(entries.filter(e => e.type === 'symptom').map(e => dateStr(e.ts)));
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

  function openTestNew() {
    tDraft = { tag: null, days: 14 };
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>Nový test</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>` +
      grp('Čo na čas vynecháš?', '<div class="chips">' + TAGS.map(([v, e, t]) => `<button type="button" class="chip" data-tt="${v}">${esc(t)}</button>`).join('') + '</div>' +
        '<input type="text" id="tt-text" style="margin-top:10px" placeholder="alebo napíš vlastné, napr. paradajky" enterkeyhint="done">') +
      grp('Ako dlho?', '<div class="chips seg">' + [7, 14, 21].map(n => `<button type="button" class="chip${n === 14 ? ' on' : ''}" data-td="${n}">${n} dní</button>`).join('') + '</div>') +
      '<p class="tiny" style="margin:0 4px 12px">Väčšie zmeny v strave a lieky vždy najprv preber s lekárom.</p>' +
      `<div class="savebar"><button type="button" class="btn primary" data-act="test-start">Začať dnes</button></div>`;
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
      ${bw.both.length ? `<h4 class="mini-h">Bolo v oboch, takže asi nerozhoduje</h4>${chips(bw.both, '')}` : ''}</div>`;
  }

  let insTab = 'sus';
  const INS_TABS = [['sus', 'Podozrivé'], ['good', 'Dobré'], ['days', 'Dni'], ['mine', 'Moje']];

  function renderInsights() {
    const el = $('#view-insights');
    const fromH = meta.fromH != null ? meta.fromH : 0;
    const toH = meta.toH != null ? meta.toH : 6;
    const minN = meta.minN || 5;
    const r = Analysis.analyze(entries, days, { fromH, toH, minN, riskTags: riskTags() });

    let h = `<header class="lt"><div><h1>Súvislosti</h1><p>Po čom je horšie a po čom dobre.</p></div></header>
      <div class="segbar">${INS_TABS.map(([k, l]) => `<button type="button" class="${k === insTab ? 'on' : ''}" data-ins="${k}">${l}</button>`).join('')}</div>`;
    const note = `<p class="foot">Len pomôcka, nie diagnóza. Čísla ukazujú, čo sa časovo zhoduje, nie čo ťažkosti naozaj spôsobuje. Jedlo ani lieky nevynechávaj bez dohody s lekárom.</p>`;

    if (insTab === 'mine') {
      h += findingsHtml() + testHtml();
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

    const tol = toleratedList(r);
    if (insTab === 'sus') {
      const top = r.foods.concat(r.ctx).filter(x => x.level !== 'none').sort((a, b) => b.ratio - a.ratio || b.rateWith - a.rateWith).slice(0, 3);
      h += `<div class="card brief"><h2>V skratke</h2>
        <h4 class="mini-h" style="margin-top:0">Najčastejšie pred ťažkosťami</h4>` +
        (top.length ? top.map(x => `<div class="brow lvl-${x.level}"><span>${esc(resName(x))}</span><span class="ratio">${ratioText(x)}</span></div>`).join('')
          : '<p class="small muted" style="margin:0">Zatiaľ nič nevyzerá podozrivo.</p>') +
        `<h4 class="mini-h">Najlepšie znášané</h4>` +
        (tol.length ? '<div class="pending">' + tol.slice(0, 3).map(x => `<span class="good">${esc(resName(x))}</span>`).join('') + '</div>'
          : '<p class="small muted" style="margin:0">Zatiaľ málo údajov.</p>') +
        `<p class="tiny" style="margin:12px 0 0">Z ${r.totalN} jedál a ${r.symptomCount} záznamov ťažkostí. Ťažkosti prišli po ${pct(r.baseRate)} jedál.</p></div>`;

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
          mimo domu, pri strese, počas menštruácie a či pomáha enzým.</p>`;
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

      const r2 = toH < 12 ? Analysis.analyze(entries, days, { fromH: 12, toH: 48, minN, riskTags: riskTags() }) : null;
      if (r2 && r2.totalN >= 10) {
        const late = r2.foods.concat(r2.ctx.filter(x => x.key.startsWith('tag:'))).filter(x => x.level !== 'none').sort((a, b) => b.ratio - a.ratio || b.rateWith - a.rateWith);
        h += `<div class="card"><h2>Na druhý deň (12–48 h)</h2><p class="tiny" style="margin:0 0 6px">Niektoré intolerancie sa prejavia až neskôr. Tu sú jedlá, po ktorých prišli ťažkosti o 12–48 h.</p>`;
        h += late.length ? late.slice(0, 15).map(x => resItem(x, 'meal')).join('') : '<p class="muted small" style="margin:4px 0">Nič výrazné.</p>';
        h += '</div>';
      }
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
    const dset = new Set(E.map(e => dateStr(e.ts)));
    const sym = E.filter(e => e.type === 'symptom');
    const symDays = new Set(sym.map(e => dateStr(e.ts)));
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
    S.push(['Po čom prichádzajú ťažkosti častejšie (do 6 h po jedle)', sus.length ? sus.map(line) : ['Zatiaľ nič výrazné alebo málo údajov']]);
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

  function openReport() {
    const S = buildReport();
    if (!S) { toast('Zatiaľ žiadne záznamy'); return; }
    $('#report-sheet').innerHTML = `<div class="sheet-head noprint"><h2>Prehľad pre lekára</h2><button type="button" class="x" data-act="report-close" aria-label="Zavrieť">✕</button></div>
      <div class="report"><h1>Denník jedla a trávenia – prehľad</h1>` +
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
  async function doReminder() {
    const hh = $('#rem-time').value;
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    const day = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate());
    const stamp = d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dennik-jedla//SK', 'BEGIN:VEVENT',
      'UID:pripomienka-' + hh + '@dennik-jedla', 'DTSTAMP:' + stamp, 'DTSTART:' + day + 'T' + hh + '0000', 'DURATION:PT5M',
      'RRULE:FREQ=DAILY', 'SUMMARY:Denník: aký bol dnešný deň?', 'DESCRIPTION:Otvor Denník jedla a zapíš deň.',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Denník: aký bol dnešný deň?', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    await saveFile('dennik-pripomienka.ics', 'text/calendar', ics);
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
    ['products', 'customTags', 'intol', 'favorites', 'fromH', 'toH', 'minN', 'findings', 'test'].forEach(k => { if (meta[k] !== undefined) settings[k] = meta[k]; });
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
      'Kde jedla', 'Enzým', 'Deň bez ťažkostí', 'Množstvo', 'Čiarový kód'];
    const rows = [head];
    [...entries].sort((a, b) => a.ts - b.ts).forEach(e => {
      const d = new Date(e.ts);
      const day = days[dateStr(e.ts)] || {};
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
      for (const k of ['products', 'customTags', 'intol', 'favorites', 'fromH', 'toH', 'minN', 'findings', 'test']) {
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
    el.innerHTML = `<header class="lt"><div><h1>Nastavenia</h1></div></header>
      <h2 class="sub">Moje jedlo</h2><div class="dayrows">
        ${srow('intol-edit', 'warn', 'sym', 'Moje intolerancie', esc(risk.join(', ')) || 'Zatiaľ nič vybrané', risk.length || '')}
        ${srow('favs', 'star', 'sun', 'Obľúbené jedlá', '', favorites().length || '')}
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
        ${srow('rem-open', 'bell', 'sun', 'Večerná pripomienka', 'Udalosť do Kalendára v iPhone')}
        ${standalone ? '' : srow('install', 'phone', 'med', 'Pridať na plochu', 'Aby sa denník otváral ako aplikácia')}
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
    } else if (kind === 'rem') {
      title = 'Večerná pripomienka';
      body = grp('', `<p class="small muted" style="margin:0 0 12px">Aplikácia sama upozorniť nevie. Pripomienku ti však pridá do Kalendára v iPhone ako udalosť, ktorá sa opakuje každý deň.</p>
        <div class="stack"><select id="rem-time"><option value="19">19:00</option><option value="20" selected>20:00</option><option value="21">21:00</option><option value="22">22:00</option></select>
        <button type="button" class="btn block" data-act="reminder">Pridať do Kalendára</button></div>`);
    } else {
      title = 'Pridať na plochu';
      body = grp('', `<ol class="steps small"><li>Otvor túto stránku v <b>Safari</b>.</li><li>Ťukni na tlačidlo <b>Zdieľať</b> (štvorec so šípkou).</li>
        <li>Vyber <b>Pridať na plochu</b> a potvrď.</li><li>Odteraz otváraj denník len ikonou na ploche. Safari a ikona majú oddelené údaje.</li></ol>`);
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

    const ins = t.closest('[data-ins]');
    if (ins) { insTab = ins.dataset.ins; renderInsights(); return; }

    const pin = t.closest('[data-pin]');
    if (pin) { openFinding({ text: pin.dataset.pin.replace(/^[^\p{L}\p{N}]+/u, ''), status: 'sus' }); return; }

    const fnd = t.closest('[data-fnd]');
    if (fnd) { const f = findings().find(x => x.id === fnd.dataset.fnd); if (f) openFinding(f); return; }

    const fs = t.closest('[data-fs]');
    if (fs) { fDraft.status = fs.dataset.fs; $$('[data-fs]').forEach(c => c.classList.toggle('on', c === fs)); return; }

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
      case 'scan-test': location.href = 'sken-test.html'; break;
      case 'rem-open': openInfo('rem'); break;
      case 'install': openInfo('install'); break;
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
