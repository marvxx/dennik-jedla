  // ---------- Prehľad pre lekára ----------
  function buildReport() {
    const all = [...entries].sort((a, b) => a.ts - b.ts);
    if (!all.length) return null;
    const now = Date.now();
    const from = Math.max(all[0].ts, now - 30 * DAY);
    const E = all.filter(e => e.ts >= from);
    const dset = new Set(E.map(e => dayOf(e.ts)));
    const sym = E.filter(e => e.type === 'symptom');
    const symDays = new Set(sym.map(e => dayOf(e.ts)));
    const top = (arr, n) => {
      const m = new Map();
      arr.filter(Boolean).forEach(x => m.set(x, (m.get(x) || 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 6).map(([k, v]) => k + ' ' + v + '×').join(', ') || '–';
    };
    const fd = ts => { const d = new Date(ts); return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(); };
    const part = ts => { const h = new Date(ts).getHours(); return h < 5 ? 'v noci' : h < 11 ? 'ráno' : h < 17 ? 'cez deň' : h < 23 ? 'večer' : 'v noci'; };
    const sevs = sym.map(e => e.severity).filter(x => x != null);
    const r = anz('all', entries, days, { fromH: 0, toH: 6, minN: meta.minN || 5, riskTags: riskTags() });
    const line = x => `${resName(x)}: ťažkosti ${x.withHit} z ${x.withN} (${pct(x.rateWith)}), inak ${pct(x.rateWithout)}`;
    const sus = r.foods.concat(r.ctx).filter(x => x.level !== 'none').sort((a, b) => b.ratio - a.ratio).slice(0, 8);
    const dayF = r.days.concat(r.loads || []).filter(x => x.level !== 'none');
    const S = [];
    S.push(['Obdobie', [`${fd(from)} – ${fd(now)}`, `Záznamy v ${dset.size} dňoch, ${E.filter(e => e.type === 'food').length} jedál a nápojov`]]);
    S.push(['Ťažkosti', sym.length ? [
      `${sym.length} záznamov v ${symDays.size} dňoch z ${dset.size}`,
      sevs.length ? `Sila (1–10): priemer ${(sevs.reduce((a, b) => a + b, 0) / sevs.length).toFixed(1).replace('.', ',')}, najviac ${Math.max(...sevs)}` : '',
      'Druh: ' + top(sym.flatMap(e => e.kinds || [])),
      'Čas dňa: ' + top(sym.map(e => part(e.ts))),
      'Miesto: ' + top(sym.map(e => e.location ? lab(LOCATION, e.location) : '')),
      'Trvanie: ' + top(sym.map(e => e.duration)),
    ].filter(Boolean) : ['Žiadne záznamy ťažkostí']]);
    S.push(['Stolica', [top(E.filter(e => e.type === 'stool').map(e => e.stool ? lab(STOOL, e.stool) : e.desc), 7)]]);
    S.push(['Známe intolerancie', [riskTags().map(t => tagLabel(t)).join(', ') || 'neuvedené']]);
    const merged = computeSuspects().slice(0, 6);
    S.push(['Podozrenia (spojené výpočty)', merged.length ? merged.map(m => `${m.name} – ${VERDICT_TXT[m.verdict].toLowerCase()}${m.top ? ', ' + susRatio(m) : ''}: ` +
      m.sig.filter(g => SIG_W[g.kind] && g.x.level !== 'none').map(g => sigSentence(g, m)).join(' ')) : ['Zatiaľ nič výrazné alebo málo údajov']]);
    if (sus.length) S.push(['Po čom prichádzajú ťažkosti častejšie (do 6 h po jedle)', sus.map(line)]);
    const tol = toleratedList(r);
    if (tol.length) S.push(['Čo znáša dobre', [tol.map(x => resName(x) + ' (' + x.withHit + ' z ' + x.withN + ')').join(', ')]]);
    if (dayF.length) S.push(['Okolnosti dňa', dayF.map(x => `${resName(x)}: ťažkosti ${x.withHit} z ${x.withN} dní, inak ${x.outHit} z ${x.outN}`)]);
    // vývoj po týždňoch
    const weeks = weeklyTrend(12).filter(w => w.logged >= 3);
    const tv = trendVerdict(weeklyTrend(12));
    if (weeks.length >= 2) S.push(['Vývoj po týždňoch (dni s ťažkosťami zo 7)', [weeks.map(w => `${shortDate(w.ws)}: ${w.sym}`).join(', ')].concat(tv ? [tv.text + (tv.word ? ' ' + tv.word : '')] : [])]);
    // podozrenia podľa druhu ťažkostí a pre stolicu
    const byFocus = focusSuspects();
    if (byFocus.length) S.push(['Podozrenia podľa druhu ťažkostí a stolice', byFocus]);
    // lieky a doplnky
    const meds = Analysis.medEffects(entries, days, Date.now()).map(m => {
      const p = x => x.n ? Math.round(x.hit / x.n * 100) + ' %' : '–';
      const parts = [];
      if (m.regular && m.before.n >= 5 && m.since.n >= 5) parts.push(`ťažkosti pred začatím ${p(m.before)} dní, odvtedy ${p(m.since)}`);
      else if (m.with.n >= 3 && m.without.n >= 3) parts.push(`dni s ním ťažkosti ${p(m.with)}, bez neho ${p(m.without)}`);
      if (!m.regular && m.acute >= 2) parts.push(`pri ťažkostiach ${m.acute}×, ďalšie ťažkosti do 4 h ${m.again}×`);
      return `${m.name} (${m.uses}×)${parts.length ? ': ' + parts.join('; ') : ''}`;
    });
    if (meds.length) S.push(['Lieky a doplnky – súvis s ťažkosťami', meds]);
    // testy a zavádzanie
    const tests = eventLog().map(h => `${fd(h.ts)}: ${h.txt}`);
    const ti = testInfo();
    if (ti) tests.push(`Prebieha test bez: ${ti.t.what}, deň ${ti.elapsed} z ${ti.t.days}; dni s ťažkosťami ${ti.during} z ${ti.elapsed} (predtým ${ti.before} z ${ti.elapsed})`);
    const ri = reintroInfo();
    if (ri) tests.push(`Prebieha zavádzanie: ${ri.r.what} – ${reintroVerdict(ri)[1]}`);
    if (tests.length) S.push(['Testy a zavádzanie', tests]);
    if (findings().length) S.push(['Vlastné zistenia', findings().map(f => `${f.text} – ${FND_TXT[f.status]}${f.note ? ' (' + f.note + ')' : ''}`)]);
    S.push(['Lieky a iné', [top(E.filter(e => e.type === 'med').map(e => e.desc), 8)]]);
    return S;
  }

  function reportText(S) {
    return 'DENNÍK JEDLA A TRÁVENIA – PREHĽAD\n\n' + S.map(([h, l]) => h.toUpperCase() + '\n' + l.map(x => '• ' + x.replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, '').trim()).join('\n')).join('\n\n') +
      '\n\nÚdaje zapísala pacientka sama. Súvislosti sú len časová zhoda, nie diagnóza.';
  }

  // Grafy do prehľadu: sila ťažkostí po dňoch (30 dní) a stolica podľa Bristolskej škály
  // najsilnejšie podozrenie pre každý druh ťažkostí a pre stolicu (zvyšok aplikácie sa nezmení)
  function focusSuspects() {
    const keep = { FD, OUT, lastSus, lastR };
    const out = [];
    try {
      for (const [k, label] of focusOptions()) {
        if (k === 'all') continue;
        const fdx = focusData(k);
        OUT = fdx.out;
        const r = anz(fdx.f, fdx.E, fdx.D, fdx.opts);
        if (r.totalN < 10 || r.symptomCount < 3) continue;
        lastR = r;
        const r2 = fdx.out.late && fdx.opts.toH < 12 ? anz(fdx.f, fdx.E, fdx.D, Object.assign({}, fdx.opts, { fromH: 12, toH: 48 })) : null;
        const top = buildSuspects(r, r2 && r2.totalN >= 10 ? r2 : null, bwz(fdx.f, fdx.E, fdx.D)).filter(s => s.score >= 1).slice(0, 2);
        out.push(`${label} (${r.symptomCount}×): ` + (top.length ? top.map(s => `${s.name} – ${VERDICT_TXT[s.verdict].toLowerCase()}${s.top ? ', ' + susRatio(s) : ''}`).join('; ') : 'nič výrazné'));
      }
    } finally {
      FD = keep.FD; OUT = keep.OUT; lastSus = keep.lastSus; lastR = keep.lastR;
    }
    return out;
  }

  function reportCharts() {
    const today = parseDay(todayStr()).getTime();
    const ix = dayIndex();
    const N = 30, W = 300, Hh = 90, bw = W / N;
    let bars = '';
    for (let i = 0; i < N; i++) {
      const d = dateStr(today - (N - 1 - i) * DAY + 12 * 3600e3);
      const sev = ix.sev[d], x = (i * bw + 1).toFixed(1);
      if (sev) {
        const h = (sev / 10 * (Hh - 14)).toFixed(1);
        bars += `<rect x="${x}" y="${(Hh - 12 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h}" rx="1.5" fill="${sevColor(sev)}"><title>${fmtDayHead(d)}: ${sev}/10</title></rect>`;
      } else if (days[d] && days[d].noSymptoms) {
        bars += `<circle cx="${(i * bw + bw / 2).toFixed(1)}" cy="${Hh - 15}" r="2.2" fill="var(--food)"><title>${fmtDayHead(d)}: bez ťažkostí</title></circle>`;
      }
    }
    const tick = (i, t) => `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${Hh - 1}" text-anchor="middle">${t}</text>`;
    const d0 = new Date(today - (N - 1) * DAY), dm = new Date(today - 15 * DAY), d1 = new Date(today);
    const lab = d => d.getDate() + '. ' + (d.getMonth() + 1) + '.';
    let h = `<h3>Ťažkosti za posledných 30 dní</h3><svg class="rchart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Najsilnejšie ťažkosti v jednotlivých dňoch">
      <line x1="0" y1="${Hh - 12}" x2="${W}" y2="${Hh - 12}" stroke="var(--line)"/>
      <text x="0" y="8">10</text>${bars}${tick(0, lab(d0))}${tick(14, lab(dm))}${tick(N - 1, lab(d1))}</svg>
      <p class="tiny" style="margin:2px 0 0">Stĺpec = najsilnejšie ťažkosti v ten deň (1–10). Zelená bodka = deň bez ťažkostí.</p>`;
    const st = entries.filter(e => e.type === 'stool' && e.ts >= today - N * DAY && /^b[1-7]$/.test(e.stool || ''));
    if (st.length >= 3) {
      const cnt = [0, 0, 0, 0, 0, 0, 0];
      st.forEach(e => { cnt[Number(e.stool[1]) - 1]++; });
      const mx = Math.max(...cnt);
      h += `<h3>Stolica (Bristolská škála, ${st.length}×)</h3><div class="bristol">` + cnt.map((n, i) =>
        `<span>${i + 1}</span><span class="bbar"><i class="${i < 2 ? 'hard' : i < 4 ? 'ok' : 'soft'}" style="width:${mx ? Math.round(n / mx * 100) : 0}%"></i></span><span>${n}</span>`).join('') +
        '</div><p class="tiny" style="margin:2px 0 0">1–2 zápcha, 3–4 v poriadku, 5–7 riedka.</p>';
    }
    return h;
  }

  function openReport() {
    const S = buildReport();
    if (!S) { toast('Zatiaľ žiadne záznamy'); return; }
    $('#report-sheet').innerHTML = `<div class="sheet-head noprint"><h2>Prehľad pre lekára</h2><button type="button" class="x" data-act="report-close" aria-label="Zavrieť">✕</button></div>
      <div class="report"><h1>Denník jedla a trávenia – prehľad</h1>` + reportCharts() + trendHtml(true) +
      S.map(([h, l]) => `<h3>${esc(h)}</h3><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('') +
      `<p class="tiny">Údaje zapísala pacientka sama. Súvislosti sú len časová zhoda, nie diagnóza.</p></div>
      <div class="savebar noprint"><button type="button" class="btn" data-act="report-share">Zdieľať ako text</button>
        <button type="button" class="btn primary" data-act="report-print">Tlačiť / PDF</button></div>`;
    openSheet('report-sheet');
  }

  async function shareReport() {
    const text = reportText(buildReport());
    try {
      if (navigator.share) { await navigator.share({ title: 'Denník jedla – prehľad', text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Skopírované ✓');
    } catch (ex) {
      if (!ex || ex.name !== 'AbortError') toast('Nepodarilo sa zdieľať');
    }
  }

  // ---------- Večerná pripomienka (udalosť do Kalendára) ----------
  // [id, text vo formulári, predvolená hodina, nadpis v Kalendári]
  const REMINDERS = [['ranaj', 'Po raňajkách', 9, 'Denník: zapíš raňajky'], ['obed', 'Po obede', 14, 'Denník: zapíš obed'],
    ['vecer', 'Večer (celý deň)', 20, 'Denník: aký bol dnešný deň?']];
  async function doReminder() {
    const chosen = REMINDERS.filter(([id]) => $('#rem-' + id) && $('#rem-' + id).checked);
    if (!chosen.length) { toast('Zapni aspoň jednu pripomienku'); return; }
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    const day = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate());
    const stamp = d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ev = chosen.map(([id, , , title]) => {
      const hh = z(Number($('#remh-' + id).value));
      return ['BEGIN:VEVENT', 'UID:pripomienka-' + id + '-' + hh + '@dennik-jedla', 'DTSTAMP:' + stamp, 'DTSTART:' + day + 'T' + hh + '0000', 'DURATION:PT5M',
        'RRULE:FREQ=DAILY', 'SUMMARY:' + title, 'DESCRIPTION:Otvor Denník jedla a zapíš to.', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + title,
        'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dennik-jedla//SK'].concat(ev, ['END:VCALENDAR']).join('\r\n');
    await saveFile('dennik-pripomienky.ics', 'text/calendar', ics);
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
    ['products', 'customTags', 'intol', 'favorites', 'fromH', 'toH', 'minN', 'findings', 'test', 'recipes', 'recurring', 'reintro', 'history'].forEach(k => { if (meta[k] !== undefined) settings[k] = meta[k]; });
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
      'Odkiaľ jedlo', 'Enzým', 'Deň bez ťažkostí', 'Množstvo', 'Čiarový kód'];
    const rows = [head];
    [...entries].sort((a, b) => a.ts - b.ts).forEach(e => {
      const d = new Date(e.ts);
      const day = days[dayOf(e.ts)] || {};
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
        e.place ? lab(PLACES, e.place) : '', e.type === 'food' ? (e.enzyme ? 'áno' : 'nie') : '',
        day.noSymptoms ? 'áno' : '', e.amount || '', e.product && e.product.code ? e.product.code : '',
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
      for (const k of ['products', 'customTags', 'intol', 'favorites', 'fromH', 'toH', 'minN', 'findings', 'test', 'recipes', 'recurring', 'reintro', 'history']) {
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

  function srow(act, icon, color, title, sub, val, danger) {
    return `<button type="button" class="srow${danger ? ' danger' : ''}" data-act="${act}"><span class="si" style="background:var(--${color})">${ic(icon)}</span>
      <span class="st"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="sv">${val || ''}</span><span class="chev">›</span></button>`;
  }

  function renderSettings() {
    const el = $('#view-settings');
    const lb = meta.lastBackup;
    const lbTxt = lb ? 'Naposledy ' + daysAgoText(Math.floor((Date.now() - lb) / DAY)) +
      ' (' + new Date(lb).toLocaleDateString('sk-SK') + ')' : 'Zatiaľ žiadna záloha';
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const risk = TAGS.filter(([v]) => riskTags().includes(v)).map(x => x[2]);
    el.innerHTML = `<header class="lt"><div><h1>Nastavenia</h1></div><button type="button" class="help-q" data-act="help" data-sec="settings" aria-label="Pomocník">?</button></header>
      <h2 class="sub">Vzhľad</h2>
      <div class="segbar theme-seg">${[['auto', 'Podľa telefónu'], ['light', 'Svetlý'], ['dark', 'Tmavý']].map(([k, l]) =>
        `<button type="button" class="${savedTheme() === k ? 'on' : ''}" data-theme-set="${k}">${l}</button>`).join('')}</div>
      <h2 class="sub">Moje jedlo</h2><div class="dayrows">
        ${srow('intol-edit', 'warn', 'sym', 'Moje intolerancie', esc(risk.join(', ')) || 'Zatiaľ nič vybrané', risk.length || '')}
        ${srow('favs', 'star', 'sun', 'Obľúbené jedlá', '', favorites().length || '')}
        ${srow('recipes', 'doc', 'food', 'Moje jedlá', 'Jedlá rozpísané na suroviny', recipes().length || '')}
        ${srow('rec-open', 'bell', 'med', 'Pravidelné záznamy', 'Napr. ranná káva, lieky', recurring().length || '')}
      </div>
      <h2 class="sub">Záloha</h2><div class="dayrows">
        ${srow('backup', 'save', 'accent', 'Uložiť zálohu', esc(lbTxt))}
        ${srow('restore', 'open', 'med', 'Obnoviť zo zálohy', '')}
      </div>
      <p class="foot">Údaje sú uložené len v tomto telefóne. Raz týždenne si ulož zálohu, napr. do aplikácie Súbory alebo na iCloud.</p>
      <h2 class="sub">Pre lekára</h2><div class="dayrows">
        ${srow('report', 'doc', 'food', 'Prehľad na jednu stranu', 'Krátke zhrnutie na vizitu')}
        ${srow('csv', 'table', 'stool', 'Všetky záznamy do tabuľky', 'Súbor CSV pre Excel alebo Numbers')}
      </div>
      <h2 class="sub">Ostatné</h2><div class="dayrows">
        ${srow('rem-open', 'bell', 'sun', 'Pripomienky', 'Raňajky, obed, večer cez Kalendár')}
        ${standalone ? '' : srow('install', 'phone', 'med', 'Pridať na plochu', 'Aby sa denník otváral ako aplikácia')}
        ${srow('shortcut', 'open', 'accent', 'Skratky a Siri', 'Zápis jedným ťuknutím z plochy')}
        ${srow('wipe', 'trash', 'danger', 'Vymazať všetky údaje', entries.length + ' záznamov, ' + Object.keys(days).length + ' dní s údajmi', '', true)}
      </div>
      <h2 class="sub">Pomoc</h2><div class="dayrows">
        ${srow('help', 'q', 'accent', 'Pomocník', 'Čo znamená ktorá časť aplikácie')}
        ${srow('welcome', 'phone', 'food', 'Úvod znova', 'Krátke predstavenie denníka')}
      </div>
      <p class="foot" style="text-align:center">Denník jedla ${APP_VERSION} · funguje aj bez internetu</p>
      <p class="foot" style="text-align:center">Záznamy ostávajú len v telefóne. Pri skenovaní sa do databázy Open Food Facts pošle iba číslo čiarového kódu.</p>`;
  }

  function openInfo(kind) {
    let title, body;
    if (kind === 'favs') {
      const favs = favorites();
      title = 'Obľúbené jedlá';
      body = grp('', favs.length ? '<div class="fav-list">' + favs.map((f, i) => `<div class="fav-row"><span>${esc(f.desc)}</span>
          <button type="button" class="btn ghost small" data-act="fav-del" data-i="${i}" aria-label="Odobrať">✕</button></div>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Pri zápise jedla ťukni na hviezdičku vedľa názvu. Potom ho zapíšeš jedným ťuknutím.</p>');
    } else if (kind === 'recipes') {
      const list = recipes();
      title = 'Moje jedlá';
      body = grp('', '<p class="small muted" style="margin:0 0 12px">Jedlo, ktoré často varíš, rozpíš na suroviny. Keď ho potom zapíšeš len názvom, suroviny sa zarátajú do vyhodnotenia.</p>' +
        `<input type="text" id="rc-name" placeholder="Názov, napr. mamine halušky" enterkeyhint="next">
         <input type="text" id="rc-ing" style="margin-top:8px" placeholder="Suroviny, napr. halušky, bryndza, slanina" enterkeyhint="done">
         <button type="button" class="btn block" style="margin-top:10px" data-act="rc-add">Pridať jedlo</button>`) +
        (list.length ? grp('Uložené', '<div class="fav-list">' + list.map((r, i) => `<div class="fav-row"><span>${esc(r.name)}<br><span class="tiny">${esc(r.ingredients)}</span></span>
          <button type="button" class="btn ghost small" data-act="rc-del" data-i="${i}" aria-label="Zmazať">✕</button></div>`).join('') + '</div>') : '');
    } else if (kind === 'rec') {
      const list = recurring();
      title = 'Pravidelné záznamy';
      body = grp('', list.length ? '<div class="fav-list">' + list.map(r => `<div class="fav-row"><span>${esc(r.desc)} <span class="tiny">${pad(r.h)}:${pad(r.m)}</span></span>
          <button type="button" class="btn ghost small" data-act="rec-del" data-id="${r.id}" aria-label="Zrušiť">✕</button></div>`).join('') + '</div>'
        : '<p class="small muted" style="margin:0">Pri zápise jedla alebo lieku zapni „Opakovať každý deň“. Napríklad ranná káva alebo večerné probiotiká.</p>');
    } else if (kind === 'rem') {
      title = 'Pripomienky';
      const opt = (id, sel) => `<select id="${id}">${[...Array(17)].map((_, i) => i + 6).map(h => `<option value="${h}"${h === sel ? ' selected' : ''}>${pad(h)}:00</option>`).join('')}</select>`;
      body = grp('', `<p class="small muted" style="margin:0">Denník je webová stránka a tie v iPhone nemôžu samy plánovať upozornenia. Preto pripomienky pridá do <b>Kalendára</b>:
          ten ich potom pripomenie každý deň, aj keď je denník zatvorený.</p>`) +
        grp('Kedy pripomenúť', REMINDERS.map(([id, label, h]) => `<div class="rem-row">${sw('rem-' + id, label, id === 'vecer')}${opt('remh-' + id, h)}</div>`).join('') +
          `<button type="button" class="btn block" style="margin-top:12px" data-act="reminder">Pridať do Kalendára</button>`) +
        '<p class="tiny" style="margin:0 4px 12px">Ak si pripomienky už raz pridala, staré v Kalendári zmaž, aby neprišli dvakrát. Navyše ti denník po otvorení sám povie, ak niečo chýba (napríklad obed).</p>';
    } else {
      title = 'Pridať na plochu';
      body = grp('', `<ol class="steps small"><li>Otvor túto stránku v <b>Safari</b>.</li><li>Ťukni na tlačidlo <b>Zdieľať</b> (štvorec so šípkou).</li>
        <li>Vyber <b>Pridať na plochu</b> a potvrď.</li><li>Odteraz otváraj denník len ikonou na ploche. Safari a ikona majú oddelené údaje.</li></ol>`);
    }
    if (kind === 'shortcut') {
      title = 'Skratky a Siri';
      const row = (ty, l) => `<div class="fav-row"><span>${l}<br><span class="tiny link-txt">${esc(appLink(ty))}</span></span>
        <button type="button" class="btn ghost small" data-act="copy-link" data-ty="${ty}">Kopírovať</button></div>`;
      body = grp('Android', '<p class="small muted" style="margin:0">Podrž prst na ikone denníka na ploche. Ponúkne Zapísať jedlo, ťažkosti alebo stolicu.</p>') +
        grp('iPhone', `<ol class="steps small"><li>Otvor aplikáciu <b>Skratky</b> a ťukni na <b>＋</b>.</li><li>Pridaj akciu <b>Otvoriť URL</b> a vlož odkaz nižšie.</li>
          <li>Skratku pomenuj, napr. „Zapíš jedlo“. Potom stačí povedať „Hej Siri, zapíš jedlo“ alebo ju dať na plochu.</li></ol>
          <div class="fav-list" style="margin-top:10px">${row('food', 'Zapísať jedlo')}${row('symptom', 'Zapísať ťažkosti')}${row('stool', 'Zapísať stolicu')}</div>
          <p class="tiny" style="margin:8px 0 0">Skratka otvorí denník v Safari. Ak používaš ikonu na ploche, údaje sú tam zvlášť, preto je pohodlnejší Android alebo zápis cez ikonu.</p>`);
    }
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>${title}</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>${body}
      <div class="savebar"><button type="button" class="btn primary" data-act="mini-close">Hotovo</button></div>`;
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

  function openIntol() {
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>Čo ti vadí?</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>` +
      grp('', '<div class="chips col pick">' + TAGS.map(([v, e, t]) =>
        `<button type="button" class="chip${riskTags().includes(v) ? ' on' : ''}" data-intol="${v}">${esc(t)}</button>`).join('') + '</div>') +
      grp('Iné, čo v zozname nie je', `<div class="desc-row"><input type="text" id="ct-text" placeholder="napr. paradajky" enterkeyhint="done">
          <button type="button" class="btn small primary" data-act="ct-add">Pridať</button></div>
        <p class="tiny" style="margin:8px 0 0">Aplikácia to slovo odteraz hľadá v popise jedla (aj v starších záznamoch) a ráta s ním vo vyhodnotení rovnako ako s ostatnými.</p>
        ${customTags().length ? '<div class="fav-list" style="margin-top:10px">' + customTags().map(c => `<div class="fav-row"><span>${esc(c.label)}</span>
          <button type="button" class="btn ghost small" data-act="ct-del" data-id="${c.id}" aria-label="Zmazať">✕</button></div>`).join('') + '</div>' : ''}`) +
      `<div class="savebar"><button type="button" class="btn primary" data-act="mini-close">Hotovo</button></div>`;
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

