/* ▌ÍNDICE de push.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Avisos push
*/
/* ============================================================
   push.js — avisos push del staff de sala
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   Pide permiso, saca el token de Firebase Cloud Messaging con la clave pública (VAPID) del proyecto y lo guarda
   en fcmTokens/<tienda>/<uid> = { token, rol, t }. Quien manda los avisos es la Cloud Function de functions/ (index.js):
   cuando llega un mensaje, alguien pide entrar o te admiten, el servidor le avisa a este aparato y sw.js lo muestra.

   Lo usan el panel (rol «org») y staff.html (rol «staff»). No corre con el emulador (no hay FCM) ni sin permiso.
   En iPhone solo funciona con ByePass instalada en la pantalla de inicio. La clave VAPID es PÚBLICA.
   ============================================================ */
import { ref, set, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ▌BLOQUE 1 · Avisos push ═══════════════════════════════════════════════════════
   Pide permiso, saca el token de Firebase Cloud Messaging con la clave pública (VAPID) y lo guarda
   en fcmTokens; lo usan el panel y staff.html. */
const VAPID = "BIc0QCkULVb22kpBHoHWOYWWja_kCdBLLRq7t7qYHyvv5DZfin1l2dm9tQw0MgFjJA4b5ezPcl1GdOcKGH6Us6I";
const MENSAJERIA = "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
const marca = tienda => "push:" + tienda;
const emulador = () => typeof EMULADOR !== "undefined" && !!EMULADOR;

/* Por qué no se puede, o "" si se puede. */
export async function razonNoPush(){
  if (emulador()) return "El emulador no tiene avisos push.";
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window))
    return /iPhone|iPad/.test(navigator.userAgent) ? "En iPhone instala ByePass en tu pantalla de inicio para recibir avisos." : "Este navegador no recibe avisos con la página cerrada.";
  try { const { isSupported } = await import(MENSAJERIA); if (!(await isSupported())) return "Este navegador no recibe avisos con la página cerrada."; }
  catch(e){ return "No se pudo preparar los avisos. Revisa tu conexión."; }
  return "";
}
export const pushActivo = tienda => { try { return localStorage.getItem(marca(tienda)) === "1" && Notification.permission === "granted"; } catch(e){ return false; } };

/* Activa: permiso, token y guardarlo. Devuelve "" si salió bien o el motivo. */
export async function activarPush({ app, db, uid, tienda, rol }){
  const razon = await razonNoPush(); if (razon) return razon;
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return "Los avisos están bloqueados: actívalos en los ajustes del navegador para este sitio.";
    const { getMessaging, getToken } = await import(MENSAJERIA);
    const registro = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registro });
    if (!token) return "No se pudo activar los avisos. Inténtalo otra vez.";
    await set(ref(db, "fcmTokens/" + tienda + "/" + uid), { token, rol, t: serverTimestamp() });
    try { localStorage.setItem(marca(tienda), "1"); } catch(e){}
    return "";
  } catch(e){ return "No se pudo activar los avisos (" + (e.code || e.message || "error") + ")."; }
}

/* Los tokens cambian de vez en cuando: al abrir, si ya estaban activos, se vuelve a guardar el vigente. */
export async function renovarPush({ app, db, uid, tienda, rol }){
  if (!pushActivo(tienda) || await razonNoPush()) return;
  try {
    const { getMessaging, getToken } = await import(MENSAJERIA);
    const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: await navigator.serviceWorker.ready });
    if (token) await set(ref(db, "fcmTokens/" + tienda + "/" + uid), { token, rol, t: serverTimestamp() });
  } catch(e){}
}

export async function desactivarPush({ app, db, uid, tienda }){
  try { localStorage.removeItem(marca(tienda)); } catch(e){}
  try { await remove(ref(db, "fcmTokens/" + tienda + "/" + uid)); } catch(e){}
  try { const { getMessaging, deleteToken } = await import(MENSAJERIA); await deleteToken(getMessaging(app)); } catch(e){}
}
