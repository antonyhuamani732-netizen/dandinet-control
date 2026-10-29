// Service worker: guarda la app para que funcione sin internet.
// Sube VERSION cada vez que publiques cambios para que los celulares se actualicen.
const VERSION = 'metrado-v1';
const ARCHIVOS = [
  './', './index.html', './styles.css', './app.js', './storage.js', './manifest.webmanifest',
  './data/capeco.js',
  './calc/index.js', './calc/util.js', './calc/concreto.js', './calc/acero.js',
  './calc/encofrado.js', './calc/muros.js', './calc/rendimiento.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la caché; si no está, red (y guarda las fuentes de Google para usarlas offline).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      const url = new URL(e.request.url);
      if (res.ok && (url.origin === location.origin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com'))) {
        const copia = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
      }
      return res;
    })),
  );
});
