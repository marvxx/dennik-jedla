
  // ---------- Je to lepšie? (dni s ťažkosťami po týždňoch) ----------
  // Udalosti na grafe: začiatok testu a zavádzania (meta.history) a uložené zistenia.
  const eventLog = () => meta.history || [];
  async function addHistory(txt) {
    await setMeta('history', eventLog().concat([{ ts: Date.now(), txt }]).slice(-50));
  }

  // pondelok týždňa, do ktorého patrí deň (ako reťazec RRRR-MM-DD)
  function weekStart(ds) {
    const d = parseDay(ds);
    const back = (d.getDay() + 6) % 7;
    return dateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 12).getTime());
  }
  const addDays = (ds, n) => { const d = parseDay(ds); return dateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12).getTime()); };
  const shortDate = ds => { const d = parseDay(ds); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; };

  function weeklyTrend(maxWeeks) {
    if (!entries.length) return [];
    const today = todayStr();
    const first = entries.reduce((m, e) => Math.min(m, e.ts), Infinity);
    const ix = dayIndex();
    const logged = new Set(entries.map(e => dayOf(e.ts)));
    const sevByDay = ix.sev;
    let ws = weekStart(today);
    const firstWs = weekStart(dayOf(first));
    const weeks = [];
    while (weeks.length < maxWeeks && ws >= firstWs) {
      let n = 0, sym = 0, known = 0, sevSum = 0, sevN = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        if (d > today) break;
        n++;
        const s = sevByDay[d];
        if (s) { sym++; known++; sevSum += s; sevN++; } else if (days[d] && days[d].noSymptoms) known++;
      }
      const lg = [...Array(n)].filter((_, i) => logged.has(addDays(ws, i))).length;
      weeks.unshift({ ws, n, sym, known, logged: lg, avg: sevN ? sevSum / sevN : null, current: ws === weekStart(today) });
      ws = addDays(ws, -7);
    }
    return weeks;
  }

  function trendEvents(weeks) {
    if (!weeks.length) return [];
    const from = parseDay(weeks[0].ws).getTime();
    const ev = eventLog().map(h => ({ ts: h.ts, txt: h.txt }))
      .concat(findings().filter(f => f.ts).map(f => ({ ts: f.ts, txt: 'zistenie: ' + f.text + ' – ' + FND_TXT[f.status] })));
    return ev.filter(x => x.ts >= from).sort((a, b) => a.ts - b.ts)
      .map(x => ({ ...x, wi: weeks.findIndex(w => w.ws === weekStart(dayOf(x.ts))) })).filter(x => x.wi >= 0);
  }

  // porovnanie posledných 4 ukončených týždňov s predošlými 4 (len týždne s údajmi)
  function trendVerdict(weeks) {
    const done = weeks.filter(w => !w.current && w.logged >= 3);
    if (done.length < 4) return null;
    const rate = list => list.reduce((a, w) => a + w.sym / w.n * 7, 0) / list.length;
    const recent = done.slice(-4), prev = done.slice(-8, -4);
    const a = rate(recent), f = x => x.toFixed(1).replace('.', ',');
    if (prev.length < 2) return { text: `Posledné týždne ťažkosti priemerne ${f(a)} dňa týždenne.`, word: '', tone: '' };
    const b = rate(prev), diff = a - b;
    const tone = diff <= -0.5 ? 'good' : diff >= 0.5 ? 'bad' : '';
    return { text: `Posledné 4 týždne ťažkosti priemerne ${f(a)} dňa týždenne, predtým ${f(b)}.`, word: tone === 'good' ? 'Lepšie.' : tone === 'bad' ? 'Horšie.' : 'Zhruba rovnako.', tone };
  }

  // forReport: bez karty, do prehľadu pre lekára
  function trendHtml(forReport) {
    const weeks = weeklyTrend(12);
    const usable = weeks.filter(w => w.logged >= 3);
    if (usable.length < 2) return '';
    const ev = trendEvents(weeks);
    const W = 300, Hh = 120, top = 10, base = 92, N = weeks.length, bw = W / N;
    let svg = '';
    for (let y = 0; y <= 7; y += 7) svg += `<line x1="0" y1="${base - (y / 7) * (base - top)}" x2="${W}" y2="${base - (y / 7) * (base - top)}" stroke="var(--line)" stroke-width="${y ? 0.6 : 1}"${y ? ' stroke-dasharray="2 3"' : ''}/>`;
    weeks.forEach((w, i) => {
      const x = i * bw + bw * 0.18, wd = bw * 0.64;
      const thin = w.logged < 3;
      if (w.sym) {
        const h = (w.sym / 7) * (base - top);
        svg += `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${wd.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${sevColor(Math.round(w.avg))}"${thin ? ' opacity=".35"' : ''}><title>${shortDate(w.ws)}: ${w.sym} dní s ťažkosťami</title></rect>`;
        svg += `<text x="${(x + wd / 2).toFixed(1)}" y="${(base - h - 3).toFixed(1)}" text-anchor="middle" class="v">${w.sym}</text>`;
      } else if (!thin) {
        svg += `<circle cx="${(x + wd / 2).toFixed(1)}" cy="${base - 4}" r="2.6" fill="var(--food)"><title>${shortDate(w.ws)}: bez ťažkostí</title></circle>`;
      }
      if (i === 0 || i === N - 1 || i === Math.floor((N - 1) / 2)) {
        svg += `<text x="${(x + wd / 2).toFixed(1)}" y="${base + 11}" text-anchor="middle">${w.current ? 'teraz' : shortDate(w.ws)}</text>`;
      }
    });
    // značky udalostí pod osou
    const marks = [];
    ev.forEach(x => { if (!marks.includes(x.wi)) marks.push(x.wi); });
    marks.forEach(wi => {
      const cx = wi * bw + bw / 2;
      const num = ev.findIndex(x => x.wi === wi) + 1;
      svg += `<circle cx="${cx.toFixed(1)}" cy="${base + 21}" r="5.5" fill="var(--accent)"/><text x="${cx.toFixed(1)}" y="${base + 23.6}" text-anchor="middle" class="m">${num}</text>`;
    });

    const tv = trendVerdict(weeks);
    const verdict = tv ? tv.text + (tv.word ? ' ' + (tv.tone ? `<b class="${tv.tone}">${tv.word}</b>` : tv.word) : '') : '';
    const evList = ev.length ? '<ol class="tr-ev">' + ev.map((x, i) => `<li><b>${i + 1}</b> ${esc(shortDate(dayOf(x.ts)))} ${esc(x.txt)}</li>`).join('') + '</ol>' : '';
    if (forReport) {
      return `<h3>Vývoj po týždňoch</h3><div class="trend"><svg class="rchart tr" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Počet dní s ťažkosťami v jednotlivých týždňoch">${svg}</svg>
        <p class="tiny" style="margin:2px 0 0">Stĺpec = počet dní s ťažkosťami v týždni (zo 7), farba = priemerná sila.</p>${evList}</div>`;
    }
    return `<div class="card trend"><h2>Je to lepšie?</h2>
      <svg class="rchart tr" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Počet dní s ťažkosťami v jednotlivých týždňoch">${svg}</svg>
      <p class="tiny" style="margin:2px 0 0">Stĺpec = počet dní s ťažkosťami v týždni (zo 7), farba = priemerná sila. Bledý stĺpec = málo zápisov.</p>
      ${verdict ? `<p class="small" style="margin:10px 0 0">${verdict}</p>` : ''}${evList}</div>`;
  }
