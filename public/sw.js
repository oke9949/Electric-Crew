const CACHE_NAME = 'electric-crew-shell-v2'
const APP_SHELL = ['/', '/manifest.webmanifest', '/ec-mark.svg', '/apple-touch-icon.png', '/pwa-192.png', '/pwa-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function canCache(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return false
  if (request.headers.has('authorization')) return false
  const cacheControl = response.headers.get('cache-control') || ''
  return !/no-store|private/i.test(cacheControl) && !response.headers.has('set-cookie')
}

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  const shellRequest = request.mode === 'navigate'
    || ['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)
  if (!shellRequest) return

  event.respondWith(
    fetch(request)
      .then(async response => {
        if (canCache(request, response)) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, response.clone())
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') return caches.match('/')
        return Response.error()
      }),
  )
})
