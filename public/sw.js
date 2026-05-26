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

self.addEventListener("push", (event) => {
  let data = { title: "Trim Time", body: "", url: "/" }
  try {
    if (event.data) {
      const parsed = event.data.json()
      if (parsed && typeof parsed === "object") {
        data = {
          title: typeof parsed.title === "string" ? parsed.title : data.title,
          body: typeof parsed.body === "string" ? parsed.body : data.body,
          url: typeof parsed.url === "string" ? parsed.url : data.url,
        }
      }
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || "/"
  const abs = url.startsWith("http") ? url : new URL(url, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.startsWith(abs.split("?")[0]) && "focus" in c) {
          return c.focus()
        }
      }
      return self.clients.openWindow(abs)
    })
  )
})
