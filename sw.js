const CACHE = "iphone18pro-guide-v2";
const IDS = ["sunrise","blue-sky","overcast","sunset","milky-way","moon","city-night","car-trails","silky-water","water-splash","starburst","backlight","dark","portrait","env-portrait","tilt-shift","japanese-fresh","mountain","seascape","fog","architecture","street","sports","food","macro","video-24p"];
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./guide.json",
  "./favicon.svg",
  "./manifest.webmanifest",
  ...IDS.map((id) => `./examples/${id}.jpg`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached),
    ),
  );
});
