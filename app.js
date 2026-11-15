/* Denník jedla a trávenia – celá aplikácia. Údaje zostávajú len v telefóne (IndexedDB). */
(function () {
  'use strict';

  const APP_VERSION = '2.0';
  const DAY = 864e5;

  // ---------- Číselníky ----------
  const TYPES = {
    food:    { label: 'Jedlo / pitie', csv: 'Jedlo/pitie', ico: '🍽️' },
    symptom: { label: 'Ťažkosti',      csv: 'Ťažkosti',    ico: '😣' },
    stool:   { label: 'Stolica',       csv: 'Stolica',     ico: '🚽' },
    med:     { label: 'Lieky / iné',   csv: 'Lieky/iné',   ico: '💊' },
  };
  const STOOL = [['tvrda', 'tvrdá'], ['normalna', 'normálna'], ['makka', 'mäkká'], ['hnacka', 'hnačka']];
  const PORTION = [['mala', 'malá'], ['normalna', 'normálna'], ['velka', 'veľká']];
  const TAGS = [
    ['mliecne', '🥛', 'mliečne / laktóza'], ['lepok', '🌾', 'lepok / pečivo'], ['fruktoza', '🍎', 'fruktóza / ovocie, med'],
    ['cesnak', '🧅', 'cibuľa / cesnak'], ['strukoviny', '🫘', 'strukoviny'], ['histamin', '🧀', 'histamín / zrejúce, údené'],
    ['kava', '☕', 'káva'], ['alkohol', '🍷', 'alkohol'], ['sycene', '🫧', 'sýtené nápoje'],
    ['sladidla', '🍬', 'sladidlá / light'], ['pikantne', '🌶️', 'pikantné'], ['mastne', '🍟', 'mastné / vyprážané'],
    ['surova', '🥗', 'surová zelenina'],
  ];
  const PLACES = [['doma', '🏠 doma'], ['restauracia', '🍴 reštaurácia / jedáleň'], ['niekto', '👥 u niekoho'], ['kupovane', '🛒 kupované hotové']];
  const KINDS = ['kŕč', 'nadúvanie', 'plynatosť', 'nevoľnosť', 'pálenie záhy', 'nutkanie na stolicu'];
  const LOCATION = [['horna', 'hore'], ['pupok', 'okolo pupka'], ['dolna', 'dole'], ['cele', 'celé brucho']];
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
    'rushed': '⏱️ jedlo v zhone', 'portion:velka': '🍽️ veľká porcia',
    'stress:high': '😬 stres 4–5 pri jedle', 'mood:low': '🙁 zlá nálada pri jedle',
    'sleep:zle': '😴 zlý spánok', 'period': '🩸 menštruácia',
    'activity:ziadny': '🛋️ deň bez pohybu', 'water:malo': '💧 málo pitia',
    'risk': '⚠️ obsahuje moje rizikové suroviny',
    'risk&enzyme': '💊 s enzýmom (laktáza…)', 'risk&away': '🍴 mimo domu', 'risk&stress': '😬 pri strese 4–5',
    'risk&period': '🩸 počas menštruácie', 'risk&sleep': '😴 po zlom spánku', 'risk&rushed': '⏱️ v zhone',
  };
  TAGS.forEach(([v, e, t]) => { CTX_LABELS['tag:' + v] = e + ' ' + t; CTX_LABELS['stack:' + v] = e + ' ' + t; });
  PLACES.forEach(([v, l]) => { CTX_LABELS['place:' + v] = l; });
  const tagLabel = t => { const x = TAGS.find(y => y[0] === t); return x ? x[1] + ' ' + x[2] : t; };

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

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
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
      tags: [], noTags: [], kinds: [], location: null, place: null, enzyme: false, tsOff: 0, tsCustom: false,
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
      <div id="scrim"></div>
      <div class="sheet tall" id="entry-sheet" role="dialog" aria-label="Záznam"><form id="entry-form" autocomplete="off" novalidate></form></div>
      <div class="sheet tall" id="trace-dialog" role="dialog" aria-label="Čo predchádzalo"></div>
      <div id="toast" role="status" aria-live="polite"></div>
      <input type="file" id="import-file" accept=".json,application/json" hidden>`;
  }

  function openSheet(id) {
    const s = document.getElementById(id);
    s.classList.add('open');
    s.scrollTop = 0;
    if (!openSheets.includes(id)) openSheets.push(id);
    syncScrim();
  }
  function closeSheet(id) {
    document.getElementById(id).classList.remove('open');
    openSheets = openSheets.filter(x => x !== id);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    syncScrim();
  }
  function syncScrim() {
    $('#scrim').classList.toggle('show', openSheets.length > 0);
    document.documentElement.classList.toggle('locked', openSheets.length > 0);
  }

  function render() {
    const v = currentView;
    if (v === 'today') renderToday();
    if (v === 'list') renderList();
    if (v === 'insights') renderInsights();
    if (v === 'settings') renderSettings();
  }

  function switchView(v) {
    currentView = v;
    $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    $$('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    render();
    window.scrollTo(0, 0);
  }

  function goDay(d) {
    selDay = d;
    followToday = d === todayStr();
    if (currentView === 'today') renderToday(); else switchView('today');
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
    return `<div class="banner"><div><b>💾 Čas na zálohu</b>${when}</div>
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
    return `<button type="button" class="btn block nosym${on ? ' on' : ''}" data-act="no-sym" data-date="${d}">👍 ${lbl}${on ? ' ✓' : ''}</button>`;
  }

  function dayText(v) {
    if (!v) return '';
    const parts = [];
    if (v.noSymptoms) parts.push('👍 bez ťažkostí');
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
      <div class="rb-legend"><span><i></i>jedlo</span><span><i class="s"></i>ťažkosti (väčší kruh = silnejšie)</span>${isToday ? '<span><i class="n"></i>teraz</span>' : ''}</div></div>`;
  }

  function entryRow(e) {
    const sev = e.type === 'symptom' && e.severity ? ` <span class="sev-pill" style="background:${sevColor(e.severity)}">${e.severity}/10</span>` : '';
    const m = metaText(e);
    let h = `<button type="button" class="entry ${e.type}${e.id === flashId ? ' flash' : ''}" data-id="${e.id}">
      <span class="time">${fmtTime(e.ts)}</span><span class="node"></span>
      <span class="ecard"><span class="desc">${e.type === 'food' ? '' : TYPES[e.type].ico + ' '}${esc(e.desc)}${sev}</span>${m ? `<span class="meta">${m}</span>` : ''}</span></button>`;
    if (e.type === 'symptom') h += `<button type="button" class="trace-btn" data-trace="${e.id}">🔎 Čo predchádzalo?</button>`;
    return h;
  }

  function dayCardHtml(d) {
    const v = days[d] || {};
    const isToday = d === todayStr();
    const ns = noSymBtn(d);
    const nsHtml = ns ? `<div style="margin-top:10px">${ns}${isToday ? '<p class="tiny" style="margin:6px 0 0;text-align:center">Ťukni večer, ak dnes nebolo nič. Spresní to vyhodnotenie.</p>' : ''}</div>` : '';
    if (dayFilled(v) === DAY_FIELDS.length && !todayExpanded) {
      return `<div class="card"><div class="today-summary"><span class="txt">✅ ${esc(dayText(v))}</span>
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
    if (isToday) h += bannerHtml();
    if (list.length) {
      h += ribbonHtml(list, d);
      h += '<div class="tl">' + list.map(entryRow).join('') + '</div>';
    } else {
      h += `<div class="card empty"><div class="big">🍽️</div>
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

  function descField(label, placeholder, opt) {
    const isFood = draft.type === 'food';
    const favs = isFood ? favorites() : [];
    const favSet = new Set(favs.map(f => f.desc.toLowerCase()));
    const q = quickFor(draft.type).filter(t => !favSet.has(t.toLowerCase()));
    const chipsHtml = favs.map((f, i) => `<button type="button" class="chip fav" data-fav="${i}">⭐ ${esc(f.desc)}</button>`).join('') +
      q.map(t => `<button type="button" class="chip" data-q="${esc(t)}">${esc(t)}</button>`).join('');
    const quick = chipsHtml ? `<div class="chips quick" style="margin-top:10px">${chipsHtml}</div>` : '';
    const favBtn = isFood ? `<button type="button" class="btn ghost small" id="fav-btn" data-act="fav" style="margin-top:6px">${favBtnText()}</button>` : '';
    return field(label, `<input type="text" id="f-desc" value="${esc(draft.desc)}" placeholder="${esc(placeholder)}" enterkeyhint="done">${favBtn}${quick}`, opt);
  }

  function isFav(desc) { const d = desc.trim().toLowerCase(); return !!d && favorites().some(f => f.desc.toLowerCase() === d); }
  function favBtnText() { return isFav(draft.desc) ? '★ V obľúbených (ťukni na odobratie)' : '☆ Uložiť ako obľúbené'; }

  function tagChips() {
    const eff = effectiveTags(), auto = autoTags(), risk = riskTags();
    return '<div class="chips" id="tag-chips">' + TAGS.map(([v, e, tt]) => {
      const on = eff.includes(v);
      const isAuto = on && auto.includes(v) && !draft.tags.includes(v);
      return `<button type="button" class="chip${on ? ' on' : ''}${risk.includes(v) ? ' risk' : ''}" data-tag="${v}">${e} ${esc(tt)}${isAuto ? ' ✨' : ''}</button>`;
    }).join('') + '</div>';
  }

  function riskWarnHtml() {
    const r = effectiveTags().filter(t => riskTags().includes(t));
    return r.length ? `<div class="risk-warn">⚠️ Pozor, pravdepodobne obsahuje: <b>${r.map(t => esc(tagLabel(t))).join(', ')}</b></div>` : '';
  }

  function refreshFoodExtras() {
    if (draft.type !== 'food') return;
    const tc = $('#tag-chips');
    if (tc) tc.outerHTML = tagChips();
    const rw = $('#risk-warn');
    if (rw) rw.innerHTML = riskWarnHtml();
    const fb = $('#fav-btn');
    if (fb) fb.textContent = favBtnText();
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
      toast('Uložené medzi obľúbené ⭐');
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
      if (src.portion && !append) { draft.portion = src.portion; const g = $('.chips[data-field="portion"]'); if (g) refreshGroup(g, draft.portion); }
    }
    const inp = $('#f-desc');
    if (inp) { inp.value = draft.desc; inp.classList.remove('invalid'); }
    refreshFoodExtras();
  }

  function timeField() {
    if (!draft.tsTouched && !editingId) draft.ts = Date.now();
    const custom = !!(editingId || draft.tsCustom);
    const chip = (m, l) => `<button type="button" class="chip${!custom && draft.tsOff === m ? ' on' : ''}" data-time="${m}">${l}</button>`;
    return field('Kedy?', `<div class="time-row">${chip(0, 'teraz')}${chip(30, '−30 min')}${chip(60, '−1 h')}${chip(120, '−2 h')}
        <button type="button" class="chip${custom ? ' on' : ''}" data-act="time-custom">iný čas</button></div>
      <input type="datetime-local" id="f-ts" value="${toLocalInput(draft.ts)}"${custom ? '' : ' hidden'}>`);
  }

  function moreBlock() {
    const open = draft.stress != null || draft.mood != null || draft.note;
    return `<details class="more"${open ? ' open' : ''}><summary>Stres, nálada, poznámka</summary>` +
      field('Stres teraz', chipGroup('stress', [1, 2, 3, 4, 5].map(n => [n, String(n)]), { kind: 'num', cls: 'scale s5' }) +
        '<div class="scale-ends"><span>pokoj</span><span>veľký stres</span></div>', true) +
      field('Nálada', chipGroup('mood', MOODS, { kind: 'num', cls: 'scale s5 emoji' }), true) +
      field('Poznámka', `<textarea id="f-note" placeholder="napr. jedla som neskoro, cestovanie…">${esc(draft.note)}</textarea>`, true) +
      '</details>';
  }

  // Na úvodnom kroku: jedným ťuknutím zopakovať obľúbené alebo časté jedlo
  function againHtml() {
    const favs = favorites();
    const favSet = new Set(favs.map(f => f.desc.toLowerCase()));
    const q = quickFor('food').filter(t => !favSet.has(t.toLowerCase())).slice(0, 8);
    if (!favs.length && !q.length) return '';
    return `<span class="label">Zapísať znova</span><div class="chips quick">` +
      favs.map((f, i) => `<button type="button" class="chip fav" data-af="${i}">⭐ ${esc(f.desc)}</button>`).join('') +
      q.map(t => `<button type="button" class="chip" data-aq="${esc(t)}">${esc(t)}</button>`).join('') + '</div>';
  }

  function renderForm() {
    const f = $('#entry-form');
    const t = draft.type;
    let h = `<div class="sheet-head"><h2>${editingId ? 'Upraviť záznam' : t ? TYPES[t].label : 'Čo chceš zapísať?'}</h2>
      <button type="button" class="x" data-act="cancel-edit" aria-label="Zavrieť">✕</button></div>`;
    h += `<div class="types${t ? ' picked' : ''}">` + Object.entries(TYPES).map(([k, v]) =>
      `<button type="button" class="type-btn${t === k ? ' on' : ''}" data-type="${k}"><span class="ico">${v.ico}</span>${v.label}</button>`
    ).join('') + '</div>';

    if (!t) { f.innerHTML = h + againHtml(); return; }

    if (t === 'food') {
      h += descField('Čo si jedla alebo pila?', 'napr. chlieb s maslom, káva s mliekom');
      h += `<div id="risk-warn">${riskWarnHtml()}</div>`;
      h += timeField();
      h += field('Porcia', chipGroup('portion', PORTION, { cls: 'seg' }), true);
      h += field('Obsahovalo', tagChips() + '<p class="tiny" style="margin:6px 0 0">✨ = rozpoznané z popisu. Ťuknutím zrušíš alebo pridáš.</p>', true);
      h += `<div class="field"><label class="check"><input type="checkbox" id="f-enzyme"${draft.enzyme ? ' checked' : ''}> 💊 Užila som laktázu / enzým</label></div>`;
      h += `<details class="more" id="ctx-more"${draft.place || draft.rushed ? ' open' : ''}><summary>Kde a ako som jedla</summary>` +
        field('Kde?', chipGroup('place', PLACES, {}), true) +
        `<div class="field"><label class="check"><input type="checkbox" id="f-rushed"${draft.rushed ? ' checked' : ''}> ⏱️ Jedla som v zhone / v strese</label></div></details>`;
      h += moreBlock();
    } else if (t === 'symptom') {
      h += field('Aké ťažkosti?', chipGroup('kinds', KINDS, { multi: true }));
      h += field('Sila ťažkostí', chipGroup('severity', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]),
        { kind: 'num', cls: 'scale s10', chipCls: v => 'sev-' + v }) +
        '<div class="scale-ends"><span>1 = slabé</span><span>10 = neznesiteľné</span></div>');
      h += timeField();
      h += field('Kde to bolí?', chipGroup('location', LOCATION, {}), true);
      h += field('Ako dlho to trvalo?', chipGroup('duration', DURATIONS, {}) +
        `<input type="text" id="f-duration" style="margin-top:10px" value="${esc(draft.duration)}" placeholder="alebo napíš, napr. 40 min" enterkeyhint="done">`, true);
      h += descField('Popis vlastnými slovami', 'napr. bodavá bolesť po jedle', true);
      h += moreBlock();
    } else if (t === 'stool') {
      h += field('Typ stolice', chipGroup('stool', STOOL, { cls: 'seg' }));
      h += descField('Popis', 'napr. s hlienom, nutkanie', true);
      h += timeField();
      h += moreBlock();
    } else if (t === 'med') {
      h += descField('Aký liek alebo čo iné?', 'napr. ibuprofén 400 mg, cvičenie');
      h += timeField();
      h += moreBlock();
    }

    h += `<div class="savebar">
      ${editingId ? '<button type="button" class="btn danger" data-act="delete">Zmazať</button>' : ''}
      <button type="submit" class="btn primary">${editingId ? 'Uložiť zmeny' : 'Uložiť'}</button>
    </div>`;
    f.innerHTML = h;
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
    if (!d.ts || isNaN(d.ts)) return ['f-ts', 'Skontroluj dátum a čas'];
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
      place: d.place, enzyme: !!d.enzyme,
    });
    if (type === 'symptom') Object.assign(e, { severity: d.severity, duration: d.duration.trim(), kinds: d.kinds.slice(), location: d.location });
    if (type === 'stool') Object.assign(e, { stool: d.stool });

    try {
      await DB.put('entries', e);
    } catch (ex) {
      toast('Nepodarilo sa uložiť 😕');
      console.error(ex);
      return;
    }
    if (old) entries[entries.indexOf(old)] = e; else entries.push(e);
    if (!meta.firstUse) await setMeta('firstUse', Date.now());
    // ťažkosti v deň označený „bez ťažkostí“ → zrušiť označenie
    const dd = days[dateStr(e.ts)];
    if (type === 'symptom' && dd && dd.noSymptoms) { delete dd.noSymptoms; await DB.put('days', dd); }

    const wasEditing = !!editingId;
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet');
    flashId = e.id;
    toast(wasEditing ? 'Zmeny uložené ✓' : 'Uložené ✓');
    if (currentView === 'today') { selDay = dateStr(e.ts); followToday = selDay === todayStr(); }
    render();
  }

  function openEntry() {
    editingId = null;
    draft = newDraft();
    if (currentView === 'today' && selDay !== todayStr()) {
      draft.ts = parseDay(selDay).getTime() + 12 * 3600e3;
      draft.tsTouched = true;
      draft.tsCustom = true;
    }
    renderForm();
    openSheet('entry-sheet');
  }

  function draftDirty() {
    const d = draft;
    return !!(d.desc.trim() || d.kinds.length || d.severity != null || d.stool || d.note.trim());
  }

  function cancelEntry() {
    if (!editingId && draftDirty() && !confirm('Zahodiť rozpracovaný záznam?')) return;
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet');
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
    renderForm();
    openSheet('entry-sheet');
  }

  async function deleteCurrent() {
    if (!editingId) return;
    if (!confirm('Naozaj zmazať tento záznam?')) return;
    await DB.del('entries', editingId);
    entries = entries.filter(e => e.id !== editingId);
    editingId = null;
    draft = newDraft();
    closeSheet('entry-sheet');
    toast('Záznam zmazaný');
    render();
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

  function metaText(e) {
    const p = [];
    if (e.type === 'food') {
      if (e.place && e.place !== 'doma') p.push(lab(PLACES, e.place));
      if (e.portion) p.push(lab(PORTION, e.portion) + ' porcia');
      const risk = riskTags();
      Analysis.mealTags(e).forEach(t => { const x = TAGS.find(y => y[0] === t); if (x) p.push((risk.includes(t) ? '⚠️' : '') + x[1] + ' ' + x[2]); });
      if (e.enzyme) p.push('💊 enzým');
      if (e.rushed) p.push('⏱️ v zhone');
    }
    if (e.type === 'symptom') {
      if (e.kinds && e.kinds.length && e.desc !== e.kinds.join(', ')) p.push(e.kinds.join(', '));
      if (e.location) p.push(lab(LOCATION, e.location));
      if (e.duration) p.push(e.duration);
    }
    if (e.type === 'stool' && e.stool && e.desc !== lab(STOOL, e.stool)) p.push(lab(STOOL, e.stool));
    if (e.stress != null) p.push('stres ' + e.stress);
    if (e.mood != null) p.push('nálada ' + MOODS.find(m => m[0] === e.mood)[1]);
    let s = esc(p.join(' · '));
    if (e.note) s += (s ? '<br>' : '') + '📝 ' + esc(e.note);
    return s;
  }

  function renderList() {
    const el = $('#view-list');
    let h = `<header class="lt"><div><h1>Kalendár</h1><p>Ťukni na deň a otvorí sa jeho denník.</p></div></header>` + renderCalendar();
    const byDay = new Map();
    entries.forEach(e => {
      const d = dateStr(e.ts);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    });
    const dates = [...byDay.keys()].sort().reverse();
    if (!dates.length) {
      el.innerHTML = h + `<div class="card empty"><div class="big">📔</div><p><b>Zatiaľ žiadne záznamy</b><br>Prvý zapíšeš tlačidlom ＋ dole.</p></div>`;
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
        (away ? `<span>🍴 mimo domu ${away}×</span>` : '') + '</div></div>';
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
        if (e.enzyme) extra.push('💊 enzým');
        if (e.rushed) extra.push('⏱️ v zhone');
        if (e.portion === 'velka') extra.push('veľká porcia');
      }
      if (e.type === 'symptom' && e.severity) extra.push('sila ' + e.severity);
      if (e.stress >= 4) extra.push('stres ' + e.stress);
      return `<div class="trace-row${rt.length ? ' hot' : ''}">
        <span class="ago">${agoText(s.ts - e.ts)}</span>
        <span><b>${TYPES[e.type].ico} ${esc(e.desc)}</b>
        ${tags.length ? `<div class="tiny">${tags.map(t => (risk.includes(t) ? '⚠️ ' : '') + esc(tagLabel(t))).join(' · ')}</div>` : ''}
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

  function resItem(r, kind) {
    let name = r.group === 'food' ? r.label : (CTX_LABELS[r.key] || r.key);
    let txt, a = 's tým', b = 'inak';
    if (kind === 'day') {
      txt = `Ťažkosti v ${r.withHit} z ${r.withN} takých dní (${pct(r.rateWith)}) · inak ${pct(r.rateWithout)}`;
    } else if (kind === 'stack') {
      name += ' – 2× a viac za 12 h';
      txt = `Pri 2× a viac: ťažkosti po ${r.withHit} z ${r.withN} (${pct(r.rateWith)}) · pri 1×: ${r.outHit} z ${r.outN} (${pct(r.rateWithout)})`;
      a = '2× a viac'; b = '1×';
    } else if (kind === 'risk') {
      txt = `Ťažkosti po ${r.withHit} z ${r.withN} takých jedál (${pct(r.rateWith)}) · inak po ${r.outHit} z ${r.outN} (${pct(r.rateWithout)})`;
    } else {
      txt = `Ťažkosti po ${r.withHit} z ${r.withN} jedál (${pct(r.rateWith)}) · inak po ${pct(r.rateWithout)}`;
      if (r.group === 'food') a = 's ním';
    }
    return `<div class="res lvl-${r.level}">
      <div class="res-top"><span class="res-name">${esc(name)}</span><span class="ratio">${ratioText(r)}</span></div>
      <div class="res-txt">${txt}</div>
      <div class="bars">
        <span>${a}</span><div class="bar w"><i style="width:${Math.round(r.rateWith * 100)}%"></i></div><span>${pct(r.rateWith)}</span>
        <span>${b}</span><div class="bar o"><i style="width:${Math.round(r.rateWithout * 100)}%"></i></div><span>${pct(r.rateWithout)}</span>
      </div></div>`;
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
    let h = sus.length ? sus.map(x => resItem(x, kind)).join('') : '<p class="muted small" style="margin:4px 0">Zatiaľ nič nevyzerá podozrivo. 👍</p>';
    if (rest.length) h += `<details class="more"><summary>Bez zjavného súvisu (${rest.length})</summary>${rest.map(x => resItem(x, kind)).join('')}</details>`;
    return h;
  }

  function sel(id, val, options) {
    return `<select id="${id}">${options.map(([v, l]) => `<option value="${v}"${v === val ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  }

  function renderInsights() {
    const el = $('#view-insights');
    const fromH = meta.fromH != null ? meta.fromH : 0;
    const toH = meta.toH != null ? meta.toH : 6;
    const minN = meta.minN || 5;
    const r = Analysis.analyze(entries, days, { fromH, toH, minN, riskTags: riskTags() });
    const r2 = toH < 12 ? Analysis.analyze(entries, days, { fromH: 12, toH: 48, minN, riskTags: riskTags() }) : null;

    const optsHtml = `<div class="card"><h3>Nastavenie výpočtu</h3><div class="opts">
      <label>Ťažkosti od${sel('o-from', fromH, [[0, '0 h'], [1, '1 h'], [2, '2 h'], [3, '3 h']])}</label>
      <label>do${sel('o-to', toH, [[2, '2 h'], [3, '3 h'], [4, '4 h'], [6, '6 h'], [8, '8 h'], [12, '12 h'], [24, '24 h']])}</label>
      <label>Min. výskytov${sel('o-min', minN, [[3, '3×'], [5, '5×'], [8, '8×'], [10, '10×']])}</label>
    </div><p class="tiny" style="margin:8px 0 0">Ťažkosti sa priradia k jedlu, ak prišli ${fromH}–${toH} h po ňom.</p></div>`;

    let h = `<header class="lt"><div><h1>Súvislosti</h1><p>Po čom prichádzajú ťažkosti častejšie.</p></div></header>
      <div class="disclaimer"><b>ℹ️ Len pomôcka, nie diagnóza</b>
      Tieto čísla ukazujú, čo sa časovo zhoduje, nie čo ťažkosti naozaj spôsobuje. Slúžia ako podklad na rozhovor s lekárom.
      Jedlo ani lieky nevynechávaj bez dohody s lekárom.</div>`;

    h += `<div class="stat-row">
      <div class="stat"><div class="n">${r.totalN}</div><div class="l">vyhodnotených jedál</div></div>
      <div class="stat"><div class="n">${r.symptomCount}</div><div class="l">záznamov ťažkostí</div></div>
      <div class="stat"><div class="n">${r.totalN ? pct(r.baseRate) : '–'}</div><div class="l">jedál s ťažkosťami po nich</div></div>
    </div>`;

    if (r.totalN < 10 || r.symptomCount < 3) {
      h += `<div class="card"><h3>📈 Zbierame údaje</h3><p class="muted small" style="margin:0">
        Vyhodnotenie začne dávať zmysel asi po 2 týždňoch pravidelného zapisovania
        (aspoň 10 jedál a 3 záznamy ťažkostí). Zapisuj všetko, aj dni bez ťažkostí, tie sú rovnako dôležité.</p>
        ${pendingList(r.foodsPending, minN, true)}</div>`;
      el.innerHTML = h + optsHtml;
      return;
    }

    h += `<div class="card"><h2>🍽️ Jedlá a suroviny</h2>`;
    h += resList(r.foods, 'meal', `Zatiaľ žiadna surovina nemá ${minN} výskytov.`);
    h += pendingList(r.foodsPending, minN, true) + '</div>';

    if (r.ctx.length || r.ctxPending.length) {
      h += `<div class="card"><h2>🧾 Skupiny a okolnosti jedla</h2>`;
      h += resList(r.ctx, 'meal');
      h += pendingList(r.ctxPending, minN, false) + '</div>';
    }
    // Rizikové jedlo – kedy vadí viac
    h += `<div class="card"><h2>⚠️ Rizikové jedlo – kedy vadí viac</h2>`;
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
      h += `<div class="card"><h2>📚 Hromadenie</h2><p class="tiny" style="margin:0 0 6px">Vadí, keď sa tá istá skupina za 12 h nazbiera viackrát?</p>`;
      h += resList(r.stacking, 'stack');
      h += '</div>';
    }

    if (r2 && r2.totalN >= 10) {
      const late = r2.foods.concat(r2.ctx.filter(x => x.key.startsWith('tag:'))).filter(x => x.level !== 'none').sort((a, b) => b.ratio - a.ratio || b.rateWith - a.rateWith);
      h += `<div class="card"><h2>🌙 Na druhý deň (12–48 h)</h2><p class="tiny" style="margin:0 0 6px">Niektoré intolerancie sa prejavia až neskôr. Tu sú jedlá, po ktorých prišli ťažkosti o 12–48 h.</p>`;
      h += late.length ? late.slice(0, 15).map(x => resItem(x, 'meal')).join('') : '<p class="muted small" style="margin:4px 0">Nič výrazné. 👍</p>';
      h += '</div>';
    }

    if (r.days.length || r.daysPending.length) {
      h += `<div class="card"><h2>📅 Deň</h2><p class="tiny" style="margin:0 0 6px">Porovnáva dni s ťažkosťami a bez nich (${r.dayTotal} dní s údajmi).</p>`;
      h += resList(r.days, 'day');
      h += pendingList(r.daysPending, minN, false) + '</div>';
    }

    if (r.skipped) h += `<p class="tiny">${r.skipped} jedál nie je zarátaných, lebo v ten deň nie sú zapísané ťažkosti ani „Deň bez ťažkostí“.</p>`;

    h += `<div class="card"><h3>Ako to čítať</h3><p class="small muted" style="margin:0">
      <b>2×</b> znamená, že po tomto jedle prišli ťažkosti dvakrát častejšie ako po ostatných jedlách.
      Na vrchu sú najpodozrivejšie. Jedno jedlo obsahuje viac surovín, preto môže vyzerať podozrivo aj niečo,
      čo sa jedáva spolu s pravým vinníkom. Červené = výrazný rozdiel, oranžové = mierny.
      „Výrazne“ znamená, že bez tohto jedla sa ťažkosti v sledovanom čase neobjavili vôbec.</p></div>`;
    el.innerHTML = h + optsHtml;
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
    ['intol', 'favorites', 'fromH', 'toH', 'minN'].forEach(k => { if (meta[k] !== undefined) settings[k] = meta[k]; });
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
      'Kde jedla', 'Enzým', 'Deň bez ťažkostí'];
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
        e.place ? lab(PLACES, e.place).replace(/^\S+ /, '') : '', e.type === 'food' ? (e.enzyme ? 'áno' : 'nie') : '',
        day.noSymptoms ? 'áno' : '',
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
      for (const k of ['intol', 'favorites', 'fromH', 'toH', 'minN']) {
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

  function renderSettings() {
    const el = $('#view-settings');
    const lb = meta.lastBackup;
    const lbTxt = lb ? 'Posledná záloha: ' + daysAgoText(Math.floor((Date.now() - lb) / DAY)) +
      ' (' + new Date(lb).toLocaleDateString('sk-SK') + ')' : 'Zatiaľ si zálohu neurobila.';
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const favs = favorites();
    el.innerHTML = `<header class="lt"><div><h1>Nastavenia</h1></div></header>
      <div class="card"><h2>⚠️ Moje intolerancie</h2>
        <p class="small muted" style="margin-top:0">Označ, čo ti vadí. Aplikácia ťa upozorní pri zápise a vyhodnotí, kedy ti to vadí viac.</p>
        <div class="chips">${TAGS.map(([v, e, t]) => `<button type="button" class="chip${riskTags().includes(v) ? ' on' : ''}" data-intol="${v}">${e} ${esc(t)}</button>`).join('')}</div>
      </div>
      <div class="card"><h2>⭐ Obľúbené jedlá</h2>
        ${favs.length ? '<div class="fav-list">' + favs.map((f, i) => `<div class="fav-row"><span>${esc(f.desc)}</span>
          <button type="button" class="btn ghost small" data-act="fav-del" data-i="${i}" aria-label="Odobrať">✕</button></div>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Pri zápise jedla ťukni na <b>☆ Uložiť ako obľúbené</b>. Potom ho zapíšeš jedným ťuknutím.</p>'}
      </div>
      <div class="card"><h2>💾 Záloha</h2>
        <p class="small muted" style="margin-top:0">Údaje sú uložené <b>len v tomto telefóne</b>. Raz týždenne si ulož zálohu,
        napr. do aplikácie Súbory, na iCloud alebo si ju pošli e-mailom.</p>
        <p class="small"><b>${esc(lbTxt)}</b></p>
        <div class="stack">
          <button type="button" class="btn primary block" data-act="backup">💾 Uložiť zálohu</button>
          <button type="button" class="btn block" data-act="restore">📂 Obnoviť zo zálohy</button>
        </div></div>
      <div class="card"><h2>📄 Pre lekára</h2>
        <p class="small muted" style="margin-top:0">Tabuľka všetkých záznamov, otvorí sa v Exceli alebo Numbers.</p>
        <button type="button" class="btn block" data-act="csv">📄 Export do tabuľky (CSV)</button></div>
      ${standalone ? '' : `<div class="card"><h2>📱 Pridať na plochu</h2><ol class="steps small">
        <li>Otvor túto stránku v <b>Safari</b>.</li>
        <li>Ťukni na tlačidlo <b>Zdieľať</b> (štvorec so šípkou).</li>
        <li>Vyber <b>Pridať na plochu</b> a potvrď.</li>
        <li>Odteraz otváraj denník ikonou na ploche.</li></ol></div>`}
      <div class="card"><h3>Údaje v telefóne</h3>
        <p class="small muted" style="margin-top:0">${entries.length} záznamov · ${Object.keys(days).length} dní s údajmi o dni</p>
        <button type="button" class="btn danger block" data-act="wipe">Vymazať všetky údaje</button></div>
      <p class="tiny" style="text-align:center">Denník jedla ${APP_VERSION} · funguje aj bez internetu · nič sa neodosiela</p>`;
  }

  // ---------- Udalosti ----------
  buildShell();

  document.addEventListener('click', async ev => {
    const t = ev.target;

    if (t.id === 'scrim') {
      const top = openSheets[openSheets.length - 1];
      if (top === 'entry-sheet') cancelEntry(); else if (top) closeSheet(top);
      return;
    }

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
      if (draft.type !== ty) {
        if (editingId) draft.type = ty;
        else {
          const keep = draft.tsTouched ? { ts: draft.ts, tsTouched: true, tsOff: draft.tsOff, tsCustom: draft.tsCustom } : null;
          draft = newDraft(ty);
          if (keep) Object.assign(draft, keep);
        }
      } else if (!editingId) {
        const keep = draft.tsCustom ? { ts: draft.ts, tsTouched: true, tsCustom: true } : null;
        draft = newDraft();
        if (keep) Object.assign(draft, keep);
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
      const src = entries.filter(e => e.type === draft.type && (e.desc || '').trim().toLowerCase() === val.toLowerCase())
        .sort((a, b) => b.ts - a.ts)[0];
      applyQuick(val, src);
      return;
    }

    const fv = t.closest('.chip[data-fav]');
    if (fv) { const f = favorites()[Number(fv.dataset.fav)]; if (f) applyQuick(f.desc, f); return; }

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
      const inp = $('#f-ts');
      inp.value = toLocalInput(draft.ts);
      inp.hidden = true;
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
      if (f === 'duration') $('#f-duration').value = draft.duration;
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
        renderSettings();
        break;
      }
      case 'no-sym': {
        const d = act.dataset.date || todayStr();
        await setDayField(d, 'noSymptoms', true);
        if (days[d] && !days[d].noSymptoms) delete days[d].noSymptoms;
        toast(days[d] && days[d].noSymptoms ? 'Super, deň bez ťažkostí 👍' : 'Označenie zrušené');
        render();
        break;
      }
      case 'time-custom': {
        draft.tsCustom = true;
        draft.tsTouched = true;
        $$('.time-row .chip').forEach(c => c.classList.toggle('on', c === act));
        $('#f-ts').hidden = false;
        break;
      }
      case 'cal-prev': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderList(); break;
      case 'cal-next': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderList(); break;
      case 'trace-close': closeSheet('trace-dialog'); break;
    }
  });

  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'f-desc') { draft.desc = t.value; t.classList.remove('invalid'); refreshFoodExtras(); }
    else if (t.id === 'f-note') draft.note = t.value;
    else if (t.id === 'f-duration') {
      draft.duration = t.value;
      const g = $('.chips[data-field="duration"]');
      if (g) refreshGroup(g, draft.duration);
    }
  });

  document.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.id === 'f-ts') {
      const v = new Date(t.value).getTime();
      if (!isNaN(v)) { draft.ts = v; draft.tsTouched = true; t.classList.remove('invalid'); }
    } else if (t.id === 'f-rushed') draft.rushed = t.checked;
    else if (t.id === 'f-enzyme') draft.enzyme = t.checked;
    else if (t.id === 'o-from' || t.id === 'o-to' || t.id === 'o-min') {
      let from = Number($('#o-from').value), to = Number($('#o-to').value);
      if (to <= from) { to = from + 2; }
      await setMeta('fromH', from);
      await setMeta('toH', to);
      await setMeta('minN', Number($('#o-min').value));
      renderInsights();
    } else if (t.id === 'import-file' && t.files && t.files[0]) {
      await doImport(t.files[0]);
      t.value = '';
    }
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type === 'text') {
      ev.preventDefault();
      ev.target.blur();
    }
    if (ev.key === 'Escape' && openSheets.length) $('#scrim').click();
  });

  $('#entry-form').addEventListener('submit', ev => { ev.preventDefault(); saveDraft(); });

  // Pri návrate do aplikácie obnov čas „teraz“ a dnešný deň
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (openSheets.includes('entry-sheet')) {
      if (!draft.tsTouched && !editingId) {
        draft.ts = Date.now();
        const inp = $('#f-ts');
        if (inp) inp.value = toLocalInput(draft.ts);
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
      document.querySelector('main').innerHTML = '<div class="card empty"><div class="big">⚠️</div><p>Úložisko v tomto prehliadači nefunguje. Skús otvoriť stránku v Safari (nie v súkromnom režime).</p></div>';
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
