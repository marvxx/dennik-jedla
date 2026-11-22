  // ---------- Štart ----------
  // Skratka z plochy alebo z aplikácie Skratky: ./?add=food otvorí rovno zápis
  function openFromLink() {
    let ty = null;
    try { ty = new URLSearchParams(location.search).get('add'); } catch (_) { /* nič */ }
    if (!ty || !TYPES[ty]) return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (_) { /* nič */ }
    openEntry();
    if (ty !== 'food') { draft = Object.assign(newDraft(ty), { ts: draft.ts, tsTouched: draft.tsTouched, tsCustom: draft.tsCustom }); renderForm(); }
  }
  const appLink = ty => location.origin + location.pathname + '?add=' + ty;

  async function start() {
    try {
      await load();
    } catch (ex) {
      console.error(ex);
      document.querySelector('main').innerHTML = '<div class="card empty"><div class="big"></div><p>Úložisko v tomto prehliadači nefunguje. Skús otvoriť stránku v Safari (nie v súkromnom režime).</p></div>';
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    switchView('today');
    if (!meta.onboarded && !entries.length && !location.search.includes('add=')) openWelcome();
    else openFromLink();
    setTimeout(aiCatchUp, 3000);   // nerozpísané jedlá (napr. zapísané bez internetu)
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // keď sa nainštaluje nová verzia, stránku raz obnovíme, aby sedeli všetky súbory
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !reloaded && !openSheets.length) { reloaded = true; location.reload(); }
      });
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
    }
  }

  // sprístupnené pre testovanie
  window.__dennik = { buildCsv, get entries() { return entries; }, reload: async () => { await load(); switchView(currentView); } };

  start();
