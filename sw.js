/* 电商作战室 Service Worker —— 离线缓存核心静态资源，使站点可「安装到手机桌面」并断网可用 */
const CACHE = 'ecom-warroom-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=1',
  './lib/core.js?v=1',
  './app.js?v=1',
  './modules/pipeline.js?v=1',
  './modules/selection.js?v=1',
  './modules/library.js?v=1',
  './modules/content.js?v=1',
  './modules/strategy.js?v=1',
  './modules/intel.js?v=1',
  './modules/image.js?v=1',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 仅缓存同源静态资源；跨域 API（如通义 DashScope 模型调用）直接走网络，不拦截
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
