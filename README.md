# Denník jedla

Jednoduchá webová aplikácia (PWA) na sledovanie jedla a tráviacich ťažkostí.
Údaje sa ukladajú len v telefóne (IndexedDB), nič sa neodosiela na server.

Pri novej verzii zvýš číslo `CACHE` v `sw.js`.

Testy vyhodnotenia: `node --test tests/` (potrebuje Node 18 alebo novší).

## Úpravy kódu
Kód aplikácie je rozdelený v priečinku `src/` (podľa obrazoviek a funkcií). Súbor `app.js`, ktorý načítava stránka,
sa z nich skladá príkazom `node tools/build.js`. `app.js` neupravuj priamo; test `tests/build.test.js` upozorní,
ak sa zabudne poskladať.
