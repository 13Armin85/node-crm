/* Public offline screen only. API data, documents, tokens and authenticated HTML are never cached. */
const CACHE = "crm-pwa-__CRM_BUILD_VERSION__";
const PUBLIC_FILES = ["/offline.html", "/pwa/icon-192.png"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          PUBLIC_FILES.map(
            (url) => new Request(url, { cache: "reload", credentials: "omit" }),
          ),
        ),
      ),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("crm-pwa-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    PUBLIC_FILES.includes(url.pathname)
  ) {
    event.respondWith(
      caches
        .match(url.pathname, { cacheName: CACHE })
        .then((cached) => cached || fetch(event.request)),
    );
    return;
  }
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    event.request.mode !== "navigate" ||
    !event.request.headers.get("accept")?.includes("text/html")
  )
    return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const offline = await caches.match("/offline.html", { cacheName: CACHE });
      return (
        offline ||
        new Response("You are offline. Reconnect and try again.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
