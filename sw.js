/* Service worker: aplikácia funguje aj bez internetu.
   Pri každej novej verzii zvýš číslo v CACHE. */
const CACHE = 'dennik-v4';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './analysis.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Najprv internet (vždy najnovšia verzia), bez internetu z uloženej kópie.
// Ak internet neodpovie do 3 s, použije sa uložená kópia.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // navigačnú požiadavku nemožno kopírovať s inými nastaveniami → posielame ju ako je
    const fresh = req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' });
    const network = fetch(fresh).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(r => setTimeout(r, 3000));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (err) { /* offline */ }
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || network;
  })());
});
