
  // ---------- Rozpis jedla na suroviny cez AI (Claude) ----------
  // Do AI ide IBA text jedla (napr. „segedín s knedľou“). Žiadne ťažkosti, stolica, lieky ani dátumy.
  // Výsledok sa uloží do „Moje jedlá“, takže každé jedlo ide do AI len raz a potom to funguje aj bez internetu.
  // Apka nemá server, preto sa volá priamo z telefónu s vlastným API kľúčom (uložený len v tomto telefóne, nie v zálohe).
  const AI_MODEL = 'claude-opus-5-5';
  const AI_BATCH = 40;          // jedál v jednej požiadavke
  const AI_MAX_RUN = 160;       // najviac jedál naraz (pri zapnutí sa rozpíše aj história)
  const aiOn = () => !!(meta.aiOn && meta.aiKey);
  const aiSeen = () => meta.aiSeen || [];
  const aiKeyOf = d => String(d || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const AI_SYSTEM = `Rozpisuješ jedlá zo slovenského denníka jedla a trávenia na suroviny. Denník hľadá potravinové intolerancie (mliečne, lepok, cibuľa a cesnak, strukoviny, fruktóza, histamín a pod.), preto sú dôležité aj skryté suroviny: smotana, maslo, mlieko, syr, múka, strúhanka, droždie, vajce, cibuľa, cesnak, med, ocot.
Pre každé zložené jedlo v texte vráť:
- name: názov jedla presne tak, ako je napísaný v texte (malými písmenami, rovnaké tvary slov, súvislá časť textu),
- ingredients: 3 až 10 typických surovín bežného slovenského receptu, v základnom tvare po slovensky (napr. „bravčové mäso“, „kyslá kapusta“, „smotana“, „cibuľa“, „hladká múka“).
Jeden riadok môže obsahovať viac jedál (napr. „segedín s knedľou“ → „segedín“ a „knedľa“). Vynechaj nápoje a veci, ktoré sú samé osebe jednou surovinou (jablko, rožok, jogurt). Ak jedlo nepoznáš, vynechaj ho. Ak je pri surovine v texte uvedený variant (bezlaktózová smotana, bezlepková múka, kváskový chlieb), zachovaj ho. Nič nevymýšľaj navyše.`;

  const AI_SCHEMA = {
    type: 'object',
    properties: {
      dishes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, ingredients: { type: 'array', items: { type: 'string' } } },
          required: ['name', 'ingredients'],
          additionalProperties: false,
        },
      },
    },
    required: ['dishes'],
    additionalProperties: false,
  };

  class AiError extends Error {
    constructor(msg, kind) { super(msg); this.kind = kind; }
  }

  // Jedno volanie API: zoznam textov jedál → [{name, ingredients[]}]
  async function aiAsk(lines, key) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2026-10-21',
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: 8000,
          output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SCHEMA } },
          fallbacks: 'default',
          system: AI_SYSTEM,
          messages: [{ role: 'user', content: 'Jedlá (jedno na riadok):\n' + lines.join('\n') }],
        }),
      });
    } catch (ex) {
      throw new AiError('Nedá sa spojiť s AI. Skontroluj internet.', 'net');
    }
    let data = null;
    try { data = await res.json(); } catch (ex) { /* prázdna odpoveď */ }
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || '';
      if (res.status === 401 || res.status === 403) throw new AiError('API kľúč nefunguje. Skontroluj, či je celý a platný.', 'key');
      if (/credit|balance|billing/i.test(msg)) throw new AiError('Na účte Anthropic nie je kredit. Dobi ho v platform.claude.com, časť Billing.', 'key');
      if (res.status === 429 || res.status >= 500) throw new AiError('AI je teraz zaneprázdnená. Skúsi sa to neskôr.', 'busy');
      throw new AiError('AI odmietla požiadavku (' + res.status + (msg ? ': ' + msg : '') + ').', 'other');
    }
    if (!data || data.stop_reason === 'refusal') return [];
    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    try {
      const out = JSON.parse(txt);
      return Array.isArray(out.dishes) ? out.dishes : [];
    } catch (ex) {
      return [];
    }
  }

  // Ktoré jedlo má zmysel poslať: nie je rozpísané v Moje jedlá, ešte nebolo v AI, nie je to jedna jasná surovina
  function aiCandidate(desc) {
    const d = String(desc || '').trim();
    if (d.length < 3) return false;
    if (aiSeen().includes(aiKeyOf(d))) return false;
    if (Analysis.recipeOf(d).length) return false;
    const words = d.split(/\s+/).filter(Boolean);
    if (words.length < 2 && Analysis.detectTags(d).length) return false;   // napr. „banán“, „jogurt“
    return true;
  }

  // Uloží len jedlá, ktoré niečo prezradia: suroviny majú skupinu, ktorú samotný názov nemá
  function aiUseful(name, ingredients) {
    const own = new Set(Analysis.detectTags(name));
    return Analysis.detectTags(ingredients.join(', ')).some(t => !own.has(t));
  }

  let aiBusy = false;
  async function aiRun(descs, opt) {
    opt = opt || {};
    if (!aiOn() || aiBusy || !descs.length) return { added: [], error: null };
    if (navigator.onLine === false) return { added: [], error: null };
    aiBusy = true;
    const added = [];
    let error = null;
    try {
      for (let i = 0; i < descs.length; i += AI_BATCH) {
        const batch = descs.slice(i, i + AI_BATCH);
        let dishes;
        try {
          dishes = await aiAsk(batch, meta.aiKey);
        } catch (ex) {
          error = ex;
          break;
        }
        const texts = batch.map(d => Analysis.norm(d.toLowerCase()));
        const list = recipes().slice();
        for (const x of dishes) {
          const name = String(x.name || '').trim().toLowerCase();
          const ing = (x.ingredients || []).map(s => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 12);
          if (name.length < 3 || !ing.length) continue;
          const n = Analysis.norm(name);
          if (!texts.some(t => t.includes(n))) continue;   // názov musí byť naozaj v texte, inak by sa nikdy nespároval
          if (list.some(r => Analysis.norm(r.name.toLowerCase()) === n)) continue;
          if (!aiUseful(name, ing)) continue;
          const r = { name, ingredients: ing.join(', '), ai: true };
          list.push(r);
          added.push(r);
        }
        await setMeta('recipes', list);
        await setMeta('aiSeen', aiSeen().concat(batch.map(aiKeyOf)).slice(-3000));
        Analysis.setRecipes(recipes());
      }
    } finally {
      aiBusy = false;
    }
    if (error && error.kind === 'key') await setMeta('aiErr', error.message);
    else if (!error) await setMeta('aiErr', '');
    if (added.length && !opt.quiet) render();
    return { added, error };
  }

  // Nerozpísané jedlá z denníka, najčastejšie ako prvé
  function aiPending(limit) {
    const cnt = new Map();
    for (const e of entries) {
      if (e.type !== 'food' || isCoffee(e)) continue;
      const d = String(e.desc || '').trim();
      const k = aiKeyOf(d);
      if (!cnt.has(k)) { if (!aiCandidate(d)) continue; cnt.set(k, { d, n: 0 }); }
      cnt.get(k).n++;
    }
    return [...cnt.values()].sort((a, b) => b.n - a.n).slice(0, limit || AI_MAX_RUN).map(x => x.d);
  }

  // Po uložení jedla: rozpíše ho na pozadí a povie, čo našla
  async function aiAfterSave(e) {
    if (!aiOn() || e.type !== 'food' || isCoffee(e) || !aiCandidate(e.desc)) return;
    const { added, error } = await aiRun([e.desc.trim()]);
    if (added.length) {
      toast(added.map(r => cap(r.name) + ': ' + r.ingredients).join(' · '), { label: 'Upraviť', run: () => openInfo('recipes') });
    } else if (error && error.kind === 'key') {
      toast(error.message, { label: 'Nastaviť', run: () => openAi() });
    }
  }

  // Pri spustení apky doplní jedlá, ktoré sa nerozpísali (napr. bez internetu)
  function aiCatchUp() {
    if (!aiOn() || meta.aiErr) return;
    const list = aiPending();
    if (list.length) aiRun(list, { quiet: false }).catch(() => {});
  }

  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  function openAi(note) {
    const nAi = recipes().filter(r => r.ai).length;
    const pending = meta.aiKey ? aiPending().length : 0;
    const has = !!meta.aiKey;
    const body = grp('', `<p class="small muted" style="margin:0">AI (Claude od firmy Anthropic) rozpíše jedlo na suroviny, aj tie skryté. Napríklad „segedín“ na bravčové mäso, kyslú kapustu, smotanu a cibuľu. Vyhodnotenie potom vidí aj mlieko či cibuľu v hotových jedlách.</p>`) +
      grp('Čo sa posiela', `<p class="small muted" style="margin:0"><b>Iba text jedla</b>, napríklad „segedín s knedľou“. Nikdy nie ťažkosti, stolica, lieky ani dátumy. Každé jedlo sa pošle len raz, potom sa pamätá v „Moje jedlá“ a dá sa tam upraviť alebo zmazať.</p>`) +
      grp('API kľúč', `<input type="password" id="ai-key" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${has ? 'Kľúč je uložený (••••' + esc(meta.aiKey.slice(-4)) + ')' : 'sk-ant-…'}">
        <p class="tiny" style="margin:8px 0 0">Kľúč ostáva len v tomto telefóne a nie je v zálohe.</p>
        ${sw('ai-on', 'Rozpisovať jedlá automaticky', meta.aiOn !== false)}
        <button type="button" class="btn block" style="margin-top:10px" data-act="ai-save">Uložiť a vyskúšať</button>
        ${has ? `<button type="button" class="btn ghost block" style="margin-top:8px" data-act="ai-del">Zmazať kľúč</button>` : ''}
        ${note ? `<p class="small" style="margin:10px 0 0">${note}</p>` : ''}
        ${meta.aiErr ? `<p class="small" style="margin:10px 0 0;color:var(--danger)">${esc(meta.aiErr)}</p>` : ''}`) +
      (has ? grp('Stav', `<p class="small muted" style="margin:0">Rozpísaných jedál cez AI: <b>${nAi}</b>${pending ? `<br>Čaká na rozpísanie: <b>${pending}</b>` : ''}</p>
        ${pending && aiOn() ? `<button type="button" class="btn block" style="margin-top:10px" data-act="ai-run">Rozpísať teraz</button>` : ''}`) : '') +
      grp('Ako získať kľúč', `<ol class="steps small"><li>Otvor <b>platform.claude.com</b> a prihlás sa (môže to byť rovnaký e-mail ako do Claude).</li>
        <li>V časti <b>Billing</b> si dobi kredit, stačí najmenšia suma. Predplatné Claude Pro ho neobsahuje, Max áno.</li>
        <li>V časti <b>API keys</b> ťukni na <b>Create key</b> a kľúč skopíruj.</li><li>Vlož ho sem a ťukni na Uložiť a vyskúšať.</li></ol>
        <p class="tiny" style="margin:8px 0 0">Jedno jedlo stojí zhruba pol centa. Pri bežnom používaní to vychádza na jednotky eur ročne. Firma Anthropic údaje z API nepoužíva na trénovanie.</p>`);
    $('#mini-sheet').innerHTML = `<div class="sheet-head"><h2>Rozpis jedál cez AI</h2><button type="button" class="x" data-act="mini-close" aria-label="Zavrieť">✕</button></div>${body}
      <div class="savebar"><button type="button" class="btn primary" data-act="mini-close">Hotovo</button></div>`;
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

  async function aiSave(btn) {
    const k = ($('#ai-key').value || '').trim();
    const on = $('#ai-on').checked;
    if (k) {
      if (!/^sk-ant-/.test(k)) { toast('Kľúč začína na sk-ant-'); return; }
      await setMeta('aiKey', k);
    }
    await setMeta('aiOn', on);
    if (!meta.aiKey) { toast('Vlož API kľúč'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Skúšam…'; }
    try {
      const dishes = await aiAsk(['segedín s knedľou'], meta.aiKey);
      await setMeta('aiErr', '');
      const s = dishes.find(d => /seged/.test(d.name)) || dishes[0];
      openAi(s ? '✓ Funguje. Skúška: <b>' + esc(cap(s.name)) + '</b> = ' + esc(s.ingredients.join(', ')) : '✓ Spojenie funguje.');
      if (on) aiCatchUp();
    } catch (ex) {
      await setMeta('aiErr', ex.message);
      openAi();
    }
  }
