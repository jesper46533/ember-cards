// Ember · 余温 Service Worker
// 目的：让这个纯前端抽牌桌能"添加到主屏幕"后离线可玩。
// 策略：
//   - install：预缓存应用外壳（首页 / manifest / 图标），让首次离线也能进得来。
//   - activate：清掉旧版本缓存，立刻接管页面。
//   - fetch：导航请求 network-first（拿最新 HTML，断网回缓存）；其他同源静态资源 cache-first + 后台回填。
// 全部只用相对路径，兼容部署到子路径（如 GitHub Pages 项目页）。

const VERSION = 'v1';
const CACHE = `ember-cards-${VERSION}`;

// 相对 sw.js 自身解析；sw.js 与 index.html 同目录，所以等价于应用根。
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(
      PRECACHE_URLS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res && res.ok) await cache.put(url, res);
        } catch {
          // 预缓存失败不阻塞安装，运行时再补。
        }
      })
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只管同源 GET；其余（POST、跨域、chrome-extension 等）放行给浏览器。
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航：网络优先，拿最新 HTML；断网回退到缓存里的首页。
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        // 顺手缓存根，作为离线兜底。
        cache.put('./', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (
          (await cache.match(req)) ||
          (await cache.match('./')) ||
          (await cache.match('./index.html')) ||
          Response.error()
        );
      }
    })());
    return;
  }

  // 其他同源 GET：cache-first，后台静默更新。
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) {
      fetch(req)
        .then((fresh) => {
          if (fresh && fresh.ok) cache.put(req, fresh.clone());
        })
        .catch(() => {});
      return cached;
    }
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});
