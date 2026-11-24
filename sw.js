const CACHE_NAME = 'sym-v12.5';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/dark.css',
  '/js/firebase-config.js',
  '/js/utils.js',
  '/js/services/usuarios.js',
  '/js/services/carrito.js',
  '/js/services/productos.js',
  '/js/services/pedidos.js',
  '/js/services/mesas.js',
  '/js/services/config.js',
  '/js/views/login.js',
  '/js/views/cliente.js',
  '/js/views/checkout.js',
  '/js/views/tracker.js',
  '/js/views/cocina.js',
  '/js/views/cajero-mesas.js',
  '/js/views/cajero-pos.js',
  '/js/views/cajero.js',
  '/js/views/tv.js',
  '/js/views/admin-menu.js',
  '/js/views/admin-ventas.js',
  '/js/views/admin-mesas.js',
  '/js/views/admin-users.js',
  '/js/views/factura.js',
  '/js/views/admin.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/app.js',
  '/js/seed.js',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────
// Reglas:
//  1) Navegaciones (HTML): SIEMPRE de la red (network-first) y sin cachear.
//     Así la app arranca siempre con el HTML fresco y NUNCA se cachea la
//     página de aviso de ngrok ni un HTML de error (se servían para siempre).
//  2) /qr/* y /api/*: nunca se cachean (el QR debe codificar la URL vigente).
//  3) Estáticos (js/css/img): cache-first + revalidación en segundo plano,
//     cacheando sólo respuestas 200 + same-origin + content-type no-HTML.
function _esCacheable(res) {
  if (!res || res.status !== 200 || res.type !== 'basic') return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return false;   // corta avisos de ngrok / errores
  return true;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // firebase / gstatic / MP
  if (url.pathname.startsWith('/qr/')) return;       // QRs: siempre de la red
  if (url.pathname.startsWith('/api/')) return;      // APIs: nunca cacheadas

  // 1) Navegación → network-first sin cachear
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() =>
        caches.match('/index.html').then(c => c || caches.match('/'))
      )
    );
    return;
  }

  // 3) Estáticos → cache-first + revalidación
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Revalida en segundo plano (actualiza la copia para la próxima vez)
        fetch(req).then(res => {
          if (_esCacheable(res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (_esCacheable(res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
