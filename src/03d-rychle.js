
  // ---------- Rýchle doplnenia na obrazovke Dnes ----------

  // 1) Po ťuknutí na číslo ťažkostí: druh jedným ťuknutím (bez neho ich nevidí vyhodnotenie podľa druhu)
  let quickSymId = null;
  function quickKindHtml() {
    const e = quickSymId && entries.find(x => x.id === quickSymId);
    if (!e || Date.now() - e.created > 15 * 60e3) { quickSymId = null; return ''; }
    const on = e.kinds || [];
    // dva riadky, dĺžky slov vyvážené tak, aby sa nič nezalamovalo; Hotovo v hlavičke
    const chip = k => `<button type="button" class="chip${on.includes(k) ? ' on' : ''}" data-act="qs-kind" data-v="${esc(k)}">${esc(k)}</button>`;
    return `<div class="qk"><div class="qk-top"><span class="qk-h">Aké? <span class="tiny">môžeš viac</span></span>` +
      `<button type="button" class="linkbtn qk-done" data-act="qs-done">Hotovo</button></div>` +
      KIND_ROWS.map(r => `<div class="qk-row">${r.filter(k => KINDS.includes(k)).map(chip).join('')}</div>`).join('') +
      `</div>`;
  }
  async function toggleQuickKind(k) {
    const e = entries.find(x => x.id === quickSymId);
    if (!e) return;
    const s = new Set(e.kinds || []);
    if (s.has(k)) s.delete(k); else s.add(k);
    e.kinds = KINDS.filter(x => s.has(x));
    e.desc = e.kinds.length ? e.kinds.join(', ') : 'ťažkosti';
    e.updated = Date.now();
    await DB.put('entries', e);
  }

  // 2) „Ako je teraz?“ – ako dlho ťažkosti trvali, jedným ťuknutím
  const DUR_MIN = { '5 min': 5, '15 min': 15, '30 min': 30, '1 h': 60, '2 h': 120, 'viac hodín': 240 };
  function durAskEntry() {
    const now = Date.now();
    const sym = entries.filter(e => e.type === 'symptom' && !e.duration && !e.durSkip && dayOf(e.ts) === todayStr()
      && now - e.ts >= 90 * 60e3 && now - e.ts <= 12 * 3600e3 && (!e.durAsk || now - e.durAsk >= 2 * 3600e3))
      .sort((a, b) => b.ts - a.ts);
    const e = sym[0];
    // ak po nich prišli ďalšie ťažkosti, otázka už nedáva zmysel
    if (!e || entries.some(x => x.type === 'symptom' && x.ts > e.ts)) return null;
    return e;
  }
  function durAskHtml() {
    const e = durAskEntry();
    if (!e) return '';
    const mins = (Date.now() - e.ts) / 60000;
    const opts = Object.keys(DUR_MIN).filter(k => DUR_MIN[k] <= mins && k !== 'viac hodín');
    return `<div class="banner nudge dur"><div><b>Ako je teraz?</b>Ťažkosti o ${fmtTime(e.ts)}${e.severity ? ' (' + e.severity + '/10)' : ''}. Ak prešli, ťukni, ako dlho trvali.</div>
      <div class="nudge-btns">${opts.map(k => `<button type="button" class="btn small" data-act="dur-set" data-id="${e.id}" data-v="${k}">${k}</button>`).join('')}
        <button type="button" class="btn small primary" data-act="dur-set" data-id="${e.id}" data-v="">Ešte trvá</button>
        <button type="button" class="btn small ghost" data-act="dur-skip" data-id="${e.id}" aria-label="Nepýtať sa">✕</button></div></div>`;
  }
  async function setDuration(id, v) {
    const e = entries.find(x => x.id === id);
    if (!e) return;
    if (v) e.duration = v;
    else if (Date.now() - e.ts >= 6 * 3600e3) e.duration = 'viac hodín';   // trvá dlho, ďalej sa nepýtať
    else e.durAsk = Date.now();   // opýta sa znova o 2 hodiny
    e.updated = Date.now();
    await DB.put('entries', e);
  }

  // 6) Stolica jedným ťuknutím; popis typov je vo formulári (odkaz pod číslami)
  function quickStoolHtml() {
    return `<div class="qz-part"><h3>Stolica</h3><div class="chips stoolrow">` +
      BRISTOL.map(([v], i) => `<button type="button" class="chip st-${i < 2 ? 'hard' : i < 4 ? 'ok' : 'loose'}" data-act="quick-stool" data-v="${v}" aria-label="${esc(lab(BRISTOL, v))}">${i + 1}</button>`).join('') +
      `</div><p class="st-legend">1–2 zápcha · 3–4 v poriadku · 5–7 riedka</p>
      <button type="button" class="linkbtn" data-act="stool-form">Čo znamenajú čísla? Otvoriť popis typov ›</button></div>`;
  }

  // 4) Jedlo zapísané len názvom (napr. „segedín“) sa oplatí rozpísať na suroviny
  function recipeAsk(e) {
    if (e.type !== 'food' || isCoffee(e)) return null;
    const desc = e.desc.trim(), k = desc.toLowerCase();
    if (/[,+]|\s(s|so|a|aj|na|z|zo|v|vo)\s/i.test(' ' + desc + ' ')) return null;   // už je rozpísané
    if (Analysis.recipeOf(desc).length || (meta.rcAsked || []).includes(k)) return null;
    const n = entries.filter(x => x.type === 'food' && (x.desc || '').trim().toLowerCase() === k).length;
    if (n < 3) return null;
    if (Analysis.detectTags(Analysis.expand(desc)).length && desc.split(/\s+/).length < 2) return null;   // napr. „banán“
    return desc;
  }
  async function offerRecipe(e) {
    const desc = recipeAsk(e);
    if (!desc) return;
    await setMeta('rcAsked', (meta.rcAsked || []).concat([desc.toLowerCase()]).slice(-200));
    toast(`„${desc}“ si zapísala už ${entries.filter(x => x.type === 'food' && x.desc.trim().toLowerCase() === desc.toLowerCase()).length}×. Rozpísať na suroviny?`, {
      label: 'Rozpísať', run: () => {
        openInfo('recipes');
        const n = $('#rc-name'), i = $('#rc-ing');
        if (n) n.value = desc;
        if (i) i.focus();
      },
    });
  }

  // 3) Posun medzi dňami potiahnutím prstom doľava a doprava
  let daySwipe = null;
  document.addEventListener('touchstart', ev => {
    daySwipe = null;
    if (currentView !== 'today' || openSheets.length || ev.touches.length !== 1) return;
    const t = ev.target;
    if (!t.closest || !t.closest('#view-today') || t.closest('.strip, .chips, input, textarea, .ribbon')) return;
    daySwipe = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', ev => {
    const s = daySwipe;
    daySwipe = null;
    if (!s || !ev.changedTouches.length) return;
    const dx = ev.changedTouches[0].clientX - s.x, dy = ev.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.t > 700) return;
    const p = parseDay(selDay);
    const next = dateStr(new Date(p.getFullYear(), p.getMonth(), p.getDate() + (dx < 0 ? 1 : -1), 12).getTime());
    if (next > todayStr()) return;
    todayExpanded = false;
    goDay(next);
  }, { passive: true });
