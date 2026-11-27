
'use strict';

/* =========================================
   TANDERSA - Progressive Web App
   Service Worker
   ========================================= */

const CACHE_PREFIX = 'tandersa-pwa-';
const CACHE_VERSION = 'v1';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

/* فایل‌های اصلی برنامه */
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

/* آیکون‌ها اختیاری هستند؛
   نبودن آن‌ها نباید نصب Service Worker را متوقف کند. */
const OPTIONAL_ASSETS = [
  './icon-192.png',
  './icon-512.png'
];

/* =========================================
   1. INSTALL
   ========================================= */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // ذخیره فایل‌های ضروری برنامه
      await cache.addAll(
        CORE_ASSETS.map(
          path => new URL(path, self.registration.scope).href
        )
      );

      // ذخیره آیکون‌ها در صورت موجود بودن
      await Promise.all(
        OPTIONAL_ASSETS.map(async (path) => {
          try {
            const url = new URL(
              path,
              self.registration.scope
            );

            const response = await fetch(url);

            if (response.ok) {
              await cache.put(url.href, response);
            }
          } catch (error) {
            console.info(
              'TANDERSA: Optional icon not available:',
              path
            );
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

/* =========================================
   2. ACTIVATE
   ========================================= */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      // حذف نسخه‌های قدیمی Cache تندرسا
      await Promise.all(
        cacheNames.map(async (name) => {
          if (
            name.startsWith(CACHE_PREFIX) &&
            name !== CACHE_NAME
          ) {
            await caches.delete(name);
          }
        })
      );

      await self.clients.claim();

      console.info('TANDERSA: Service Worker activated.');
    })()
  );
});

/* =========================================
   3. FETCH
   ========================================= */

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // فقط درخواست‌های GET
  if (request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(request.url);

  // فایل‌های خارجی وارد Cache نشوند
  if (requestURL.origin !== self.location.origin) {
    return;
  }

  /* -----------------------------------------
     درخواست صفحات HTML:
     ابتدا اینترنت، سپس نسخه Cache
     ----------------------------------------- */

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);

            await cache.put(
              request,
              response.clone()
            );
          }

          return response;

        } catch (error) {

          // نسخه ذخیره‌شده همان صفحه
          const cachedPage = await caches.match(request);

          if (cachedPage) {
            return cachedPage;
          }

          // صفحه اصلی برنامه
          const cachedRoot = await caches.match(
            new URL('./', self.registration.scope).href
          );

          if (cachedRoot) {
            return cachedRoot;
          }

          // فایل index.html
          const cachedIndex = await caches.match(
            new URL('./index.html', self.registration.scope).href
          );

          if (cachedIndex) {
            return cachedIndex;
          }

          return new Response(
            'برنامه تندرسا در حال حاضر در دسترس نیست. لطفاً یک بار به اینترنت متصل شوید.',
            {
              status: 503,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8'
              }
            }
          );
        }
      })()
    );

    return;
  }

  /* -----------------------------------------
     فایل‌های محلی:
     ابتدا Cache، سپس اینترنت
     ----------------------------------------- */

  event.respondWith(
    (async () => {

      const cachedResponse = await caches.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        // فقط پاسخ موفق و هم‌مبدأ ذخیره شود
        if (
          response &&
          response.ok &&
          response.type === 'basic' &&
          new URL(response.url).origin === self.location.origin
        ) {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            request,
            response.clone()
          );
        }

        return response;

      } catch (error) {
        return new Response(
          'این فایل در حالت آفلاین در دسترس نیست.',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          }
        );
      }
    })()
  );
});
