const CACHE = "masonry-review-v2";
const FILES = [
  "./", "./index.html", "./styles.css", "./app.js", "./questions.js",
  "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  "./images/calc16.png", "./images/calc17.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 网络优先：在线时始终拉取最新文件；离线时回退到缓存（保证可用）
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 只处理同源资源

  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const cp = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cp));
        return resp;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./")))
  );
});
