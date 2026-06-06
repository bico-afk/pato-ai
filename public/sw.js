/* Service Worker da Bikco — habilita instalação (PWA) e um shell offline leve.
   Estratégia: network-first com fallback ao cache para documentos/imagens.
   Não cacheia respostas de API nem dados dinâmicos (evita conteúdo velho). */
const CACHE = 'bikco-v1'
const OFFLINE_URLS = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Não interceptar API/Next data/auth
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next/data') || url.pathname.startsWith('/auth')) return

  const cacheable = req.destination === 'document' || req.destination === 'image' || url.pathname.startsWith('/icon')
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && cacheable) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('/')))
  )
})
