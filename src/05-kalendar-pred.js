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
    let h = `<header class="lt"><div><h1>Kalendár</h1><p>Ťukni na deň a otvorí sa jeho denník.</p></div><button type="button" class="help-q" data-act="help" data-sec="list" aria-label="Pomocník">?</button></header>
      <input type="search" id="q" value="${esc(searchQ)}" placeholder="Hľadať v denníku, napr. jogurt" enterkeyhint="search"><div id="q-res"></div>` + renderCalendar();
    const byDay = new Map();
    entries.forEach(e => {
      const d = dayOf(e.ts);
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
        `<button type="button" class="dayrow fnd" data-cal="${dayOf(e.ts)}"><span>${TYPES[e.type].ico}</span>
          <span><b>${esc(e.desc)}</b><small>${fmtDayHead(dayOf(e.ts))} o ${fmtTime(e.ts)}</small></span><span></span><span class="chev">›</span></button>`).join('') + '</div>'
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
      <p class="small muted" style="margin-top:-6px">${esc(s.desc)}${s.severity ? ' · sila ' + s.severity + '/10' : ''} · ${fmtDayHead(dayOf(s.ts))} ${fmtTime(s.ts)}</p>`;
    if (sumTags.length) {
      h += `<div class="trace-sum"><b>Za posledných 48 h:</b><div class="pending" style="margin-top:6px">` +
        sumTags.map(([t, n]) => `<span class="${risk.includes(t) ? 'risk' : ''}">${esc(tagLabel(t))} ${n}×</span>`).join('') +
        (away ? `<span>jedlo nie z domu ${away}×</span>` : '') + '</div></div>';
    }
    const dset = [...new Set([dayOf(s.ts), dayOf(s.ts - 864e5), dayOf(from)])];
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

