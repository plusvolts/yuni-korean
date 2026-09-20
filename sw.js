/* 오프라인 캐시. 파일을 고치면 VERSION을 올려주세요 (app.js의 APP_VERSION과 같이). */
const VERSION = 'yuni-hangul-0.2.1';
const FILES = ['./', 'index.html', 'style.css', 'content.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', '기획서.md'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => encodeURI(f)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  // 네트워크 우선 + 브라우저 캐시도 매번 확인(no-cache) → 새 버전이 바로 반영돼요. 안 되면 캐시 → 오프라인 동작
  const net = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(net.then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
