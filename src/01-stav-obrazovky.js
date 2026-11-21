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
    // záznam bez známeho typu (napr. z prerušeného uloženia) by zhodil vykreslenie
    entries = e.filter(x => TYPES[x.type]);
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

