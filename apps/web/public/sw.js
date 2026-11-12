/* SkillVerse service worker tối giản: chỉ dự phòng ngoại tuyến cho điều hướng trang.
   Không cache API / dữ liệu người dùng; mọi request khác đi thẳng mạng. */
const VERSION = "sv-offline-1";
const OFFLINE_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0e1611"><title>Mất kết nối · SkillVerse</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;background:#0e1611;color:#f1eee4;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
h1{font-size:24px;margin:0}p{margin:0;color:#a9b5a6;max-width:28ch}button{min-height:52px;padding:0 24px;border:0;border-radius:16px;background:#e9a23b;color:#1a1406;font:700 15px system-ui,sans-serif;cursor:pointer}
button:focus-visible{outline:2px solid #e9a23b;outline-offset:3px}</style></head>
<body><img src="/icons/icon-192.png" width="88" height="88" alt=""><h1>Bạn đang ngoại tuyến</h1><p>Kết nối mạng rồi thử lại. Video bằng chứng cần mạng để tải lên.</p><button type="button" onclick="location.reload()">Thử lại</button></body></html>`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.add("/icons/icon-192.png")).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
    return;
  }
  if (new URL(req.url).pathname === "/icons/icon-192.png") {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
