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
    return `<div class="banner"><div><b>Čas na zálohu</b>${when}</div>
      <button type="button" class="btn small primary" data-act="backup">Zálohovať</button></div>`;
  }

  function dayRows(date, v) {
    return DAY_FIELDS.map(([f, l, list, kind]) =>
      `<div class="row"><span class="k">${l}</span>${chipGroup(f, list, { value: v[f], kind, cls: 'seg', day: date })}</div>`
    ).join('');
  }

  function noSymBtn(d) {
    if (entries.some(e => e.type === 'symptom' && dayOf(e.ts) === d)) return '';
    const on = days[d] && days[d].noSymptoms;
    const lbl = d === todayStr() ? 'Dnes bez ťažkostí' : 'Deň bez ťažkostí';
    return `<button type="button" class="btn block nosym${on ? ' on' : ''}" data-act="no-sym" data-date="${d}">${lbl}${on ? ' ✓' : ''}</button>`;
  }

  function dayText(v) {
    if (!v) return '';
    const parts = [];
    if (v.noSymptoms) parts.push('bez ťažkostí');
    if (v.sleep != null) parts.push('spánok ' + lab(SLEEP, v.sleep));
    if (v.period != null) parts.push(v.period ? 'menštruácia' : 'bez menštruácie');
    if (v.activity != null) parts.push('pohyb ' + lab(ACTIVITY, v.activity));
    if (v.glasses) parts.push('voda ' + v.glasses + '×');
    else if (v.water != null) parts.push('pitie ' + lab(WATER, v.water));
    return parts.join(' · ');
  }

  function dayFilled(v) { return v ? DAY_FIELDS.filter(([f]) => v[f] != null).length : 0; }

  function dayIndex() {
    const sev = {}, has = new Set();
    entries.forEach(e => {
      const d = dayOf(e.ts);
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
    if (d === dayOf(Date.now() - DAY)) return ['Včera', wd + ' ' + date];
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
    // deň trvá do 4:00 rána nasledujúceho dátumu
    const minOf = ts => Math.max(0, Math.min(1440 + DAY_START_H * 60, (ts - base) / 60000));
    let startH = 6, endH = 24;
    list.forEach(e => { startH = Math.min(startH, Math.floor(minOf(e.ts) / 60)); endH = Math.max(endH, Math.ceil(minOf(e.ts) / 60)); });
    const span = endH * 60 - startH * 60;
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
      ${dayIndex().has.size > 4 ? '' : `<div class="rb-legend"><span><i></i>jedlo</span><span><i class="s"></i>ťažkosti (väčší kruh = silnejšie)</span>${isToday ? '<span><i class="n"></i>teraz</span>' : ''}</div>`}${riskLineHtml(list)}</div>`;
  }

  function riskLineHtml(list) {
    const risk = riskTags();
    if (!risk.length) return '';
    const cnt = {};
    list.filter(e => e.type === 'food').forEach(e => Analysis.mealTags(e).forEach(t => { if (risk.includes(t)) cnt[t] = (cnt[t] || 0) + 1; }));
    const keys = Object.keys(cnt);
    if (!keys.length) return '';
    return `<p class="risk-line">Rizikové suroviny v tento deň: ${keys.map(t => `<b>${esc(tagLabel(t))} ${cnt[t]}×</b>`).join(', ')}</p>`;
  }

  function entryRow(e) {
    const sev = e.type === 'symptom' && e.severity ? ` <span class="sev-pill" style="background:${sevColor(e.severity)}">${e.severity}/10</span>` : '';
    return `<div role="button" tabindex="0" class="entry ${e.type}${e.id === flashId ? ' flash' : ''}" data-id="${e.id}">
      <span class="time">${fmtTime(e.ts)}</span><span class="node"></span>
      <span class="ecard"><span class="desc">${e.type === 'food' ? '' : `<span class="tico ${e.type}">${TYPES[e.type].ico}</span> `}${esc(e.desc)}${sev}</span>${metaText(e)}${
        e.type === 'symptom' ? `<button type="button" class="trace-in" data-trace="${e.id}">Čo predchádzalo? ›</button>` : ''}</span></div>`;
  }

  function dayCardHtml(d) {
    const v = days[d] || {};
    const isToday = d === todayStr();
    const ns = noSymBtn(d);
    const nsHtml = ns ? `<div style="margin-top:10px">${ns}${isToday ? '<p class="tiny" style="margin:6px 0 0;text-align:center">Ťukni večer, ak dnes nebolo nič. Spresní to vyhodnotenie.</p>' : ''}</div>` : '';
    if (dayFilled(v) === DAY_FIELDS.length && !todayExpanded) {
      return `<div class="card"><div class="today-summary"><span class="txt">${esc(dayText(v))}</span>
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
    const list = entries.filter(e => dayOf(e.ts) === d).sort((a, b) => a.ts - b.ts);
    const [title, sub] = dayTitle(d);
    let h = `<header class="lt"><div><h1>${title}</h1><p>${sub}</p></div><button type="button" class="help-q" data-act="help" data-sec="today" aria-label="Pomocník">?</button>
      ${isToday ? '' : '<button type="button" class="btn small" data-act="go-today">Späť na dnes</button>'}</header>`;
    h += stripHtml();
    if (isToday) h += nudgeHtml(d, list) + bannerHtml() + testBannerHtml() + reintroBannerHtml() + weekHtml();
    if (list.length) {
      h += ribbonHtml(list, d);
      h += '<div class="tl">' + list.map(entryRow).join('') + '</div>';
    } else {
      h += `<div class="card empty"><div class="big"></div>
        <p><b>${isToday ? 'Dnes zatiaľ nič zapísané' : 'V tento deň nie je nič zapísané'}</b><br>Ťukni dole na ＋ a zapíš jedlo alebo ťažkosti.</p></div>`;
    }
    h += quickToolsHtml(d, list);
    h += drinkHtml(d, list);
    h += dayCardHtml(d);
    el.innerHTML = h;
    flashId = null;
    const strip = $('#strip'), cur = strip && $('.ds.sel', strip);
    if (cur) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2;
  }

  // minúty od polnoci; rozdiel dvoch časov dňa (cez polnoc tiež)
  const minOfDay = ts => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
  const clockGap = (a, b) => { const x = Math.abs(minOfDay(a) - minOfDay(b)); return Math.min(x, 1440 - x); };

  // Návrhy: čo sa jedáva často, nedávno a hlavne v túto dennú dobu (ráno raňajky, na obed obed)
  // ---------- Rýchly zápis na obrazovke Dnes ----------
  const recurring = () => meta.recurring || [];
  const recKey = (type, desc) => type + ':' + String(desc || '').trim().toLowerCase();
  const isRecurring = (type, desc) => recurring().some(r => recKey(r.type, r.desc) === recKey(type, desc));
  // čas v danom dni (h = hodina s desatinami)
  const atHour = (d, h) => parseDay(d).getTime() + h * 3600e3;
  const MEAL_SLOTS = [['raňajky', 4, 10.5, 7.5], ['obed', 10.5, 15.5, 12.5], ['večera', 16.5, 22, 18.5]];

  // Čo chýba: hneď po otvorení navrchu obrazovky Dnes
  function missingMeals(d, list) {
    const food = list.filter(e => e.type === 'food');
    const nowH = d === todayStr() ? (Date.now() - parseDay(d).getTime()) / 3600e3 : 99;
    return MEAL_SLOTS.filter(([, a, b]) => nowH >= b && !food.some(e => {
      const x = (e.ts - parseDay(d).getTime()) / 3600e3;
      return x >= a && x < b;
    }));
  }
  function nudgeHtml(d, list) {
    let h = '';
    // dnes: chýba jedlo, ktorého čas už prešiel (len ak sa dnes už niečo zapisovalo alebo je po 10:00)
    const nowH = (Date.now() - parseDay(d).getTime()) / 3600e3;
    // nový používateľ bez záznamov za posledné dni sa nemá cítiť napomínaný
    if (list.length || (nowH >= 10 && entries.some(e => e.ts > Date.now() - 3 * DAY))) {
      const miss = missingMeals(d, list);
      if (miss.length) {
        const names = miss.map(m => m[0]);
        h += `<div class="banner nudge"><div><b>Nezapísala si ${names.length > 1 ? names.slice(0, -1).join(', ') + ' a ' + names[names.length - 1] : names[0]}</b>Ak si jedla, zapíš to teraz. Ak nie, nič nerob.</div>
          <div class="nudge-btns">${miss.map(([n, , , at]) => `<button type="button" class="btn small primary" data-act="add-at" data-h="${at}">＋ ${n}</button>`).join('')}</div></div>`;
      }
    }
    // včera: niečo zapísané, ale nevieme, či boli ťažkosti
    const y = dayOf(Date.now() - DAY);
    const yList = entries.filter(e => dayOf(e.ts) === y);
    if (yList.some(e => e.type === 'food') && !yList.some(e => e.type === 'symptom') && !(days[y] && days[y].noSymptoms)) {
      h += `<div class="banner nudge"><div><b>Včera bez ťažkostí?</b>Včera nie sú zapísané ťažkosti ani „Deň bez ťažkostí“.</div>
        <div class="nudge-btns"><button type="button" class="btn small primary" data-act="no-sym" data-date="${y}">Áno, bez ťažkostí</button>
        <button type="button" class="btn small" data-act="sym-at" data-date="${y}">Zapísať ťažkosti</button></div></div>`;
    }
    return h;
  }

  function quickToolsHtml(d, list) {
    const isToday = d === todayStr();
    const now = Date.now();
    let h = '';
    // pravidelné záznamy, ktoré dnes ešte nie sú zapísané a ich čas sa blíži alebo prešiel
    if (isToday) {
      const todayKeys = new Set(list.map(e => recKey(e.type, e.desc)));
      const due = recurring().filter(r => !todayKeys.has(recKey(r.type, r.desc)) && now >= atHour(d, r.h + r.m / 60) - 30 * 60e3);
      if (due.length) {
        h += `<div class="card quick"><h3>Pravidelné</h3><div class="chips">` + due.map(r =>
          `<button type="button" class="chip rec" data-act="rec-log" data-id="${r.id}"><span class="tico ${r.type}">${TYPES[r.type].ico}</span> ${esc(r.desc)} <span class="tiny">${pad(r.h)}:${pad(r.m)}</span></button>`).join('') +
          '</div><p class="tiny" style="margin:8px 0 0">Ťuknutím zapíšeš.</p></div>';
      }
    }
    // zabudnuté jedlo v minulých dňoch (dnešok je navrchu obrazovky)
    const food = list.filter(e => e.type === 'food');
    if (!isToday && food.length) {
      const nowH = isToday ? (now - parseDay(d).getTime()) / 3600e3 : 99;
      const miss = MEAL_SLOTS.filter(([, a, b]) => nowH >= b && !food.some(e => {
        const x = (e.ts - parseDay(d).getTime()) / 3600e3;
        return x >= a && x < b;
      }));
      if (miss.length && miss.length < 3) {
        h += `<div class="card quick miss"><span>${miss.length === 1 ? 'Chýba ' + miss[0][0] + '?' : 'Chýbajú ' + miss.map(m => m[0]).join(' a ') + '?'}</span><div class="chips">` +
          miss.map(([n, , , at]) => `<button type="button" class="chip" data-act="add-at" data-h="${at}">＋ ${n}</button>`).join('') + '</div></div>';
      }
    }
    // rýchly zápis ťažkostí jedným ťuknutím
    if (isToday) {
      h += `<div class="card quick"><h3>Máš teraz ťažkosti?</h3><div class="chips sevrow">` +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" class="chip sev-${n}" data-act="quick-sym" data-v="${n}" style="--sc:${sevColor(n)}">${n}</button>`).join('') +
        '</div><div class="scale-ends"><span>slabé</span><span>neznesiteľné</span></div></div>';
    }
    return h;
  }

  function quickFor(type) {
    const m = new Map();
    const now = Date.now();
    const at = draft && draft.ts ? draft.ts : now;
    for (const e of entries) {
      if (e.type !== type || !e.desc) continue;
      const text = e.desc.trim();
      const k = text.toLowerCase();
      const r = m.get(k) || { text, n: 0, last: 0, near: 0 };
      r.n++;
      if (clockGap(e.ts, at) <= 120) r.near++;
      r.last = Math.max(r.last, e.ts);
      m.set(k, r);
    }
    const list = [...m.values()]
      .map(r => ({ ...r, score: r.n + r.near * 2 + (now - r.last < 3 * DAY ? 2 : 0) }))
      .sort((a, b) => b.score - a.score || b.last - a.last)
      .map(r => r.text);
    if (type === 'med') MED_DEFAULTS.forEach(d => { if (!list.some(x => x.toLowerCase() === d.toLowerCase())) list.push(d); });
    return list.slice(0, 12);
  }

  function field(label, inner, opt) {
    return `<div class="field"><span class="label">${label}${opt ? ' <span class="opt">(nepovinné)</span>' : ''}</span>${inner}</div>`;
  }

  const grp = (title, inner, extra) => `<section class="grp"${extra || ''}>${title ? `<h4>${title}</h4>` : ''}${inner}</section>`;
  const sw = (id, label, on) => `<label class="sw"><span>${label}</span><input type="checkbox" id="${id}"${on ? ' checked' : ''}></label>`;

  function descField(placeholder) {
    const isFood = draft.type === 'food';
    const favs = isFood ? favorites() : [];
    const favSet = new Set(favs.map(f => f.desc.toLowerCase()));
    const q = quickFor(draft.type).filter(t => !favSet.has(t.toLowerCase()));
    const chipsHtml = favs.map((f, i) => `<button type="button" class="chip fav" data-fav="${i}">★ ${esc(f.desc)}</button>`).join('') +
      q.map(t => `<button type="button" class="chip" data-q="${esc(t)}">${esc(t)}</button>`).join('');
    const n = favs.length + q.length;
    // „Ako včera“: čo bolo zapísané včera v podobnom čase (±2,5 h)
    const yd = dayOf(draft.ts - DAY);
    const yest = editingId ? null : entries.filter(e => e.type === draft.type && e.desc && dayOf(e.ts) === yd && clockGap(e.ts, draft.ts) <= 150)
      .sort((a, b) => clockGap(a.ts, draft.ts) - clockGap(b.ts, draft.ts))[0];
    const again = yest && !draft.desc ? `<button type="button" class="chip again" data-q="${esc(yest.desc.trim())}"><span class="tiny">Ako včera</span> ${esc(yest.desc.trim())}</button>` : '';
    const quick = (again ? `<div class="again-row">${again}</div>` : '') + (chipsHtml ? `<details class="quick-dd"${draft.quickOpen ? ' open' : ''}><summary>Naposledy ${isFood ? 'jedené' : 'zapísané'} <span>${n}</span></summary>
      <div class="chips quick">${chipsHtml}</div><p class="tiny" style="margin:8px 0 0">Ťukni na viac položiek, pridajú sa za seba. Opätovným ťuknutím položku odoberieš.</p></details>` : '');
    const star = isFood ? `<button type="button" class="star${isFav(draft.desc) ? ' on' : ''}" id="fav-btn" data-act="fav" aria-label="Uložiť medzi obľúbené">${favBtnText()}</button>` : '';
    return grp('', `<div class="desc-row"><textarea id="f-desc" class="big" rows="1" placeholder="${esc(placeholder)}" enterkeyhint="done">${esc(draft.desc)}</textarea>${isFood ? `<span class="desc-btns">${star}<button type="button" class="star" data-act="scan" aria-label="Skenovať čiarový kód">${ic('scan')}</button></span>` : ''}</div>${quick}`);
  }

