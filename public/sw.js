/* Trim Time — service worker mínimo para critérios de PWA (Chrome/Android: beforeinstallprompt).
   Não faz cache offline; só repassa a rede. */
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
