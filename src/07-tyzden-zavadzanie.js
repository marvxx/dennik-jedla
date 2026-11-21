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
    const bw = FD ? bwz(FD.f, FD.E, FD.D) : bwz('all', entries, days);
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
    const fb = insTab !== 'mine' ? focusBar() : '';
    const fd = focusData(insFocus);
    FD = fd;
    OUT = fd.out;
    const r = anz(fd.f, fd.E, fd.D, fd.opts);

    let h = `<header class="lt"><div><h1>Súvislosti</h1><p>Po čom je horšie a po čom dobre.</p></div><button type="button" class="help-q" data-act="help" data-sec="insights" aria-label="Pomocník">?</button></header>
      <div class="segbar">${INS_TABS.map(([k, l]) => `<button type="button" class="${k === insTab ? 'on' : ''}" data-ins="${k}">${l}</button>`).join('')}</div>` + fb;
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
    const r2 = OUT.late && toH < 12 ? anz(fd.f, fd.E, fd.D, { fromH: 12, toH: 48, minN, riskTags: riskTags() }) : null;
    const bw = bwz(fd.f, fd.E, fd.D);
    const sus = buildSuspects(r, r2 && r2.totalN >= 10 ? r2 : null, bw);
    // čo je podozrivé z iného pohľadu (napr. dávka za deň), nepatrí medzi dobre znášané
    const tol = toleratedList(r).filter(x => !sus.some(s => s.id === x.key));
    if (insTab === 'sus') {
      const shown = groupSuspects(sus);
      const hero = shown[0] && shown[0].score >= 2 ? shown[0] : null;
      const others = shown.filter(s => s !== hero).slice(0, 8);
      h += hero ? heroHtml(hero) : `<div class="card"><h2>V skratke</h2><p class="small muted" style="margin:0">Zatiaľ nič nevyzerá výrazne podozrivo.
        Zapisuj ďalej, najmä aj dni bez ťažkostí.</p></div>`;
      if (others.length) h += `<div class="card"><h2>${hero ? 'Ďalšie podozrenia' : 'Možné podozrenia'}</h2>${susRowsHtml(others)}</div>`;
      h += `<div class="card"><h2>Najlepšie znášané</h2>` + (tol.length
        ? '<div class="pending">' + tol.slice(0, 6).map(x => `<span class="good">${esc(resName(x))}</span>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Zatiaľ málo údajov.</p>') +
        `<p class="tiny" style="margin:12px 0 0">Z ${r.totalN} jedál a ${r.symptomCount} záznamov (${OUT.label}). Nasledovali po ${pct(r.baseRate)} jedál.</p></div>`;

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
      const bw = FD ? bwz(FD.f, FD.E, FD.D) : bwz('all', entries, days);
      if (bw && bw.onlyBest.length) {
        h += `<div class="card"><h2>Jedlo sa len v najlepších dňoch</h2><p class="tiny" style="margin:0 0 8px">Najlepšie dni: ${bw.best.map(fmtDayHead).join(', ')}.</p>
          <div class="pending">${bw.onlyBest.map(x => `<span class="good">${esc(x.key.startsWith('tag:') ? tagLabel(x.label) : x.label)}</span>`).join('')}</div></div>`;
      }
    }

    if (insTab === 'days') {
      h += trendHtml();
      if (insFocus === 'all') h += medsHtml();
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

