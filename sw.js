// MathStudio Service Worker
const CACHE_NAME = 'mathstudio-v1';
const ASSETS = [
  '/MathStudio.html',
  '/manifest.json',
  '/sw.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=STIX+Two+Text:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Source+Serif+4:wght@400;700&family=Noto+Serif:wght@400;700&family=EB+Garamond:wght@400;700&family=Crimson+Pro:wght@400;700&family=Libre+Baskerville:wght@400;700&display=swap'
];

// Cache assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache main assets, ignore external API calls that might fail
        const cacheableAssets = ASSETS.filter(url => !url.includes('generativelanguage') && !url.includes('anthropic'));
        return cache.addAll(cacheableAssets).catch(() => {
          // If some assets fail to cache, continue anyway
        });
      })
  );
  self.skipWaiting();
});

// Cleanup old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external API calls
  if (request.method !== 'GET' || 
      url.hostname.includes('anthropic') || 
      url.hostname.includes('generativelanguage') ||
      url.hostname.includes('googleapis')) {
    return;
  }

  // HTML pages: network first, fallback to cache
  if (request.destination === 'document' || request.url.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((response) => response || caches.match('/MathStudio.html'));
        })
    );
  } 
  // Assets: cache first, fallback to network
  else {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
            // Cache successful responses
            if (response && response.status === 200 && !url.hostname.includes('cdn')) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Return a fallback response for failed requests
          if (request.destination === 'image') {
            return new Response('', { status: 404 });
          }
        })
    );
  }
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
