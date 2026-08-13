/* Al Mustafa Academy — service worker
 * Strategy:
 *  - Hashed build assets (JS/CSS) and icons: cache-first (safe, content-addressed)
 *  - API + content requests: network-first with a short offline cache fallback
 *  - Navigations: network-first, falling back to cached shell for offline use
 */
// Bumped to v2 so already-installed apps refresh their shell, icon and content
// after the PWA update (the logo PNG icons replaced the placeholder SVG).
const CACHE = "almustafa-v2";
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {})
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

  // Never cache auth/admin/upload mutation endpoints
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
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

  // Navigations & page requests — network-first with offline shell fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
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
