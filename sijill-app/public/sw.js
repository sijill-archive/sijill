/* Push delivery for registered Sijill users. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() ?? "" }; }
  const title = data.title || "إشعار جديد من سِجِلّ";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "لديك إشعار جديد.",
    icon: "/icons/sijill-icon-192.png",
    badge: "/icons/sijill-icon-192.png",
    tag: data.id || "sijill-broadcast",
    data: { url: data.url || "/" },
    dir: "rtl",
    lang: "ar",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== target) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
