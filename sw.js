// Alchemist's Ledger - service worker.
//
// What it does
//   * Keeps a copy of the page, its icons and its fonts on the device, so the
//     Ledger opens at once and works with no connection.
//   * Each time the page is opened it also asks the server for the latest copy
//     in the background. If that differs, the new copy is stored and the page
//     is told, so it can offer "Reload" - nobody stays on an old build.
// What it never touches
//   * Google sign-in and Google Drive requests, or anything that is not a plain
//     GET. Those always go straight to the network.
// This file does not need editing when a new build of the page is published.
const CACHE = 'ledger-v1';
const PAGE_KEY = new URL('__ledger-page', self.registration.scope).href;
const FONT = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

const SHELL = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Store the icons and manifest straight away; a missing one must not stop the install.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(f => c.add(new URL(f, self.registration.scope).href).catch(() => {})))));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ledger-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

async function tell(msg) {
  for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(msg);
}

// The page: answer from the stored copy at once, refresh it in the background.
async function page(request) {
  const cache = await caches.open(CACHE);
  const key = request.url.split(/[?#]/)[0];
  const stored = (await cache.match(key)) || null;
  const before = stored ? stored.clone() : null;      // copy now: the original's body is used up once it is sent to the page
  const refresh = (async () => {
    const fresh = await fetch(key, { cache: 'no-cache', credentials: 'same-origin' });
    if (!fresh.ok || !/html/.test(fresh.headers.get('content-type') || '')) return stored ? null : fresh;
    const changed = before ? (await before.text()) !== (await fresh.clone().text()) : false;
    await cache.put(key, fresh.clone());
    await cache.put(PAGE_KEY, fresh.clone());
    if (changed) tell({ type: 'ledger-update' });
    return fresh;
  })();
  if (stored) { refresh.catch(() => {}); return stored; }
  try {
    const fresh = await refresh;
    if (fresh && fresh.ok) return fresh;
    return (await cache.match(PAGE_KEY)) || fresh;      // e.g. the app's start address has no page of its own
  } catch (err) {
    return (await cache.match(PAGE_KEY)) || Response.error();
  }
}

// Icons, manifest and fonts: stored copy first, refreshed quietly.
async function asset(request) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(request);
  const refresh = fetch(request).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(request, r.clone()); return r; });
  if (stored) { refresh.catch(() => {}); return stored; }
  return refresh;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const inScope = url.origin === self.location.origin && req.url.startsWith(self.registration.scope);
  if (inScope && req.mode === 'navigate') return e.respondWith(page(req));
  if (inScope && /\.(png|webmanifest|ico|svg)$/.test(url.pathname)) return e.respondWith(asset(req));
  if (FONT.test(req.url)) return e.respondWith(asset(req));
  // everything else (Google sign-in, Drive, uploads): untouched
});
