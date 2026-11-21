
  // ---------- Zameranie výsledkov: všetky ťažkosti, jeden druh, alebo stolica ----------
  // Výpočty sú rovnaké; mení sa len, čo sa ráta ako „ťažkosti“. Pri jednom druhu sú ostatné
  // ťažkosti dňom „bez tohto druhu“. Pri stolici sa ráta riedka (Bristol 5–7) alebo tvrdá (1–2)
  // stolica 6–36 h po jedle a vyhodnocujú sa len dni, keď je stolica zapísaná.
  let insFocus = 'all';
  let FD = null;   // údaje posledného výpočtu (podľa zamerania)
  const LOOSE = new Set(['b5', 'b6', 'b7', 'makka', 'hnacka']);
  const HARD = new Set(['b1', 'b2', 'tvrda']);
  const STOOL_SEV = { b1: 6, b2: 4, b5: 4, b6: 6, b7: 8, makka: 4, hnacka: 7, tvrda: 5 };

  // jazyk výsledkov podľa zamerania
  let OUT = outFor('all', 6);
  function outFor(f, toH) {
    if (f.startsWith('stool:')) {
      const w = f === 'stool:loose' ? 'riedka' : 'tvrdá';
      return { after: `bola o 6–36 h ${w} stolica`, afterShort: `bola ${w} stolica`, dayHad: `bola ${w} stolica`, ev: `${w} stolica`, late: false, delay: false, label: `${w} stolica` };
    }
    const k = f.startsWith('kind:') ? ' (' + f.slice(5) + ')' : '';
    return { after: `prišli do ${toH} h ťažkosti${k}`, afterShort: `prišli ťažkosti${k}`, dayHad: `boli ťažkosti${k}`, ev: 'ťažkosti' + k, late: true, delay: true, label: k ? f.slice(5) : 'všetky ťažkosti' };
  }

  // aké zamerania majú zmysel: druh aspoň 3×, stolica aspoň 3×
  function focusOptions() {
    const opts = [['all', 'Všetky']];
    const kc = {};
    entries.filter(e => e.type === 'symptom').forEach(e => (e.kinds || []).forEach(k => { kc[k] = (kc[k] || 0) + 1; }));
    Object.entries(kc).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).forEach(([k]) => opts.push(['kind:' + k, k]));
    const st = entries.filter(e => e.type === 'stool');
    if (st.filter(e => LOOSE.has(e.stool)).length >= 3) opts.push(['stool:loose', 'riedka stolica']);
    if (st.filter(e => HARD.has(e.stool)).length >= 3) opts.push(['stool:hard', 'tvrdá stolica']);
    return opts;
  }

  // údaje a nastavenie výpočtu pre zameranie
  function focusData(f) {
    const fromH = meta.fromH != null ? meta.fromH : 0, toH = meta.toH != null ? meta.toH : 6, minN = meta.minN || 5;
    const base = { fromH, toH, minN, riskTags: riskTags() };
    if (!f || f === 'all') return { f: 'all', E: entries, D: days, opts: base, out: outFor('all', toH) };
    if (f.startsWith('kind:')) {
      const k = f.slice(5);
      const has = e => (e.kinds || []).includes(k);
      const E = entries.filter(e => e.type !== 'symptom' || has(e));
      const D = Object.assign({}, days);
      // deň s inými ťažkosťami je pre tento druh „bez ťažkostí“
      const withK = new Set(entries.filter(e => e.type === 'symptom' && has(e)).map(e => dayOf(e.ts)));
      entries.filter(e => e.type === 'symptom' && !has(e)).forEach(e => {
        const d = dayOf(e.ts);
        if (!withK.has(d)) D[d] = Object.assign({ date: d }, D[d], { noSymptoms: true });
      });
      return { f, E, D, opts: base, out: outFor(f, toH) };
    }
    // stolica: riedka alebo tvrdá stolica ako „ťažkosti“
    const set = f === 'stool:loose' ? LOOSE : HARD;
    const pseudo = entries.filter(e => e.type === 'stool' && set.has(e.stool))
      .map(e => ({ id: 'st-' + e.id, type: 'symptom', ts: e.ts, desc: e.desc, severity: STOOL_SEV[e.stool] || 5, kinds: [] }));
    const E = entries.filter(e => e.type !== 'symptom' && e.type !== 'stool').concat(pseudo);
    const D = {};
    Object.entries(days).forEach(([d, v]) => { const c = Object.assign({}, v); delete c.noSymptoms; D[d] = c; });
    const hitDays = new Set(pseudo.map(e => dayOf(e.ts)));
    entries.filter(e => e.type === 'stool').forEach(e => {
      const d = dayOf(e.ts);
      if (!hitDays.has(d)) D[d] = Object.assign({ date: d }, D[d], { noSymptoms: true });
    });
    return { f, E, D, opts: Object.assign({}, base, { fromH: 6, toH: 36 }), out: outFor(f, 36) };
  }

  // výber zamerania nad výsledkami
  function focusBar() {
    const opts = focusOptions();
    if (opts.length < 2) return '';
    if (!opts.some(([k]) => k === insFocus)) insFocus = 'all';
    return `<div class="focus" role="group" aria-label="Zameranie výsledkov"><span class="tiny">Čo vyhodnotiť:</span>
      <div class="chips focus-chips">${opts.map(([k, l]) => `<button type="button" class="chip${k === insFocus ? ' on' : ''}" data-focus="${esc(k)}">${esc(l)}</button>`).join('')}</div></div>`;
  }
