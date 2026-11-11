/* Denník jedla a trávenia – celá aplikácia. Údaje zostávajú len v telefóne (IndexedDB). */
(function () {
  'use strict';

  const APP_VERSION = '1.0';
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
    ['kava', '☕', 'káva'], ['alkohol', '🍷', 'alkohol'], ['mliecne', '🥛', 'mliečne'],
    ['pikantne', '🌶️', 'pikantné'], ['mastne', '🍟', 'mastné / vyprážané'], ['sycene', '🫧', 'sýtené nápoje'],
    ['sladidla', '🍬', 'sladidlá / light'], ['lepok', '🌾', 'pečivo / cestoviny'], ['strukoviny', '🫘', 'strukoviny'],
    ['surova', '🥗', 'surová zelenina'],
  ];
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
  };
  TAGS.forEach(([v, e, t]) => { CTX_LABELS['tag:' + v] = e + ' ' + t; });

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
  let currentView = 'add';

  function newDraft(type) {
    return {
      type: type || null, ts: Date.now(), tsTouched: false, desc: '', severity: null, duration: '',
      stool: null, stress: null, mood: null, note: '', portion: null, rushed: false,
      tags: [], kinds: [], location: null,
    };
  }

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
  const TITLES = { add: 'Zapísať', list: 'Prehľad', insights: 'Súvislosti', settings: 'Záloha a export' };

  function switchView(v) {
    currentView = v;
    $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    $$('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    $('#title').textContent = editingId && v === 'add' ? 'Upraviť' : TITLES[v];
    if (v === 'add') renderAdd();
    if (v === 'list') renderList();
    if (v === 'insights') renderInsights();
    if (v === 'settings') renderSettings();
    window.scrollTo(0, 0);
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

  // ---------- Zapísať ----------
  function renderAdd() {
    renderBackupBanner();
    renderToday();
    renderForm();
  }

  function needsBackup() {
    if (!entries.length) return null;
    const ref = meta.lastBackup || meta.firstUse;
    if (!ref) return null;
    const n = Math.floor((Date.now() - ref) / DAY);
    return n >= 7 ? n : null;
  }

  function renderBackupBanner() {
    const el = $('#backup-banner');
    const n = needsBackup();
    if (n == null || editingId) { el.innerHTML = ''; return; }
    const when = meta.lastBackup ? 'Posledná záloha ' + daysAgoText(n) + '.' : 'Zatiaľ si zálohu neurobila.';
    el.innerHTML = `<div class="banner"><div><b>💾 Čas na zálohu</b>${when}</div>
      <button type="button" class="btn small primary" data-act="backup">Zálohovať</button></div>`;
  }

  function dayRows(date, v) {
    return DAY_FIELDS.map(([f, l, list, kind]) =>
      `<div class="row"><span class="k">${l}</span>${chipGroup(f, list, { value: v[f], kind, cls: 'seg', day: date })}</div>`
    ).join('');
  }

  function dayText(v) {
    if (!v) return '';
    const parts = [];
    if (v.sleep != null) parts.push('spánok ' + lab(SLEEP, v.sleep));
    if (v.period != null) parts.push(v.period ? 'menštruácia' : 'bez menštruácie');
    if (v.activity != null) parts.push('pohyb ' + lab(ACTIVITY, v.activity));
    if (v.water != null) parts.push('pitie ' + lab(WATER, v.water));
    return parts.join(' · ');
  }

  function dayFilled(v) { return v ? DAY_FIELDS.filter(([f]) => v[f] != null).length : 0; }

  function renderToday() {
    const el = $('#today-card');
    if (editingId) { el.innerHTML = ''; return; }
    const d = todayStr();
    const v = days[d] || {};
    if (dayFilled(v) === DAY_FIELDS.length && !todayExpanded) {
      el.innerHTML = `<div class="card today-summary"><span class="txt">✅ Dnes: ${esc(dayText(v))}</span>
        <button type="button" class="btn ghost small" data-act="today-edit">Upraviť</button></div>`;
      return;
    }
    el.innerHTML = `<div class="card today"><h3>Dnešný deň <span class="tiny">· raz za deň, nepovinné</span></h3>
      ${dayRows(d, v)}
      ${todayExpanded ? '<div class="dialog-actions"><button type="button" class="btn small" data-act="today-done">Hotovo</button></div>' : ''}
    </div>`;
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
    const q = quickFor(draft.type);
    const quick = q.length ? `<div class="chips quick" style="margin-top:10px">${q.map(t =>
      `<button type="button" class="chip" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : '';
    return field(label, `<input type="text" id="f-desc" value="${esc(draft.desc)}" placeholder="${esc(placeholder)}" enterkeyhint="done">${quick}`, opt);
  }

  function timeField() {
    if (!draft.tsTouched && !editingId) draft.ts = Date.now();
    return field('Kedy?', `<input type="datetime-local" id="f-ts" value="${toLocalInput(draft.ts)}">
      <div class="time-row">
        <button type="button" class="chip" data-time="0">teraz</button>
        <button type="button" class="chip" data-time="30">pred 30 min</button>
        <button type="button" class="chip" data-time="60">pred 1 h</button>
        <button type="button" class="chip" data-time="120">pred 2 h</button>
      </div>`);
  }

  function stressMoodNote() {
    return field('Stres teraz', chipGroup('stress', [1, 2, 3, 4, 5].map(n => [n, String(n)]), { kind: 'num', cls: 'scale s5' }) +
        '<div class="scale-ends"><span>pokoj</span><span>veľký stres</span></div>', true) +
      field('Nálada', chipGroup('mood', MOODS, { kind: 'num', cls: 'scale s5 emoji' }), true) +
      field('Poznámka', `<textarea id="f-note" placeholder="napr. zlý spánok, deň cyklu, jedla v zhone…">${esc(draft.note)}</textarea>`, true);
  }

  function renderForm() {
    const f = $('#entry-form');
    const t = draft.type;
    let h = '';
    if (editingId) {
      h += `<div class="edit-head"><h2>Upraviť záznam</h2><button type="button" class="btn ghost" data-act="cancel-edit">Zrušiť</button></div>`;
    } else {
      h += `<span class="label">Čo chceš zapísať?</span>`;
    }
    h += `<div class="types${t ? ' picked' : ''}">` + Object.entries(TYPES).map(([k, v]) =>
      `<button type="button" class="type-btn${t === k ? ' on' : ''}" data-type="${k}"><span class="ico">${v.ico}</span>${v.label}</button>`
    ).join('') + '</div>';

    if (!t) { f.innerHTML = h; return; }

    if (t === 'food') {
      h += descField('Čo si jedla alebo pila?', 'napr. chlieb s maslom, káva s mliekom');
      h += timeField();
      h += field('Porcia', chipGroup('portion', PORTION, { cls: 'seg' }), true);
      h += field('Obsahovalo', chipGroup('tags', TAGS.map(([v, e, tt]) => [v, e + ' ' + tt]), { multi: true }), true);
      h += `<div class="field"><label class="check"><input type="checkbox" id="f-rushed"${draft.rushed ? ' checked' : ''}> ⏱️ Jedla som v zhone / v strese</label></div>`;
      h += stressMoodNote();
    } else if (t === 'symptom') {
      h += field('Aké ťažkosti?', chipGroup('kinds', KINDS, { multi: true }));
      h += field('Sila ťažkostí', chipGroup('severity', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]),
        { kind: 'num', cls: 'scale s10', chipCls: v => 'sev-' + v }) +
        '<div class="scale-ends"><span>1 = slabé</span><span>10 = neznesiteľné</span></div>');
      h += field('Kde to bolí?', chipGroup('location', LOCATION, {}), true);
      h += field('Ako dlho to trvalo?', chipGroup('duration', DURATIONS, {}) +
        `<input type="text" id="f-duration" style="margin-top:10px" value="${esc(draft.duration)}" placeholder="alebo napíš, napr. 40 min" enterkeyhint="done">`, true);
      h += descField('Popis vlastnými slovami', 'napr. bodavá bolesť po jedle', true);
      h += timeField();
      h += stressMoodNote();
    } else if (t === 'stool') {
      h += field('Typ stolice', chipGroup('stool', STOOL, { cls: 'seg' }));
      h += descField('Popis', 'napr. s hlienom, nutkanie', true);
      h += timeField();
      h += stressMoodNote();
    } else if (t === 'med') {
      h += descField('Aký liek alebo čo iné?', 'napr. ibuprofén 400 mg, cvičenie');
      h += timeField();
      h += stressMoodNote();
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
    if (type === 'food') Object.assign(e, { portion: d.portion, rushed: !!d.rushed, tags: d.tags.slice() });
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

    const wasEditing = !!editingId;
    editingId = null;
    draft = newDraft();
    toast(wasEditing ? 'Zmeny uložené ✓' : 'Uložené ✓');
    if (wasEditing) switchView('list');
    else { renderAdd(); window.scrollTo(0, 0); }
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
    draft.kinds = draft.kinds || [];
    switchView('add');
  }

  async function deleteCurrent() {
    if (!editingId) return;
    if (!confirm('Naozaj zmazať tento záznam?')) return;
    await DB.del('entries', editingId);
    entries = entries.filter(e => e.id !== editingId);
    editingId = null;
    draft = newDraft();
    toast('Záznam zmazaný');
    switchView('list');
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
  function sevColor(s) { return s >= 7 ? '#c4553b' : s >= 4 ? '#d39a2c' : '#6aa36f'; }

  function metaText(e) {
    const p = [];
    if (e.type === 'food') {
      if (e.portion) p.push(lab(PORTION, e.portion) + ' porcia');
      (e.tags || []).forEach(t => { const x = TAGS.find(y => y[0] === t); if (x) p.push(x[1] + ' ' + x[2]); });
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
    if (!entries.length) {
      el.innerHTML = `<div class="empty"><div class="big">📔</div><p>Zatiaľ žiadne záznamy.<br>Začni na karte <b>Zapísať</b>.</p></div>`;
      return;
    }
    const byDay = new Map();
    [...entries].sort((a, b) => a.ts - b.ts).forEach(e => {
      const d = dateStr(e.ts);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    });
    const dates = [...byDay.keys()].sort().reverse();
    let h = '';
    for (const d of dates.slice(0, listDays)) {
      const info = dayText(days[d]);
      h += `<div class="day"><div class="day-head"><h2>${fmtDayHead(d)}</h2>
        <button type="button" class="btn ghost small" data-act="day-edit" data-date="${d}">${info ? 'deň ✎' : '+ údaje o dni'}</button></div>`;
      if (info) h += `<div class="day-info">${esc(info)}</div>`;
      for (const e of byDay.get(d)) {
        const sev = e.type === 'symptom' && e.severity ? ` <span class="sev-pill" style="background:${sevColor(e.severity)}">${e.severity}/10</span>` : '';
        const m = metaText(e);
        h += `<button type="button" class="entry ${e.type}" data-id="${e.id}">
          <span class="badge">${TYPES[e.type].ico}</span>
          <span><div class="desc">${esc(e.desc)}${sev}</div>${m ? `<div class="meta">${m}</div>` : ''}</span>
          <span class="time">${fmtTime(e.ts)}</span></button>`;
      }
      h += '</div>';
    }
    if (dates.length > listDays) h += `<button type="button" class="btn block" data-act="more-days">Zobraziť staršie dni</button>`;
    el.innerHTML = h;
  }

  function openDayDialog(date) {
    const dlg = $('#day-dialog');
    dlg.innerHTML = `<h2>${esc(fmtDateLong(date))}</h2><div class="today">${dayRows(date, days[date] || {})}</div>
      <div class="dialog-actions"><button type="button" class="btn primary" data-act="dialog-close">Hotovo</button></div>`;
    dlg.dataset.date = date;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  // ---------- Súvislosti ----------
  function ratioText(r) {
    if (r.ratio === Infinity) return 'výrazne';
    return (Math.round(r.ratio * 10) / 10).toString().replace('.', ',') + '×';
  }

  function resItem(r, kind) {
    const name = r.group === 'food' ? r.label : (CTX_LABELS[r.key] || r.key);
    const unit = kind === 'day' ? 'dní' : 'jedál';
    const txt = kind === 'day'
      ? `Ťažkosti v ${r.withHit} z ${r.withN} takých dní (${pct(r.rateWith)}) · inak ${pct(r.rateWithout)}`
      : `Ťažkosti po ${r.withHit} z ${r.withN} ${unit} (${pct(r.rateWith)}) · inak po ${pct(r.rateWithout)}`;
    const a = kind === 'day' ? 's tým' : (r.group === 'food' ? 's ním' : 's tým');
    return `<div class="res lvl-${r.level}">
      <div class="res-top"><span class="res-name">${esc(name)}</span><span class="ratio">${ratioText(r)}</span></div>
      <div class="res-txt">${txt}</div>
      <div class="bars">
        <span>${a}</span><div class="bar w"><i style="width:${Math.round(r.rateWith * 100)}%"></i></div><span>${pct(r.rateWith)}</span>
        <span>inak</span><div class="bar o"><i style="width:${Math.round(r.rateWithout * 100)}%"></i></div><span>${pct(r.rateWithout)}</span>
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
    const r = Analysis.analyze(entries, days, { fromH, toH, minN });

    let h = `<div class="disclaimer"><b>ℹ️ Len pomôcka, nie diagnóza</b>
      Tieto čísla ukazujú, čo sa časovo zhoduje, nie čo ťažkosti naozaj spôsobuje. Slúžia ako podklad na rozhovor s lekárom.
      Jedlo ani lieky nevynechávaj bez dohody s lekárom.</div>`;

    h += `<div class="card"><h3>Nastavenie</h3><div class="opts">
      <label>Ťažkosti od${sel('o-from', fromH, [[0, '0 h'], [1, '1 h'], [2, '2 h'], [3, '3 h']])}</label>
      <label>do${sel('o-to', toH, [[2, '2 h'], [3, '3 h'], [4, '4 h'], [6, '6 h'], [8, '8 h'], [12, '12 h'], [24, '24 h']])}</label>
      <label>Min. výskytov${sel('o-min', minN, [[3, '3×'], [5, '5×'], [8, '8×'], [10, '10×']])}</label>
    </div><p class="tiny" style="margin:8px 0 0">Ťažkosti sa priradia k jedlu, ak prišli ${fromH}–${toH} h po ňom.</p></div>`;

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
      el.innerHTML = h;
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
    if (r.days.length || r.daysPending.length) {
      h += `<div class="card"><h2>📅 Deň</h2><p class="tiny" style="margin:0 0 6px">Porovnáva dni s ťažkosťami a bez nich (${r.dayTotal} dní s údajmi).</p>`;
      h += resList(r.days, 'day');
      h += pendingList(r.daysPending, minN, false) + '</div>';
    }

    h += `<div class="card"><h3>Ako to čítať</h3><p class="small muted" style="margin:0">
      <b>2×</b> znamená, že po tomto jedle prišli ťažkosti dvakrát častejšie ako po ostatných jedlách.
      Na vrchu sú najpodozrivejšie. Jedno jedlo obsahuje viac surovín, preto môže vyzerať podozrivo aj niečo,
      čo sa jedáva spolu s pravým vinníkom. Červené = výrazný rozdiel, oranžové = mierny.
      „Výrazne“ znamená, že bez tohto jedla sa ťažkosti v sledovanom čase neobjavili vôbec.</p></div>`;
    el.innerHTML = h;
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
    const data = { app: 'dennik-jedla', version: 1, exported: new Date().toISOString(), entries, days: Object.values(days) };
    const ok = await saveFile('dennik-zaloha-' + todayStr() + '.json', 'application/json', JSON.stringify(data, null, 1));
    if (ok) {
      await setMeta('lastBackup', Date.now());
      toast('Záloha uložená ✓');
      if (currentView === 'settings') renderSettings(); else renderBackupBanner();
    }
  }

  function csvCell(v) {
    if (v == null) return '';
    const s = String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv() {
    const head = ['Dátum', 'Čas', 'Typ', 'Popis', 'Sila', 'Trvanie', 'Stolica', 'Stres', 'Poznámka',
      'Nálada', 'Porcia', 'V zhone', 'Obsahovalo', 'Druh ťažkostí', 'Miesto', 'Spánok', 'Menštruácia', 'Pohyb', 'Pitie'];
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
        (e.tags || []).map(t => { const x = TAGS.find(y => y[0] === t); return x ? x[2] : t; }).join(', '),
        (e.kinds || []).join(', '), e.location ? lab(LOCATION, e.location) : '',
        day.sleep ? lab(SLEEP, day.sleep) : '', day.period != null ? (day.period ? 'áno' : 'nie') : '',
        day.activity ? lab(ACTIVITY, day.activity) : '', day.water ? lab(WATER, day.water) : '',
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
    el.innerHTML = `
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
  document.addEventListener('click', async ev => {
    const t = ev.target;

    const tab = t.closest('.tab');
    if (tab) {
      if (editingId && tab.dataset.view !== 'add') { editingId = null; draft = newDraft(); }
      switchView(tab.dataset.view);
      return;
    }

    const typeBtn = t.closest('.type-btn');
    if (typeBtn) {
      const ty = typeBtn.dataset.type;
      if (draft.type !== ty) {
        if (editingId) draft.type = ty;
        else { const keepTs = draft.tsTouched ? draft.ts : null; draft = newDraft(ty); if (keepTs) { draft.ts = keepTs; draft.tsTouched = true; } }
      } else if (!editingId) {
        draft = newDraft();
      }
      renderForm();
      return;
    }

    const q = t.closest('.chip[data-q]');
    if (q) {
      const val = q.dataset.q;
      const cur = draft.desc.trim();
      if (draft.type === 'food' && cur && !cur.toLowerCase().includes(val.toLowerCase())) draft.desc = cur + ', ' + val;
      else draft.desc = val;
      const inp = $('#f-desc');
      if (inp) { inp.value = draft.desc; inp.classList.remove('invalid'); }
      return;
    }

    const tm = t.closest('[data-time]');
    if (tm) {
      draft.ts = Date.now() - Number(tm.dataset.time) * 60000;
      draft.tsTouched = Number(tm.dataset.time) !== 0;
      $('#f-ts').value = toLocalInput(draft.ts);
      return;
    }

    const chip = t.closest('.chips[data-field] .chip');
    if (chip) {
      const group = chip.parentElement;
      const f = group.dataset.field;
      const v = parseChip(group, chip.dataset.v);
      if (group.dataset.day) {
        const nv = await setDayField(group.dataset.day, f, v);
        refreshGroup(group, nv);
        if (group.dataset.day === todayStr() && !todayExpanded && dayFilled(days[todayStr()]) === DAY_FIELDS.length) {
          setTimeout(renderToday, 450);
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
      case 'cancel-edit': editingId = null; draft = newDraft(); switchView('list'); break;
      case 'delete': deleteCurrent(); break;
      case 'backup': doBackup(); break;
      case 'restore': $('#import-file').click(); break;
      case 'csv': doCsv(); break;
      case 'wipe': wipeAll(); break;
      case 'today-edit': todayExpanded = true; renderToday(); break;
      case 'today-done': todayExpanded = false; renderToday(); break;
      case 'day-edit': openDayDialog(act.dataset.date); break;
      case 'dialog-close': { const dlg = $('#day-dialog'); dlg.close ? dlg.close() : dlg.removeAttribute('open'); break; }
      case 'more-days': listDays += 14; renderList(); break;
    }
  });

  $('#day-dialog').addEventListener('close', () => { if (currentView === 'list') renderList(); });

  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'f-desc') { draft.desc = t.value; t.classList.remove('invalid'); }
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
  });

  $('#entry-form').addEventListener('submit', ev => { ev.preventDefault(); saveDraft(); });

  // Pri návrate do aplikácie obnov čas „teraz“ a dnešný deň
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (currentView === 'add') {
      if (!draft.tsTouched && !editingId) {
        draft.ts = Date.now();
        const inp = $('#f-ts');
        if (inp) inp.value = toLocalInput(draft.ts);
      }
      renderToday();
      renderBackupBanner();
    }
  });

  // ---------- Štart ----------
  async function start() {
    try {
      await load();
    } catch (ex) {
      console.error(ex);
      document.querySelector('main').innerHTML = '<div class="empty"><div class="big">⚠️</div><p>Úložisko v tomto prehliadači nefunguje. Skús otvoriť stránku v Safari (nie v súkromnom režime).</p></div>';
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    switchView('add');
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
    }
  }

  // sprístupnené pre testovanie
  window.__dennik = { buildCsv, get entries() { return entries; }, reload: async () => { await load(); switchView(currentView); } };

  start();
})();
