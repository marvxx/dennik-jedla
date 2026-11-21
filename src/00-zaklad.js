
  const APP_VERSION = '3.6';

  // Vzhľad: automaticky podľa telefónu, alebo ručne svetlý/tmavý (pamätá si ho tento prehliadač)
  const THEME_BG = { light: '#edf2f1', dark: '#0d1719' };
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
    // farba stavového riadku
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
      const dark = /dark/.test(m.media || '');
      m.content = t === 'light' || t === 'dark' ? THEME_BG[t] : THEME_BG[dark ? 'dark' : 'light'];
    });
  }
  const savedTheme = () => { try { return localStorage.getItem('dennik-theme') || 'auto'; } catch (_) { return 'auto'; } };
  applyTheme(savedTheme());

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
    drop: '<path d="M12 3.500c3 3.700 6 7.200 6 10.500a6 6 0 0 1-12 0c0-3.300 3-6.800 6-10.500z"/>',
    cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.500h1.500a2.500 2.500 0 0 1 0 5H16M8 3.500c-.700 1 .700 2 0 3M12 3.500c-.700 1 .700 2 0 3"/>',
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
    ['activity', 'Pohyb', ACTIVITY, 'str'],
  ];   // pitie sa počíta pohármi vody (karta Voda a káva); staré „málo/dosť“ ostáva v údajoch
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

