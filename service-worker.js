/**
 * service-worker.js — RupiBook PWA
 * Strategy: Cache-first for static assets, Network-first for API calls.
 */

const CACHE_NAME   = 'rupibook-v2';
const API_HOSTNAME = 'script.google.com';

const STATIC_ASSETS = [
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/storage.js',
  './js/api.js',
  './js/app.js',
  './js/dashboard.js',
  './js/analytics.js',
  './js/version.js',
  './appscript-source.txt',
  './docs/SETUP_GUIDE.md',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

/* ── Install: pre-cache static assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: route strategy ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for Apps Script API calls
  if (url.hostname === API_HOSTNAME) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for everything else (static assets)
  event.respondWith(cacheFirst(request));
});

/* ── Cache-first strategy ── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cleanResponse(cached);

  try {
    let response = await fetch(request);
    if (response.ok) {
      response = cleanResponse(response);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const cached = await caches.match('./index.html');
      if (cached) return cleanResponse(cached);
    }
    return new Response('Offline — check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/* ── Network-first strategy ── */
async function networkFirst(request) {
  try {
    let response = await fetch(request);
    return cleanResponse(response);
  } catch {
    // Return cached response if available
    const cached = await caches.match(request);
    if (cached) return cleanResponse(cached);
    return new Response(JSON.stringify({ status: 'error', message: 'You appear to be offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Safari Workaround: Rebuild redirected responses to strip the internal redirected flag.
 * Safari throws a "Response served by service worker has redirections" error if a response
 * was redirected during network load and served from the service worker.
 */
function cleanResponse(response) {
  if (!response) return response;
  if (response.redirected) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
  return response;
}
