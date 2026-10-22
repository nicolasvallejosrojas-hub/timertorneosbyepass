/* ▌ÍNDICE de sw.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Service worker
*/
/* ▌BLOQUE 1 · Service worker ════════════════════════════════════════════════════
   Red primero; la copia guardada solo sin señal. Atiende solo GET. */
/* =========================================================
   sw.js — la app instalable
   ---------------------------------------------------------
   Las páginas van a la red primero y guardan una copia de lo que traen. La copia
   se usa si la red falla o tarda más de 4 s: así una versión nueva se ve al tiro
   (nadie queda pegado en una vieja) y, sin señal o con señal mala, la página igual
   abre. Los módulos y estilos con ?v=N y los de Firebase (versión en la dirección)
   salen de la copia al tiro y se refrescan por detrás. La vista del timer
   ya guarda en el teléfono la hora de término de la ronda, así que abierta
   sin señal sigue marcando bien, y se pone al día sola cuando vuelve la red.

   Guarda lo propio del sitio y los módulos de Firebase. Las conexiones a la
   base y al inicio de sesión no pasan por acá.

   Una copia por archivo: la de ?v=9 reemplaza a la de ?v=8, y la de
   timer-view.html?sala=a sirve para ?sala=b (es la misma página; la sala la
   lee el código).
   ========================================================= */
const CAJA = "copias-1";

/* Avisos push (FCM, solo datos): el servidor manda { title, body, url, tag } y acá se muestran. Lo usa el staff de
   sala (functions/index.js). Tocar el aviso abre o enfoca la página que dice «url». */
self.addEventListener("push", e => {
  let p = {}; try { p = e.data ? e.data.json() : {}; } catch(x){}
  const d = p.data || p, n = p.notification || {};
  e.waitUntil(self.registration.showNotification(d.title || n.title || "ByePass", {
    body: d.body || n.body || "", tag: d.tag || undefined, icon: "icono-192.png", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => c.url.split("#")[0] === url.split("#")[0]);
    return w ? w.focus() : clients.openWindow(url);
  }));
});

self.addEventListener("install", () => self.skipWaiting());
/* La precarga de navegación pide la página en paralelo mientras arranca el service worker (dormido, tarda en despertar). */
self.addEventListener("activate", e => e.waitUntil(Promise.all([clients.claim(), self.registration.navigationPreload && self.registration.navigationPreload.enable()])));

const guardar = (r, res) => { if (!res.ok) return; const copia = res.clone(); return caches.open(CAJA).then(c => c.delete(r, { ignoreSearch: true }).then(() => c.put(r, copia))); };
const TARDE = 4000;   // ms: si la red no responde en ese tiempo y hay copia, se usa la copia (la red sigue y la deja guardada)

self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  const firebase = u.origin === "https://www.gstatic.com" && u.pathname.startsWith("/firebasejs/");
  if (u.origin !== location.origin && !firebase) return;

  /* Módulos, estilos y Firebase llevan su versión en la dirección (?v=N o 10.12.2): lo guardado sirve al tiro y se
     refresca por detrás. Si cambia ?v=, la dirección es otra y se baja de la red. */
  if (firebase || u.searchParams.has("v")){
    e.respondWith(caches.match(r).then(c => {
      const red = fetch(r).then(res => { e.waitUntil(guardar(r, res)); return res; });
      if (c){ e.waitUntil(red.catch(() => {})); return c; }
      return red;
    }));
    return;
  }

  /* Páginas y lo demás: red primero (una versión nueva se ve al tiro), con la copia como respaldo si no hay señal o
     si la red tarda demasiado. */
  const copia = () => caches.match(r, { ignoreSearch: true });
  const red = Promise.resolve(e.preloadResponse).then(p => p || fetch(r)).then(res => { e.waitUntil(guardar(r, res)); return res; });
  e.respondWith(Promise.race([
    red.catch(() => copia().then(c => c || Response.error())),
    new Promise(ok => setTimeout(() => copia().then(c => { if (c) ok(c); }), TARDE)),
  ]));
});
