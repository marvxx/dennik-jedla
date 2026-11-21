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

