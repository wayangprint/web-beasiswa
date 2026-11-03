/* Portal Beasiswa — Service Worker
   Aman untuk paywall: TIDAK PERNAH meng-cache halaman deck/sampel
   dan TIDAK PERNAH meng-cache request ke Supabase (auth/data member).
   Perbaikan v2 (3 Nov 2026): navigasi HANYA di-cache bila respons OK
   DAN bila URL-nya memang shell aplikasi (root/index.html) — halaman
   artikel dan halaman error tidak pernah lagi menimpa cache shell. */
const CACHE = 'portal-beasiswa-v2';
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
  // Hanya shell aplikasi yang di-cache, dan hanya bila responsnya OK —
  // halaman artikel / halaman error tidak boleh menimpa cache shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const shellBase = new URL('./', self.location).pathname;
          const isShell =
            res.ok &&
            (url.pathname === shellBase || url.pathname === shellBase + 'index.html');
          if (isShell) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
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
