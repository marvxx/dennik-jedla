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

    const th = t.closest('[data-theme-set]');
    if (th) {
      const v = th.dataset.themeSet;
      try { if (v === 'auto') localStorage.removeItem('dennik-theme'); else localStorage.setItem('dennik-theme', v); } catch (_) { /* nič */ }
      applyTheme(v);
      renderSettings();
      return;
    }

    const fc = t.closest('[data-focus]');
    if (fc) { insFocus = fc.dataset.focus; renderInsights(); return; }

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

    const lf = t.closest('[data-lf]');
    if (lf) { listFilter = lf.dataset.lf; listDays = 14; renderList(); return; }

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
      case 'water': {
        await addWater(act.dataset.date, Number(act.dataset.v));
        waterBump = true;
        renderToday();
        waterBump = false;
        break;
      }
      case 'coffee': {
        const e = await addCoffee(act.dataset.date);
        flashId = e.id;
        renderToday();
        toast('Zapísané: ' + e.desc, { run: async () => { await DB.del('entries', e.id); entries = entries.filter(x => x.id !== e.id); renderToday(); } });
        break;
      }
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
      case 'eat-idea': {
        // návrh „Čo si dať“: formulár s týmto jedlom, skupinami a miestom z posledného zápisu
        const val = act.dataset.idea;
        openEntry();
        const src = entries.filter(e => e.type === 'food' && (e.desc || '').trim().toLowerCase() === val.toLowerCase()).sort((a, b) => b.ts - a.ts)[0];
        applyQuick(val, src);
        renderForm();   // bez „Ako včera“, jedlo je už vybraté
        break;
      }
      case 'add-at': {
        // zabudnuté jedlo: formulár s časom typického jedla v tom dni
        openEntry();
        draft.ts = atHour(selDay, Number(act.dataset.h));
        draft.tsTouched = true;
        draft.tsCustom = true;
        renderForm();
        // kurzor do popisu ako pri ＋ (ešte v rámci ťuknutia, inak iPhone neukáže klávesnicu)
        { const d = $('#f-desc'); if (d) d.focus({ preventScroll: true }); }
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
        await addHistory('začalo zavádzanie: ' + (txt || tg[2]));
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
        await addHistory('začal test bez: ' + (txt || tg[2]));
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
    else if (t.id === 'q') {
      searchQ = t.value;
      renderSearch();
      const hits = searchMatches();
      if (hits && hits.length) {
        const inMonth = hits.some(e => { const d = parseDay(dayOf(e.ts)); return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth(); });
        if (!inMonth) { const last = parseDay(dayOf(Math.max(...hits.map(e => e.ts)))); calMonth = new Date(last.getFullYear(), last.getMonth(), 1); }
      }
      const cal = $('.card.cal');
      if (cal) cal.outerHTML = renderCalendar();
    }
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
  document.addEventListener('toggle', ev => {
    const c = ev.target.classList;
    if (!c) return;
    if (c.contains('quick-dd')) draft.quickOpen = ev.target.open;
    else if (c.contains('fdet')) draft.detOpen = ev.target.open;
  }, true);

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

