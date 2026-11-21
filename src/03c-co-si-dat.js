
  // ---------- Čo si dať: jedlá, po ktorých neboli ťažkosti ----------
  // Celé jedlá tak, ako boli zapísané (nie jednotlivé suroviny). Rátajú sa len dni, o ktorých vieme,
  // či boli ťažkosti (zapísané ťažkosti alebo „Deň bez ťažkostí“).
  const slotOf = ts => {
    const h = (ts - parseDay(dayOf(ts)).getTime()) / 3600e3;
    const s = MEAL_SLOTS.findIndex(([, a, b]) => h >= a && h < b);
    return s;
  };

  function safeMeals() {
    return memo('safeMeals', () => {
      const toH = meta.toH != null ? meta.toH : 6;
      const symTs = entries.filter(e => e.type === 'symptom').map(e => e.ts).sort((a, b) => a - b);
      const ix = dayIndex();
      const risk = riskTags();
      // je ťažkosť v okne (ts, ts + toH]? binárne vyhľadanie prvej ťažkosti po jedle
      const hitAfter = ts => {
        let lo = 0, hi = symTs.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (symTs[m] <= ts) lo = m + 1; else hi = m; }
        return lo < symTs.length && symTs[lo] <= ts + toH * 3600e3;
      };
      const M = new Map();
      for (const e of entries) {
        if (e.type !== 'food' || !e.desc || isCoffee(e)) continue;
        if (e.ts + toH * 3600e3 > Date.now()) continue;   // ešte sa čaká
        const d = dayOf(e.ts);
        if (!ix.sev[d] && !(days[d] && days[d].noSymptoms)) continue;   // deň bez informácie o ťažkostiach
        const k = e.desc.trim().toLowerCase();
        let m = M.get(k);
        if (!m) { m = { desc: e.desc.trim(), ok: 0, bad: 0, last: 0, slots: [0, 0, 0], risky: false }; M.set(k, m); }
        if (hitAfter(e.ts)) m.bad++; else m.ok++;
        if (e.ts > m.last) { m.last = e.ts; m.desc = e.desc.trim(); }
        const s = slotOf(e.ts);
        if (s >= 0) m.slots[s]++;
        if (Analysis.mealTags(e).some(t => risk.includes(t))) m.risky = true;
      }
      return [...M.values()]
        .filter(m => !m.risky && ((m.ok >= 2 && !m.bad) || (m.ok >= 4 && m.bad / (m.ok + m.bad) <= 0.15)))
        .sort((a, b) => b.ok - a.ok || b.last - a.last);
    });
  }

  // Na obrazovke Dnes: návrh na najbližšie jedlo, ktoré ešte nie je zapísané
  function ideasHtml(d, list) {
    if (d !== todayStr()) return '';
    const nowH = (Date.now() - parseDay(d).getTime()) / 3600e3;
    const food = list.filter(e => e.type === 'food' && !isCoffee(e));
    const si = MEAL_SLOTS.findIndex(([, a, b]) => nowH < b && !food.some(e => {
      const x = (e.ts - parseDay(d).getTime()) / 3600e3;
      return x >= a && x < b;
    }));
    if (si < 0) return '';
    const picks = safeMeals().filter(m => m.slots[si] > 0).slice(0, 5);
    if (picks.length < 2) return '';
    const word = ['Na raňajky', 'Na obed', 'Na večeru'][si];
    return `<div class="card quick ideas"><h3>${word} ti sedelo</h3><div class="chips">` +
      picks.map(m => `<button type="button" class="chip" data-act="eat-idea" data-idea="${esc(m.desc)}">${esc(m.desc)} <span class="tiny">${m.ok}×</span></button>`).join('') +
      '</div><p class="tiny" style="margin:8px 0 0">Jedlá, po ktorých si nemala ťažkosti. Ťuknutím zapíšeš.</p></div>';
  }
