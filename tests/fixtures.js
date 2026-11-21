/* Vymyslené údaje na testy: 4 týždne jedla a ťažkostí so známym vzorcom.
   Mliečne jedlá spôsobujú ťažkosti 1–3 h po jedle, viac pri 2 a viac porciách za deň,
   menej s enzýmom. Ostatné ťažkosti sú zriedkavý náhodný šum. Vždy rovnaké (pevné semienko). */
'use strict';

const H = 3600e3, DAY = 864e5;

function makeData(now, opts) {
  opts = opts || {};
  let seed = opts.seed || 20261121;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const pad = n => String(n).padStart(2, '0');
  const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  let n = 0;
  const id = () => 't' + (++n);

  const BREAKFAST = [['ovsená kaša s mliekom', 1], ['chlieb s maslom a šunkou', 1], ['jogurt s ovocím', 1],
    ['vajíčka s chlebom', 0], ['banán a orechy', 0], ['chlieb s avokádom', 0]];
  const LUNCH = [['kuracie mäso s ryžou', 0], ['cestoviny so syrom', 1], ['fazuľová polievka a chlieb', 0],
    ['bryndzové halušky', 1], ['ryba so zemiakmi', 0], ['zeleninový šalát s tuniakom', 0], ['šošovicový prívarok', 0]];
  const DINNER = [['ryža so zeleninou', 0], ['syrový toast', 1], ['kuracia polievka', 0], ['grilovaná zelenina', 0], ['omeleta so syrom', 1]];

  const entries = [], days = {};
  const nowD = new Date(now);
  const today0 = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate());
  const N = opts.days || 28;
  for (let back = N; back >= 1; back--) {
    const d0 = new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - back);
    const base = d0.getTime();
    let dairyToday = 0, sym = false;
    const add = (h, list) => {
      const ts = base + h * H + Math.floor(rnd() * 40) * 60e3;
      const [desc, dairy] = pick(list);
      const enzyme = !!dairy && rnd() < 0.2;
      entries.push({ id: id(), type: 'food', ts, desc, portion: 'normalna', tags: [], noTags: [], enzyme });
      if (dairy) {
        dairyToday += enzyme ? 0.3 : 1;
        let p = 0.25 + 0.3 * Math.max(0, dairyToday - 1);
        if (enzyme) p *= 0.3;
        if (rnd() < Math.min(0.9, p)) {
          const st = ts + (1 + rnd() * 2) * H;
          entries.push({ id: id(), type: 'symptom', ts: st, desc: 'nadúvanie', severity: 4 + Math.floor(rnd() * 4), kinds: ['nadúvanie'] });
          sym = true;
        }
      } else if (rnd() < 0.03) {
        entries.push({ id: id(), type: 'symptom', ts: ts + 3 * H, desc: 'nevoľnosť', severity: 2, kinds: ['nevoľnosť'] });
        sym = true;
      }
    };
    add(7.5, BREAKFAST);
    add(12.3, LUNCH);
    add(18.6, DINNER);
    const day = { date: ds(d0), sleep: rnd() < 0.25 ? 'zle' : 'ok' };
    if (!sym) day.noSymptoms = true;
    days[day.date] = day;
  }
  return { entries, days };
}

module.exports = { makeData, H, DAY };
