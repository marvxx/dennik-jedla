/* Testy vyhodnotenia (analysis.js). Spustenie: node --test tests/ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../analysis.js');
const { makeData, H, DAY } = require('./fixtures.js');

const NOW = new Date(2026, 10, 21, 16, 0).getTime();   // sobota 21. 11. 2026 16:00
const food = (id, ts, desc, extra) => Object.assign({ id, type: 'food', ts, desc, tags: [], noTags: [] }, extra || {});
const sym = (id, ts, severity) => ({ id, type: 'symptom', ts, desc: 'ťažkosti', severity: severity || 5 });

test('mliečne vyjdú ako najsilnejšia skupina pred ťažkosťami', () => {
  const { entries, days } = makeData(NOW);
  const r = A.analyze(entries, days, { now: NOW });
  const tags = r.ctx.filter(x => x.key.startsWith('tag:'));
  const dairy = tags.find(x => x.key === 'tag:mliecne');
  assert.ok(dairy, 'skupina mliečne chýba');
  assert.notEqual(dairy.level, 'none');
  for (const t of tags) if (t !== dairy) assert.ok(dairy.ratio >= t.ratio, `${t.key} vyšlo silnejšie ako mliečne`);
});

test('dávka za deň: 2 a viac mliečnych porcií je podozrivých', () => {
  const { entries, days } = makeData(NOW);
  const r = A.analyze(entries, days, { now: NOW });
  const load = r.loads.find(x => x.key === 'load:mliecne');
  assert.ok(load && load.level !== 'none');
});

test('enzým pri rizikovom jedle znižuje ťažkosti', () => {
  const { entries, days } = makeData(NOW);
  const r = A.analyze(entries, days, { now: NOW, riskTags: ['mliecne'] });
  const enz = r.riskCtx.find(x => x.key === 'risk&enzyme');
  assert.ok(enz, 'porovnanie s enzýmom chýba');
  assert.ok(enz.ratio < 1, 'enzým by mal znižovať ťažkosti');
});

test('jedlo bez súvisu nie je podozrivé', () => {
  const { entries, days } = makeData(NOW);
  const r = A.analyze(entries, days, { now: NOW });
  const rice = r.foods.find(x => x.label === 'ryža');
  assert.ok(!rice || rice.level === 'none');
});

test('názvy jedál sú v základnom tvare alebo z vlastného textu', () => {
  const t0 = NOW - 40 * DAY;
  const descs = ['chlieb so šunkou', 'rožok so šunkou', 'toast so šunkou', 'chlieb so šunkou a syrom', 'jogurt s medom', 'čaj s medom',
    'tvaroh s medom', 'palacinky s medom', 'mleté mäso s ryžou', 'mleté mäso so zemiakmi', 'mleté mäso a cestoviny', 'mrkvy', 'kolac', 'kolac', 'kolac',
    'omacka s knedlou', 'omacka s ryzou', 'pečenej zeleniny tanier', 'pečenej zelenine', 'volske oko', 'volske oko so slaninou',
    'fasirky so strúhaným syrom v podobe, obsahovali horčice a vajíčka spolu', 'fasirky so strúhaným syrom v podobe, obsahovali horčice a vajíčka spolu'];
  const e = descs.map((d, i) => food('n' + i, t0 + i * DAY + 12 * H, d));
  e.push(sym('s', t0 + 5 * DAY + 13 * H));
  const r = A.analyze(e, {}, { now: NOW, minN: 50 });
  const labels = r.foodsPending.map(x => x.label);
  for (const want of ['šunka', 'med', 'mleté mäso', 'mrkva', 'koláč', 'omáčka', 'pečenej zeleniny', 'volske oko']) {
    assert.ok(labels.includes(want), `chýba „${want}“ v ${labels.join(', ')}`);
  }
  for (const bad of ['šunkou', 'medom', 'mleté', 'mrkvy', 'pečenej', 'omacka']) assert.ok(!labels.includes(bad), `nečitateľný názov „${bad}“`);
  assert.ok(!labels.some(l => l.split(' + ').length > 2), 'zlepenec slov: ' + labels.filter(l => l.includes(' + ')).join(', '));
  assert.ok(labels.some(l => l.startsWith('fasirky so strúhaným') && l.endsWith('…')));
});

test('deň sa začína o 4:00: neskorá večera patrí k predošlému dňu', () => {
  assert.equal(A.localDate(new Date(2026, 10, 21, 1, 30).getTime()), '2026-11-20');
  assert.equal(A.localDate(new Date(2026, 10, 21, 4, 0).getTime()), '2026-11-21');
  assert.equal(A.localDate(new Date(2026, 10, 21, 23, 59).getTime()), '2026-11-21');
});

test('ťažkosti po polnoci sa rátajú do dňa večere', () => {
  const t = new Date(2026, 10, 10, 22, 0).getTime();
  const e = [food('a', t, 'pizza'), sym('b', t + 3 * H)];
  const ev = A.evidence(e, {}, 'pizz', NOW);
  assert.equal(ev.list.length, 1);
  assert.equal(Math.round(ev.list[0].delay), 3);
});

test('oneskorenie: ťažkosti 1–3 h po mliečnom jedle', () => {
  const { entries, days } = makeData(NOW);
  const ev = A.evidence(entries, days, 'tag:mliecne', NOW);
  assert.ok(ev.mine.n >= 10);
  // vrchol je v okne 1–2 h alebo 2–4 h
  assert.ok(ev.peak === 1 || ev.peak === 2, 'vrchol ' + ev.peak);
});

test('Moje jedlá: suroviny sa zarátajú do skupín', () => {
  A.setRecipes([{ name: 'mamine halušky', ingredients: 'halušky, bryndza, slanina' }]);
  try {
    const tags = A.mealTags({ desc: 'Mamine halušky', tags: [], noTags: [] });
    assert.ok(tags.includes('mliecne') && tags.includes('lepok'), tags.join(','));
    assert.equal(A.recipeOf('mamine halušky s kyslou smotanou').length, 1);
  } finally {
    A.setRecipes([]);
  }
});

test('ručne vypnutá skupina sa neráta', () => {
  assert.ok(!A.mealTags({ desc: 'káva s mliekom', tags: [], noTags: ['mliecne'] }).includes('mliecne'));
});

test('fázy cyklu podľa menštruácie', () => {
  const days = {};
  const set = (y, m, d, v) => { days[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = v; };
  for (let d = 1; d <= 30; d++) set(2026, 10, d, { period: d <= 5 });   // október: menštruácia 1.–5.
  for (let d = 1; d <= 20; d++) set(2026, 11, d, { period: d >= 1 && d <= 4 });   // november: 1.–4.
  const ph = A.cyclePhases(days);
  assert.equal(ph['2026-10-03'], 'men');
  assert.equal(ph['2026-10-10'], 'fol');
  assert.equal(ph['2026-10-25'], 'lut');   // cyklus 31 dní, posledných 14 pred 1. 11.
  assert.equal(ph['2026-11-02'], 'men');
});

test('bez údajov nič nepadne', () => {
  const r = A.analyze([], {}, { now: NOW });
  assert.equal(r.totalN, 0);
  assert.deepEqual(r.foods, []);
  assert.equal(A.bestWorst([], {}, NOW), null);
  assert.equal(A.evidence([], {}, 'tag:mliecne', NOW).list.length, 0);
  assert.equal(A.evidence([], {}, 'gap:long', NOW), null);
});
