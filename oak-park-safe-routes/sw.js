// Service worker: makes the app installable and lets it open without a
// connection. Pages and data always come from the network when it's
// reachable, so parents never see stale crime data or routes; the cache is
// only a fallback. Versioned static files (?v=...) never change, so they're
// served from the cache first.

const CACHE = "safe-routes-v1";
const SHELL = ["./", "manifest.webmanifest", "static/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

function isCacheFirst(url) {
  return (
    (url.origin === self.location.origin && url.pathname.includes("/static/") && url.searchParams.has("v")) ||
    url.hostname === "unpkg.com"
  );
}

function isNetworkFirst(url) {
  if (url.origin !== self.location.origin) return false;
  // Routes and address lookups are personal and change with every request.
  if (["/api/route", "/api/geocode", "/api/reverse"].includes(url.pathname)) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isCacheFirst(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          }),
      ),
    );
    return;
  }

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return request.mode === "navigate" ? caches.match("./") : Response.error();
          }),
        ),
    );
  }
});
