/* Portal Beasiswa — Service Worker
   Aman untuk paywall: TIDAK PERNAH meng-cache halaman deck/sampel
   dan TIDAK PERNAH meng-cache request ke Supabase (auth/data member). */
const CACHE = 'portal-beasiswa-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (Supabase, font, CDN, dll): jangan disentuh sama sekali.
  if (url.origin !== self.location.origin) return;

  // Konten berbayar & sampel: jangan pernah di-cache.
  if (
    url.pathname.includes('/decks') ||
    url.pathname.includes('/decks-') ||
    url.pathname.includes('/sampel/') ||
    url.pathname.includes('deck-')
  ) {
    return;
  }

  // Navigasi halaman: network-first, fallback ke shell dari cache (offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset statis lain (ikon, gambar og, artikel): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
