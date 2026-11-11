// Service worker: guarda la app para que funcione sin internet.
// Sube VERSION (y VERSION_APP en app.js) cada vez que publiques cambios.
const VERSION = 'metrado-v10';
const ARCHIVOS = [
  './', './index.html', './styles.css', './app.js', './storage.js', './manifest.webmanifest',
  './data/capeco.js', './data/elementos.js',
  './calc/index.js', './calc/util.js', './calc/concreto.js', './calc/acero.js',
  './calc/encofrado.js', './calc/muros.js', './calc/rendimiento.js',
  './calc/elemento.js', './calc/corte.js', './calc/obra.js', './calc/norma.js',
  './ui/figuras.js', './ui/estribos.js', './ui/guia.js', './ui/planilla.js', './ui/informe.js', './ui/pdf.js', './ui/iconos.js', './ui/calculadora.js', './ui/excel.js',
  './vendor/xlsx.mini.min.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

// Descarga sin pasar por la caché del navegador, para no guardar archivos viejos en la versión nueva.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Archivos de la app: primero la red (siempre lo último) y, sin conexión, la copia guardada.
// Fuentes de Google: primero la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const guardar = (res) => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
    return res;
  };
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(guardar)
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }
  if (url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then(guardar)));
  }
});
