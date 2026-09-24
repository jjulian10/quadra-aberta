self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    const message = event.data.json();
    await self.registration.showNotification(message.title || 'Quadra Aberta', {
      body: message.body || 'Você tem uma atualização na sua reserva.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: message.tag || 'quadra-aberta',
      data: { url: message.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const match = windows.find((windowClient) => windowClient.url === target.href);
    if (match) return match.focus();
    await self.clients.openWindow(target.href);
  })());
});
