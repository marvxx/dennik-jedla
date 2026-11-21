  // ---------- Úvod pri prvom spustení ----------
  // Tri krátke obrazovky. Ukáže sa raz, potom už len z Pomocníka („Úvod znova“).
  let welcomeStep = 0;
  function welcomeHtml() {
    const risk = riskTags();
    const steps = [
      `<div class="wl-ico">${ic('food')}</div><h2>Vitaj v Denníku jedla</h2>
        <p>Zapisuješ, čo ješ a kedy ťa trápi brucho. Denník potom sám hľadá, po čom sú ťažkosti častejšie a po čom je pokoj.</p>
        <p class="muted">Všetko ostáva len v tomto telefóne. Nič sa nikam neposiela.</p>`,
      `<div class="wl-ico">${ic('check')}</div><h2>Čo zapisovať</h2>
        <ul class="why wl-list"><li><b>Jedlo a pitie</b> tlačidlom ＋ dole, čo najskôr po jedle.</li>
          <li><b>Ťažkosti</b> hneď, keď prídu. Stačí ťuknúť na číslo 1 až 10 na obrazovke Dnes.</li>
          <li><b>Večer „Deň bez ťažkostí“</b>, ak nebolo nič. Je to rovnako dôležité.</li></ul>
        <p class="muted">Prvé výsledky budú asi po dvoch týždňoch. Ak niečomu nerozumieš, ťukni na ? pri nadpise.</p>`,
      `<div class="wl-ico">${ic('warn')}</div><h2>Vieš, čo ti vadí?</h2>
        <p>Označ, čo už tušíš. Denník na to upozorní pri zápise a bude to sledovať podrobnejšie.</p>
        <div class="chips">${TAGS.filter(x => !x[0].startsWith('c_')).map(([v, e, t]) => `<button type="button" class="chip${risk.includes(v) ? ' on' : ''}" data-intol="${v}">${esc(t)}</button>`).join('')}</div>
        <p class="muted">Nevieš? Nevadí, nastavíš to neskôr v Nastaveniach.</p>`,
    ];
    const last = welcomeStep === steps.length - 1;
    return `<div class="welcome">${steps[welcomeStep]}</div>
      <div class="wl-dots">${steps.map((_, i) => `<i class="${i === welcomeStep ? 'on' : ''}"></i>`).join('')}</div>
      <div class="savebar">${last ? '' : '<button type="button" class="btn" data-act="wl-done">Preskočiť</button>'}
        <button type="button" class="btn primary" data-act="${last ? 'wl-done' : 'wl-next'}">${last ? 'Začať' : 'Ďalej'}</button></div>`;
  }
  function openWelcome() {
    welcomeStep = 0;
    // ukáže sa len raz, aj keď ho používateľ zavrie potiahnutím
    if (!meta.onboarded) setMeta('onboarded', true).catch(() => {});
    $('#mini-sheet').innerHTML = welcomeHtml();
    if (openSheets.includes('help-sheet')) closeSheet('help-sheet');
    if (!openSheets.includes('mini-sheet')) openSheet('mini-sheet');
  }

  // ---------- Pomocník ----------
  // Vysvetlenie každej časti aplikácie; hľadá sa podľa názvu, ktorý používateľ vidí na obrazovke.
  const HELP_SECS = [['today', 'Dnes'], ['entry', 'Zápis (tlačidlo ＋)'], ['list', 'Kalendár'], ['insights', 'Súvislosti'], ['mine', 'Súvislosti – Moje'], ['settings', 'Nastavenia']];
  const HELP = [
    ['today', 'Pásik dní', 'Posledné týždne. Ťuknutím otvoríš deň. Bodka pod dňom: zelená = bez ťažkostí, žltá, oranžová, červená = slabé, stredné, silné ťažkosti, sivá = niečo zapísané, ale nevieme, či boli ťažkosti.'],
    ['today', 'Stuha dňa', 'Celý deň na jednej čiare. Zelené čiarky hore sú jedlá, farebné krúžky dole ťažkosti (väčší = silnejšie). Prerušovaná čiara je teraz. Deň trvá od 4:00 do 4:00, takže neskorá večera patrí k správnemu dňu.'],
    ['today', 'Rizikové suroviny v tento deň', 'Koľkokrát si v ten deň zjedla niečo z tvojich intolerancií (nastavuješ ich v Nastaveniach).'],
    ['today', 'Máš teraz ťažkosti?', 'Najrýchlejší zápis: ťukni na číslo 1 až 10 a ťažkosti sú zapísané s aktuálnym časom. Druh a miesto môžeš doplniť cez „Doplniť“ v ozname.'],
    ['today', 'Chýba obed? (raňajky, večera)', 'Ak v dni so záznamami chýba bežné jedlo, denník sa spýta. Ťuknutím ho zapíšeš s typickým časom, ktorý môžeš zmeniť. Ak si naozaj nejedla, nič nerob.'],
    ['today', 'Pravidelné', 'Veci, ktoré si nastavila na každý deň (napr. ranná káva, probiotiká). Keď sa blíži ich čas, zapíšeš ich jedným ťuknutím.'],
    ['today', 'Voda a káva', 'Jeden dielik vody je pohár, asi 0,25 l. Cieľ je 6 dielikov, teda 1,5 l. Ťuknutím na ＋ pridáš pohár vody alebo zapíšeš kávu (takú, akú piješ najčastejšie) s aktuálnym časom. Menej ako 5 pohárov (1,25 l) za deň sa vo vyhodnotení ráta ako málo pitia. Kávu môžeš upraviť ako každý iný záznam.'],
    ['today', 'Aký bol dnešný deň?', 'Spánok, menštruácia a pohyb raz za deň (pitie sa počíta v karte Voda a káva). Nepovinné, ale pomáha zistiť, či ťažkosti nesúvisia s dňom, nielen s jedlom.'],
    ['today', 'Na obed ti sedelo (čo si dať)', 'Pred raňajkami, obedom a večerou ukáže jedlá, ktoré si v túto dennú dobu jedla aspoň 2× a nemala si po nich ťažkosti. Jedlá s tvojimi intoleranciami sa nenavrhujú. Ťuknutím jedlo zapíšeš.'],
    ['today', 'Deň bez ťažkostí', 'Ťukni večer, ak v ten deň nebolo nič. Je to rovnako dôležité ako zapisovať ťažkosti: bez toho denník nevie, či bol deň pokojný, alebo si len nezapisovala.'],
    ['today', 'Tvoj týždeň', 'V nedeľu večer až v utorok zhrnutie týždňa: koľko dní bolo s ťažkosťami v porovnaní s minulým týždňom a jedna rada. Krížikom ho skryješ.'],
    ['today', 'Zavádzanie (pruh hore)', 'Prebieha opätovné zavedenie: každý deň ti povie, akú porciu zjesť. Po zjedení ťukni „Zjedla som“ a sleduj ťažkosti. Viac v časti Súvislosti – Moje.'],
    ['entry', 'Typ záznamu', 'Hore prepínaš Jedlo, Ťažkosti, Stolica a Lieky. Napísaný text sa pri prepnutí nestratí.'],
    ['entry', 'Ako včera', 'Čo si včera zapísala v podobnom čase. Jedným ťuknutím to isté dnes.'],
    ['entry', 'Naposledy jedené', 'Časté jedlá, ráno najmä raňajky, na obed obedy. Ťuknutím na viac položiek sa pridajú za seba, druhým ťuknutím položku odoberieš. Hviezdička vedľa názvu uloží jedlo medzi obľúbené.'],
    ['entry', 'Kedy?', '„teraz“, „–30 min“ a ďalšie posunú čas. Iný dátum a čas nastavíš v políčkach pod tým.'],
    ['entry', 'Koľko?', 'Veľkosť porcie. Pri intoleranciách často rozhoduje množstvo, preto sa veľká porcia ráta viac a malá menej.'],
    ['entry', 'Obsahovalo (skupiny potravín)', 'Skupiny ako mliečne, lepok, cibuľa a cesnak. Značka ✦ znamená, že ich denník rozpoznal z popisu sám. Ťuknutím skupinu zrušíš alebo pridáš.'],
    ['entry', 'Laktáza / enzým', 'Zapni, ak si k jedlu vzala tabletku laktázy alebo iný enzým. Vyhodnotenie potom ukáže, či pomáha.'],
    ['entry', 'Jedla som v zhone', 'Jedenie v rýchlosti niekedy samo zhorší trávenie. Denník to porovná.'],
    ['entry', 'Odkiaľ je jedlo?', 'Kto jedlo pripravil: uvarené doma, reštaurácia alebo jedáleň, u niekoho na návšteve, alebo kúpené hotové v obchode či bufete. Ukáže, či vadí skôr jedlo, ktoré nie je z domu (iné suroviny, viac tuku, skryté zloženie).'],
    ['entry', 'Opakovať každý deň', 'Pri jedle alebo lieku, ktoré berieš denne. Na obrazovke Dnes sa potom ukáže na zápis jedným ťuknutím.'],
    ['entry', 'Stres, nálada, poznámka', 'Nepovinné. Stres a nálada pri jedle môžu ovplyvniť trávenie.'],
    ['entry', 'Aké silné? (ťažkosti)', '1 je slabé, 10 neznesiteľné. Farba sa mení od zelenej po červenú.'],
    ['entry', 'Stolica: Bristolská škála', 'Škála, ktorú používajú lekári: 1–2 zápcha, 3–4 v poriadku, 5–7 riedka.'],
    ['entry', 'Skenovanie čiarového kódu', 'Pri balených výrobkoch načíta názov a zloženie z databázy Open Food Facts. Posiela sa tam len číslo kódu.'],
    ['entry', 'Zapísať znova teraz', 'Pri úprave jedla alebo lieku: zapíše to isté s dnešným časom.'],
    ['list', 'Farby v kalendári', 'Zelená = deň bez ťažkostí, žltá, oranžová, červená = slabé, stredné, silné ťažkosti, sivá = zapísané, ale nevieme o ťažkostiach. Ružová bodka = menštruácia.'],
    ['list', 'Filter dní', 'Nad zoznamom dní: zobrazí len dni s ťažkosťami, bez ťažkostí, so stolicou alebo s liekmi. Číslo pri filtri je počet takých dní.'],
    ['list', 'Hľadať v denníku', 'Napíš jedlo alebo slovo (aj skupinu, napr. mliečne). Ukážu sa všetky záznamy, kde sa vyskytuje, a v kalendári sa tie dni zvýraznia krúžkom. Pod kalendárom uvidíš, v koľkých z týchto dní boli ťažkosti v porovnaní s ostatnými dňami.'],
    ['insights', 'Hlavné podozrenie', 'Jedlo alebo skupina, ktorá najviac vyzerá, že súvisí s ťažkosťami. Spája všetky výpočty dokopy (po jedle, za deň, na druhý deň, najhoršie dni), aby si výsledky neodporovali.'],
    ['insights', 'Číslo 2,1× (koľkokrát)', '2× znamená, že po tomto jedle prišli ťažkosti dvakrát častejšie ako po ostatných. „Výrazne“ znamená, že inak sa ťažkosti v sledovanom čase neobjavili vôbec.'],
    ['insights', 'Bodky: málo údajov, náznak, silnejší vzorec', 'Koľko údajov je za číslom. Jedna bodka je málo, tri sú silnejší vzorec. Pri jednej bodke ešte nič neuzatváraj.'],
    ['insights', 'Podrobnosti podozrivého', 'Všetky výpočty k jednému jedlu, graf za koľko hodín po jedle prišli ťažkosti a zoznam konkrétnych jedál. Ťuknutím na jedlo otvoríš ten deň.'],
    ['insights', 'Za koľko po jedle prišli ťažkosti', 'Červené pruhy: po tomto jedle. Sivé: po ostatných jedlách. Ak sú ťažkosti po jedle častejšie v istom čase (napr. 1–2 h), je to silnejšia stopa.'],
    ['insights', 'Ďalšie podozrenia', 'Ďalšie jedlá a okolnosti, ktoré vyzerajú podozrivo, ale slabšie.'],
    ['insights', 'Najlepšie znášané', 'Jedlá, po ktorých ťažkosti prichádzajú zriedkavo.'],
    ['insights', 'Zatiaľ málo údajov', 'Jedlá, ktoré ešte neboli zjedené dosť často (štandardne 5×). Vyhodnotia sa, keď údaje pribudnú.'],
    ['insights', 'Všetky výpočty', 'Pôvodné podrobné tabuľky: jedlá, skupiny, rizikové jedlo, hromadenie, na druhý deň.'],
    ['insights', 'Skupiny a okolnosti jedla', 'Skupiny potravín (mliečne, lepok…) a okolnosti: jedlo po 20:00, po dlhej pauze, káva ako prvé za deň, v zhone, odkiaľ je jedlo.'],
    ['insights', 'Rizikové jedlo – kedy vadí viac', 'Porovnáva len jedlá s tvojimi intoleranciami: vadia viac, keď nie sú z domu, pri strese, počas menštruácie, po zlom spánku? A pomáha enzým?'],
    ['insights', 'Hromadenie', 'Vadí, keď sa tá istá skupina za 12 hodín zje viackrát?'],
    ['insights', 'Na druhý deň (12–48 h)', 'Niektoré intolerancie sa prejavia až neskôr. Tu sú jedlá, po ktorých prišli ťažkosti o 12 až 48 hodín.'],
    ['insights', 'Dávka za deň', 'Porovnáva dni, keď sa skupina nazbierala (2 a viac porcií), s ostatnými. Ak vadí až väčšie množstvo, ukáže sa to tu, aj keď jedno jedlo samo nevadí.'],
    ['insights', 'Je to lepšie?', 'Graf v časti Dni: koľko dní v každom týždni boli ťažkosti (zo 7). Farba stĺpca je priemerná sila. Čísla v krúžkoch pod grafom sú udalosti (začiatok testu, zavádzania, zistenia), aby bolo vidieť, čo sa po nich zmenilo. Pod grafom porovnanie posledných 4 týždňov s predošlými.'],
    ['insights', 'Lieky a doplnky', 'V časti Dni: pri lieku, ktorý užívaš pravidelne (napr. probiotiká), porovná dni s ťažkosťami pred začatím a odvtedy. Pri lieku, ktorý berieš pri ťažkostiach, ukáže, či potom prišli do 4 h ďalšie ťažkosti. Lieky sa berú často práve pri ťažkostiach, preto „viac“ neznamená, že škodia.'],
    ['insights', 'Čo vyhodnotiť (zameranie)', 'Riadok nad výsledkami. „Všetky“ hodnotí všetky ťažkosti spolu. Vyber jeden druh (napr. pálenie záhy) a uvidíš, po čom prichádza práve on: rôzne ťažkosti mávajú rôzne príčiny. „Riedka stolica“ a „tvrdá stolica“ hľadajú, po čom prichádza taká stolica o 6 až 36 hodín. Zobrazí sa len to, čo máš zapísané aspoň 3×.'],
    ['insights', 'Okolnosti dňa', 'Dni so zlým spánkom, menštruáciou, bez pohybu, s málo pitia, a fázy cyklu: dni pred menštruáciou (luteálna fáza) a po nej (folikulárna).'],
    ['insights', 'Najhoršie a najlepšie dni', 'Čo sa jedlo len v najhorších dňoch a čo len v najlepších. „Bolo v oboch“ zvyčajne nerozhoduje, pokiaľ nevadí až väčšie množstvo.'],
    ['mine', 'Moje zistenia', 'Tvoj vlastný zoznam: čo vadí, čo nevadí a čo je podozrivé. Zapíšeš ho z výsledkov tlačidlom „Zapísať zistenie“ alebo ručne.'],
    ['mine', 'Test podozrivého (vynechanie)', 'Čísla ukážu len podozrenie. Istotu dá test: jednu vec na 7 až 21 dní vynechať a porovnať dni s ťažkosťami pred testom a počas neho. Vždy len jednu vec naraz.'],
    ['mine', 'Opätovné zavedenie', 'Keď bolo bez niečoho lepšie, vráti sa to späť: 3 dni po sebe malá, bežná a väčšia porcia. Denník sleduje ťažkosti 24 h po každej dávke a povie, či to vadí a od akého množstva. Pri alergii to nerob.'],
    ['mine', 'Prehľad pre lekára', 'Zhrnutie posledných 30 dní na jednu stranu: graf ťažkostí, stolica, podozrenia, zistenia a lieky. Dá sa vytlačiť, uložiť ako PDF alebo poslať ako text.'],
    ['mine', 'Nastavenie výpočtu', 'Za koľko hodín po jedle sa ťažkosti priradia k jedlu (štandardne 0–6 h) a koľkokrát treba jedlo zjesť, kým sa vyhodnotí (štandardne 5×).'],
    ['settings', 'Moje intolerancie', 'Suroviny, o ktorých vieš, že ti vadia. Denník na ne upozorní pri zápise a vo výsledkoch ich sleduje podrobnejšie.'],
    ['settings', 'Moje jedlá', 'Jedlo, ktoré často varíš, rozpíšeš na suroviny (napr. mamine halušky = halušky, bryndza, slanina). Keď ho potom zapíšeš len názvom, suroviny sa zarátajú.'],
    ['settings', 'Pravidelné záznamy', 'Zoznam vecí, ktoré sa opakujú každý deň. Tu ich môžeš zrušiť.'],
    ['settings', 'Záloha', 'Údaje sú len v tomto telefóne. Raz týždenne ulož zálohu (napr. do Súborov alebo na iCloud). Ak telefón stratíš alebo vymažeš údaje Safari, bez zálohy sú preč.'],
    ['settings', 'Všetky záznamy do tabuľky', 'Súbor CSV pre Excel alebo Numbers, napríklad pre lekára alebo výživového poradcu.'],
    ['settings', 'Pripomienky', 'Aplikácia na webe sama upozorniť nevie. Pripomienky preto pridá do Kalendára v iPhone a upozornenie pošle Kalendár.'],
    ['settings', 'Skratky a Siri', 'Zápis jedným ťuknutím z plochy (Android: podrž ikonu) alebo cez aplikáciu Skratky na iPhone.'],
  ];
  const normH = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // ďalšie slová, pod ktorými sa téma dá nájsť
  const HELP_KEYS = {
    'Voda a káva': 'voda pitie piť pohár liter dielik tekutiny kofeín',
    'Okolnosti dňa': 'voda pitie málo pitia spánok menštruácia pohyb cyklus',
    'Aký bol dnešný deň?': 'spánok menštruácia pohyb šport',
    'Máš teraz ťažkosti?': 'bolesť brucho rýchly zápis sila',
    'Laktáza / enzým': 'tabletka mlieko mliečne laktóza',
    'Obsahovalo (skupiny potravín)': 'mliečne lepok laktóza cibuľa cesnak štítky',
    'Moje intolerancie': 'alergia laktóza lepok mliečne vadí',
    'Záloha': 'zálohovať obnoviť icloud súbory stratiť telefón',
    'Pripomienky': 'upozornenie notifikácia pripomenúť kalendár zabudnúť',
    'Pravidelné': 'každý deň opakovať lieky probiotiká káva',
    'Hľadať v denníku': 'vyhľadať nájsť hľadanie',
    'Filter dní': 'filtrovať zoznam stolica lieky ťažkosti',
    'Na obed ti sedelo (čo si dať)': 'čo jesť návrh nápad bezpečné jedlo raňajky večera',
    'Prehľad pre lekára': 'lekár doktor vizita pdf tlač',
    'Lieky a doplnky': 'tabletky probiotiká vitamíny',
    'Stolica: Bristolská škála': 'hnačka zápcha riedka tvrdá',
    'Skenovanie čiarového kódu': 'čiarový kód obal výrobok skener',
  };
  // zhoda aj v inom tvare: „voda“ nájde „vody“, „pitie“ nájde „pitia“
  function helpHit(words, q) {
    return q.length > 0 && q.every(w => words.some(x => {
      if (x.startsWith(w)) return true;
      if (w.length < 4) return false;
      let i = 0;
      while (i < w.length && x[i] === w[i]) i++;
      return i >= Math.max(3, w.length - 2);
    }));
  }

  function openHelp(sec) {
    const secs = HELP_SECS.map(([k, l]) => {
      const items = HELP.filter(x => x[0] === k);
      return `<section class="help-sec" data-hs="${k}"><h3>${l}</h3>` + items.map(([, t, txt]) =>
        `<details class="help-item" data-ht="${esc(normH(t + ' ' + txt + ' ' + (HELP_KEYS[t] || '')))}"${sec && k === sec ? '' : ''}><summary>${esc(t)}</summary><p>${esc(txt)}</p></details>`).join('') + '</section>';
    }).join('');
    $('#help-sheet').innerHTML = `<div class="sheet-head"><h2>Pomocník</h2><button type="button" class="x" data-act="help-close" aria-label="Zavrieť">✕</button></div>
      <input type="search" id="help-q" placeholder="Hľadať, napr. voda, bodky, záloha" enterkeyhint="search">
      <div class="help-tabs">${HELP_SECS.map(([k, l]) => `<button type="button" class="chip${k === sec ? ' on' : ''}" data-hsec="${k}">${l.replace(' (tlačidlo ＋)', '')}</button>`).join('')}</div>
      <div id="help-list">${secs}</div><p class="help-none" hidden>Nič sa nenašlo. Skús iné slovo.</p>
      <div class="savebar"><button type="button" class="btn" data-act="welcome">Úvod znova</button><button type="button" class="btn primary" data-act="help-close">Hotovo</button></div>`;
    openSheet('help-sheet');
    if (sec) jumpHelp(sec);
  }
  function jumpHelp(sec) {
    $$('[data-hsec]').forEach(c => c.classList.toggle('on', c.dataset.hsec === sec));
    const el = $(`.help-sec[data-hs="${sec}"]`);
    if (el) $('#help-sheet').scrollTop = el.offsetTop - 140;
  }
  function filterHelp(q) {
    const n = normH(q.trim());
    const qw = n.split(/[^a-z0-9]+/).filter(Boolean);
    let any = false;
    $$('.help-item').forEach(d => {
      const hit = !n || d.dataset.ht.includes(n) || helpHit(d.dataset.ht.split(/[^a-z0-9]+/), qw);
      d.hidden = !hit;
      if (n && hit) d.open = true;
      if (!n) d.open = false;
      any = any || hit;
    });
    $$('.help-sec').forEach(s => { s.hidden = ![...s.querySelectorAll('.help-item')].some(d => !d.hidden); });
    $('.help-none').hidden = any;
  }

