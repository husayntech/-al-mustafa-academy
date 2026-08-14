/* Al Mustafa Academy — service worker
 * Strategy:
 *  - Hashed build assets (JS/CSS) and icons: cache-first (safe, content-addressed)
 *  - API + content requests: network-first with a short offline cache fallback
 *  - Navigations: network-first, falling back to cached shell for offline use
 */
// v4: network requests run with cache:"no-store" so the browser HTTP cache can
// never hand back a stale index.html or stale content — every navigation and
// API call hits the server fresh (the SW cache is only an offline fallback).
const CACHE = "almustafa-v4";
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Fetch the shell with cache:"no-store" so a stale HTTP-cached index.html
      // can never be baked into the offline shell at install time.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) await cache.put(url, res);
          } catch {}
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  // Never cache auth/admin/upload mutation endpoints; always hit the network
  // with no-store so content reflects the latest admin edits.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() =>
        caches.match(request).then((r) => r || new Response("offline", { status: 503 }))
      )
    );
    return;
  }

  // Hashed build assets — cache-first for speed
  if (/\.(js|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        });
      })
    );
    return;
  }

  // Navigations & page requests — network-first (no HTTP cache) with offline shell fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  // Everything else — try network, then cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || new Response("offline", { status: 503 })))
  );
});
