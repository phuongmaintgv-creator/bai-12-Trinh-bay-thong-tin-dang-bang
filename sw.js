const STATIC_CACHE = 'bai12-static-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const VIDEO_URL = new URL('./BAI_12_TRINH_BAY_THONG_TIN_DANG_BANG.mp4', self.location.href).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== 'bai12-media-v1').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function rangeFromCachedFullResponse(request) {
  const cached = await caches.match(VIDEO_URL);
  if (!cached) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return cached;
  const buf = await cached.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!m) return cached;
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (!m[1] && m[2]) {
    const suffix = parseInt(m[2], 10);
    start = Math.max(0, size - suffix);
    end = size - 1;
  }
  if (start >= size || start > end) {
    return new Response(null, {status:416, headers:{'Content-Range':'bytes */'+size}});
  }
  end = Math.min(end, size - 1);
  const chunk = buf.slice(start, end + 1);
  const headers = new Headers(cached.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(chunk.byteLength));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Type', cached.headers.get('Content-Type') || 'video/mp4');
  return new Response(chunk, {status:206, statusText:'Partial Content', headers});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.href === VIDEO_URL) {
    event.respondWith(rangeFromCachedFullResponse(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
