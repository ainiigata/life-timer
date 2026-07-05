/* 人生タイマー Service Worker
   - ページ遷移はネットワーク優先(新バージョンを即配信、オフライン時のみキャッシュ)
   - その他アセットはキャッシュ優先
   - __BUILD__ はビルド時にコンテンツハッシュへ置換され、デプロイごとに旧キャッシュを破棄する */
const CACHE = 'life-timer-__BUILD__';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('./index.html', { ignoreSearch: true })
            .then((hit) => hit || caches.match('./', { ignoreSearch: true }))
        )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
