
  // ---------- Pitie: voda a káva jedným ťuknutím ----------
  // Voda sa počíta v pohároch za deň (days[d].glasses). Káva sa zapisuje ako jedlo s časom,
  // aby sa dala vyhodnotiť ako ostatné jedlá (napr. „káva ako prvé v daný deň“).
  const WATER_GOAL = 6;
  const GLASS_L = 0.25;   // jeden dielik = pohár 2,5 dl
  const liters = g => String(Math.round(g * GLASS_L * 100) / 100).replace('.', ',') + ' l';
  const isCoffee = e => e.type === 'food' && Analysis.mealTags(e).includes('kava');

  // najčastejšie zapisovaná káva (napr. „káva s mliekom“), inak len „káva“
  function usualCoffee() {
    const m = new Map();
    entries.filter(isCoffee).forEach(e => { const k = e.desc.trim(); m.set(k, (m.get(k) || 0) + 1); });
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : 'káva';
  }

  let waterBump = false;   // číslo krátko poskočí po ťuknutí
  function drinkHtml(d, list) {
    const g = (days[d] && days[d].glasses) || 0;
    const cups = list.filter(isCoffee).length;
    const drops = [...Array(Math.max(WATER_GOAL, g))].map((_, i) => `<i class="${i < g ? 'on' : ''}"></i>`).join('');
    return `<div class="drink">
      <div class="dr-row"><span class="dr-ico water">${ic('drop')}</span>
        <span class="dr-txt"><b>Voda</b><small><span class="w-l${waterBump ? ' bump' : ''}">${liters(g)}</span>${g < WATER_GOAL ? ' · cieľ ' + liters(WATER_GOAL) : ' ✓'}</small><span class="drops">${drops}</span></span>
        <button type="button" class="dr-btn minus" data-act="water" data-v="-1" data-date="${d}" aria-label="Ubrať 0,25 l"${g ? '' : ' disabled'}>−</button>
        <button type="button" class="dr-btn" data-act="water" data-v="1" data-date="${d}" aria-label="Pridať 0,25 l">＋</button></div>
      <div class="dr-row"><span class="dr-ico coffee">${ic('cup')}</span>
        <span class="dr-txt"><b>Káva</b><small>${cups ? cups + '× · ' : ''}${esc(usualCoffee())}</small></span>
        <button type="button" class="dr-btn" data-act="coffee" data-date="${d}" aria-label="Zapísať kávu">＋</button></div></div>`;
  }

  async function addWater(d, step) {
    const v = days[d] || { date: d };
    v.glasses = Math.max(0, (v.glasses || 0) + step);
    if (!v.glasses) delete v.glasses;
    days[d] = v;
    await DB.put('days', v);
    if (!meta.firstUse) await setMeta('firstUse', Date.now());
    if (step > 0) buzz(8);
  }

  async function addCoffee(d) {
    const now = Date.now();
    const ts = d === todayStr() ? now : atHour(d, 10);
    const desc = usualCoffee();
    const src = entries.filter(e => isCoffee(e) && e.desc.trim() === desc).sort((a, b) => b.ts - a.ts)[0];
    const e = { id: uid(), type: 'food', ts, desc, stress: null, mood: null, note: '', created: now, updated: now,
      portion: (src && src.portion) || null, rushed: false, tags: (src && src.tags) || [], noTags: (src && src.noTags) || [],
      amount: '', product: null, place: (src && src.place) || null, enzyme: false };
    await DB.put('entries', e);
    entries.push(e);
    if (!meta.firstUse) await setMeta('firstUse', now);
    buzz(8);
    return e;
  }
