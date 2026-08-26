// Service worker mínimo, solo para el diagnóstico de Web Push (ver
// src/features/notificaciones). No cachea nada todavía — cuando esto se
// integre de verdad con la mesita, ahí se evalúa si conviene sumarle
// estrategia de cache offline.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'PI Interna', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'PI Interna';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const abierta = lista.find((c) => c.url === url);
      if (abierta) return abierta.focus();
      return self.clients.openWindow(url);
    })
  );
});
