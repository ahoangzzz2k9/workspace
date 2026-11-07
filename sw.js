/* Cùng Làm service worker — chỉ cache vỏ ứng dụng, không cache dữ liệu cá nhân. */
const VERSION = 'cunglam-v1';
const PRECACHE = [
  '/offline',
  '/static/style.css',
  '/static/app.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            /* một tài nguyên lỗi không được chặn cài đặt */
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return;

  // Điều hướng: ưu tiên mạng, mất mạng thì hiện trang offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match('/offline')) || Response.error();
        }
      })()
    );
    return;
  }

  // Tài nguyên tĩnh: trả cache trước, cập nhật ngầm.
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
