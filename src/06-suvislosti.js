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
            : `Po ${w} takých jedál ${OUT.after}. Po ostatných jedlách v ${o} prípadov.`;
        }
        return `Po ${w} takých jedál ${OUT.afterShort}. Po ostatných v ${o} prípadov.`;
      case 'load': return x.level === 'none' ? `Ani pri 2 a viac porciách za deň nie je rozdiel (${w} dní).`
        : `V dni s 2 a viac porciami ${OUT.dayHad} ${w} dní. V ostatné dni ${x.outHit} z ${x.outN}.`;
      case 'late': return `Na druhý deň (12–48 h) ${OUT.afterShort} po ${w} takých jedál. Inak v ${o} prípadov.`;
      case 'stack': return `Keď sa to za 12 h zjedlo 2× a viac, ${OUT.afterShort} po ${w} jedál. Pri 1× v ${o} prípadov.`;
      case 'day': return `V takéto dni ${OUT.dayHad} ${w} dní. V ostatné dni ${x.outHit} z ${x.outN}.`;
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

  // Jedlo, ktoré obsahuje podozrivú skupinu (syr, kefír → mliečne), je tá istá stopa.
  // Ukáže sa pod skupinou, nie ako samostatné podozrenie.
  function groupSuspects(list) {
    const groups = list.filter(s => s.id.startsWith('tag:'));
    const kids = new Map();
    const rest = [];
    for (const s of list) {
      if (!s.id.includes(':')) {
        const tags = Analysis.detectTags(Analysis.expand(s.name));
        const parent = groups.find(g => tags.includes(g.id.slice(4)));
        if (parent) {
          if (!kids.has(parent.id)) kids.set(parent.id, []);
          kids.get(parent.id).push(s);
          continue;
        }
      }
      rest.push(s);
    }
    rest.forEach(s => { s.kids = kids.get(s.id) || []; });
    return rest;
  }

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
      ${s.kids && s.kids.length ? `<div class="kids"><p class="tiny">Patria sem aj jedlá, ktoré to obsahujú:</p><div class="chips">` +
        s.kids.map(k => `<button type="button" class="chip" data-sus="${esc(k.id)}">${esc(k.name)}${k.top ? ` <span>${susRatio(k)}</span>` : ''}</button>`).join('') + '</div></div>' : ''}
      <div class="res-foot"><span class="conf c${c}"><i></i><i></i><i></i>${CONF_TXT[c]}</span></div>
      <div class="hero-btns"><button type="button" class="btn small" data-sus="${esc(s.id)}">Podrobnosti</button>
        ${testable ? `<button type="button" class="btn small primary" data-act="test-for" data-sus-id="${esc(s.id)}">Vyskúšať bez toho</button>` : ''}</div></div>`;
  }
  // Ďalšie podozrenia ako krátky zoznam; detail sa otvorí ťuknutím
  function susRowsHtml(list) {
    return '<div class="dayrows flat">' + list.map(s => {
      const g = s.top;
      return `<button type="button" class="dayrow sus-row v-${s.verdict}" data-sus="${esc(s.id)}"><span class="dot"></span>
        <span><b>${esc(s.name)}</b><small>${g ? sigSentence(g, s) : ''}</small>${s.kids && s.kids.length ? `<small class="kids-t">Patrí sem aj: ${esc(s.kids.map(k => k.name).join(', '))}</small>` : ''}</span><span class="ratio">${susRatio(s)}</span><span class="chev">›</span></button>`;
    }).join('') + '</div>';
  }

  // Detail podozrivého: všetky výpočty, kedy prichádzajú ťažkosti a konkrétne jedlá
  function openSuspect(id) {
    const s = lastSus.get(id);
    if (!s) return;
    const fdx = FD || focusData('all');
    const ev = Analysis.evidence(fdx.E, fdx.D, id, Date.now());
    const testable = s.id.startsWith('tag:') || !s.id.includes(':');
    const order = ['meal', 'load', 'late', 'stack', 'day', 'worst', 'best', 'both'];
    const sigs = s.sig.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    let h = `<div class="sheet-head"><h2>${esc(s.name)}</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>
      <p class="verdict v-${s.verdict}">${VERDICT_TXT[s.verdict]}${s.top ? ' · ' + susRatio(s) : ''}</p>`;
    h += grp('Čo ukazujú údaje', '<ul class="why">' + sigs.map(g => `<li class="${SIG_W[g.kind] && g.x.level !== 'none' ? 'bad' : g.kind === 'best' ? 'good' : ''}">${sigSentence(g, s)}</li>`).join('') + '</ul>');
    if (ev && ev.mine.n >= 3 && OUT.delay) {
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
          ? [x.delay <= win ? 'hit' : 'wait', OUT.ev + ' ' + after(x.delay) + (x.sev && OUT.delay ? ' · ' + x.sev + '/10' : '')]
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
    FD = focusData('all');
    OUT = FD.out;
    const r = anz('all', entries, days, { fromH, toH, minN, riskTags: riskTags() });
    if (r.totalN < 10 || r.symptomCount < 3) return [];
    lastR = r;
    const r2 = toH < 12 ? anz('all', entries, days, { fromH: 12, toH: 48, minN, riskTags: riskTags() }) : null;
    return buildSuspects(r, r2 && r2.totalN >= 10 ? r2 : null, bwz('all', entries, days));
  }

