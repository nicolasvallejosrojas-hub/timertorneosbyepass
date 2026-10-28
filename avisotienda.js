/* ▌ÍNDICE de avisotienda.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Avisar a una tienda aceptada
*/
/* ============================================================
   avisotienda.js — el mensaje para una tienda cuya solicitud se aprobó
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   Al aprobar una solicitud, la herramienta de administración ofrece «Avisarle»: arma este mensaje (que ya dice que la
   tienda fue aceptada, dónde entrar y que escriban al Instagram de ByePass para verificarla y salir en el buscador de
   tiendas) y lo manda por donde la tienda dejó su contacto: correo (se abre el correo con el texto puesto), WhatsApp
   (se abre la conversación con el texto) o Instagram (se copia el texto y se abre su perfil, porque Instagram no deja
   escribir el mensaje por enlace). No envía nada por su cuenta: el administrador revisa y manda.
   ============================================================ */

/* ▌BLOQUE 1 · Avisar a una tienda aceptada ══════════════════════════════════════
   El mensaje de tienda aceptada (con cómo verificarla por Instagram) y el canal y enlace según el
   contacto: correo, WhatsApp o Instagram. */
const norm = t => String(t || "").trim();

/* El texto del aviso. `origen`: la dirección del sitio (https://byepass.cl). */
export function mensajeAceptada(sol, origen, instagram){
  const s = sol || {}, quien = norm(s.quien) || "equipo de " + norm(s.nombre), tienda = norm(s.nombre) || "tu tienda";
  return "Hola " + quien + ". Tu tienda «" + tienda + "» fue aceptada en ByePass.\n\n" +
    "Ya puedes entrar a tu panel: " + origen + "/admin.html?sala=" + encodeURIComponent(norm(s.id)) + "\n\n" +
    "Para que aparezca en el buscador de tiendas necesitamos verificarla: escríbenos un mensaje por Instagram a @" + instagram +
    " (https://instagram.com/" + instagram + ") contándonos cuál es tu tienda.\n\n" +
    "Cualquier duda, responde este mensaje. ¡Gracias por sumarte!";
}
export const asuntoAceptada = sol => "Tu tienda " + (norm(sol && sol.nombre) || "") + " fue aceptada en ByePass";

/* Por dónde avisarle, según lo que escribió en «contacto» (un Instagram, un WhatsApp o un correo, tal como lo puso). */
export function canalDe(contacto){
  const c = norm(contacto);
  const correo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.exec(c);
  if (correo && !c.startsWith("@")) return { tipo: "correo", destino: c };
  const ig = /(?:instagram\.com\/)([A-Za-z0-9._]{1,30})/i.exec(c) || /^@?([A-Za-z0-9._]{2,30})$/.exec(c);
  const digitos = c.replace(/[\s().+-]/g, "");
  if (/^\+?\d{8,15}$/.test(digitos) && !/^@/.test(c)){
    /* un celular chileno de 9 dígitos que empieza por 9 va con el 56 delante; si ya trae código de país, se deja */
    return { tipo: "whatsapp", destino: /^9\d{8}$/.test(digitos) ? "56" + digitos : digitos.replace(/^\+/, "") };
  }
  if (ig && (c.startsWith("@") || /instagram\.com\//i.test(c) || /^[A-Za-z0-9._]{2,30}$/.test(c))) return { tipo: "instagram", destino: ig[1] };
  return { tipo: "otro", destino: "" };
}

/* La dirección que se abre para ese canal (null si solo se puede copiar el texto). */
export function enlaceAviso(canal, sol, origen, instagram){
  const texto = mensajeAceptada(sol, origen, instagram);
  if (canal.tipo === "correo") return "mailto:" + canal.destino + "?subject=" + encodeURIComponent(asuntoAceptada(sol)) + "&body=" + encodeURIComponent(texto);
  if (canal.tipo === "whatsapp") return "https://wa.me/" + canal.destino + "?text=" + encodeURIComponent(texto);
  if (canal.tipo === "instagram") return "https://instagram.com/" + encodeURIComponent(canal.destino);
  return null;
}
