// Emadco PWA Service Worker - Offline-First Engine
const CACHE_NAME = 'emadco-pwa-cache-v2';

// الأصول الثابتة الأساسية المطلوبة لتشغيل النظام بدون أي اتصال بالإنترنت
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/pwa-icon.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/logo-clean.png',
  '/saudi-riyal-symbol.svg',
  '/assets/index-DXj0RJXN.js',
  '/assets/index-CzAWPH_Z.css',
  '/assets/index.es-DproFY8e.js',
  '/assets/purify.es-DedTAGkB.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching offline ERP assets...');
      // حفظ الملفات مع التعامل مع أي ملف منفرد قد يتعثر حتى لا يفشل التخزين بالكامل
      await Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[SW] Warning caching ${asset}:`, err?.message || err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Removing outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // استثناء المسارات البرمجية للخادم المحلي ومزامنة البيانات الخارجية
  if (url.pathname.startsWith('/api') || url.hostname.includes('firestore') || url.hostname.includes('googleapis')) {
    return;
  }

  // للأصول الثابتة (JS, CSS, الصور, الخطوط): استراتيجية Cache-First مع التحديث في الخلفية
  const isStaticAsset = url.pathname.startsWith('/assets/') || 
                        url.pathname.endsWith('.js') || 
                        url.pathname.endsWith('.css') || 
                        url.pathname.endsWith('.svg') || 
                        url.pathname.endsWith('.png') || 
                        url.pathname.endsWith('.json');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // تحديث الكاش بالخلفية إن أمكن
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        }).catch(() => {
          // محاولة مطابقة بدون معلمات البحث
          return caches.match(url.pathname);
        });
      })
    );
    return;
  }

  // لصفحات التنقل والتوجيه (Navigation): Network-First مع استرجاع index.html أوفلاين
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return null;
      })
  );
});
