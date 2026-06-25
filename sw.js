const CACHE_NAME = "essay-exam-app-v11";
const SHARE_CACHE = "essay-shared-images-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME && key !== SHARE_CACHE)
        .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Android PWA share target: screenshot/gallery Share -> 2차답안
  if (event.request.method === "POST" && url.searchParams.has("share-target")) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const files = formData.getAll("images").filter((file) => file && file.size && file.type && file.type.startsWith("image/"));
        const cache = await caches.open(SHARE_CACHE);
        const urls = [];

        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          const shareUrl = `./shared-image-${Date.now()}-${i}`;
          await cache.put(shareUrl, new Response(file, { headers: { "Content-Type": file.type || "image/png" } }));
          urls.push(shareUrl);
        }

        await cache.put("./shared-images-index.json", new Response(JSON.stringify(urls), {
          headers: { "Content-Type": "application/json" }
        }));

        return Response.redirect("./?incomingShare=1&v=11", 303);
      } catch (err) {
        return Response.redirect("./?shareError=1&v=11", 303);
      }
    })());
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
