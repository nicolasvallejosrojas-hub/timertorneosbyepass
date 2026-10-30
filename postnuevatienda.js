/* ▌ÍNDICE de postnuevatienda.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Post de «nueva tienda»
*/
/* ============================================================
   postnuevatienda.js — la imagen y el texto de Instagram para anunciar una tienda nueva
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   Lo usa Herramientas (administración): con el nombre, la comuna y, si quieres, el Instagram y el logo de la tienda
   arma una imagen vertical de 1080×1350 (la medida de un post de Instagram) y el texto para acompañarla. No lleva
   los días de liga ni de torneos: así se publica en un minuto. Se descarga o se comparte igual que la tabla final.
   El logo se elige desde el equipo (un archivo), así el lienzo no queda bloqueado para exportar.
   ============================================================ */
import { cabe, entregarImagen } from "./tablafinal.js?v=4";
import { paletaDe, pintarFondo } from "./fondoimg.js?v=1";

/* ▌BLOQUE 1 · Post de «nueva tienda» ════════════════════════════════════════════
   El texto para acompañar la imagen y el dibujo de la imagen (claro u oscuro, con el logo si hay). */
const W = 1080, H = 1350, PAD = 72;
const FONDOS = { claro: { tipo: "color", color1: "#DDEFE7" }, oscuro: { tipo: "color", color1: "#0F2E2A" } };

const limpio = t => String(t || "").trim().replace(/\s+/g, " ");
const arroba = t => { const u = limpio(t).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, ""); return /^[A-Za-z0-9._]{1,30}$/.test(u) ? u : ""; };

/* El texto de la publicación. Lo que no se dio (comuna, Instagram) simplemente no sale. */
export function textoPost({ nombre, comuna, instagram } = {}){
  const n = limpio(nombre) || "Tu tienda", c = limpio(comuna), ig = arroba(instagram);
  return "¡" + n + (c ? " (" + c + ")" : "") + " se une a ByePass! 🎉\n\n" +
    "Desde ahora sus torneos tienen el reloj de la ronda en la tele, tu mesa en el celular y el ranking del mes en su perfil.\n\n" +
    (c ? "📍 " + c + "\n" : "") + (ig ? "📸 @" + ig + "\n" : "") + (c || ig ? "\n" : "") +
    "Búscala en byepass.cl y síguela para no perderte su agenda.\n\n#ByePass #TCG";
}

/* Parte el nombre en líneas del ancho dado, a lo más `max`; devuelve null si no cabe. */
function partir(g, texto, ancho, max){
  const lineas = []; let linea = "";
  for (const p of texto.split(" ")){
    const prueba = linea ? linea + " " + p : p;
    if (g.measureText(prueba).width <= ancho) linea = prueba;
    else { if (!linea || g.measureText(p).width > ancho) return null; lineas.push(linea); linea = p; }
  }
  lineas.push(linea);
  return lineas.length <= max ? lineas : null;
}

/* datos: { nombre, comuna, instagram, logo (una imagen ya cargada, opcional), tema: "claro" | "oscuro" } */
export async function dibujarPost({ nombre, comuna, instagram, logo, tema } = {}){
  const estilo = FONDOS[tema] || FONDOS.claro, C = paletaDe(estilo);
  await Promise.all(["300 100px Newsreader", "600 36px Inter", "700 30px Inter"].map(f => document.fonts.load(f).catch(() => {})));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"); pintarFondo(g, W, H, estilo, null); g.textBaseline = "alphabetic"; g.textAlign = "left";

  /* el nombre: el tamaño más grande con el que cabe en tres líneas */
  const n = limpio(nombre) || "Tu tienda", ancho = W - 2 * PAD;
  let tam = 150, lineas = null;
  for (; tam >= 64 && !lineas; tam -= 8){ g.font = "300 " + tam + "px Newsreader"; lineas = partir(g, n, ancho, 3); }
  if (!lineas){ g.font = "300 64px Newsreader"; lineas = [cabe(g, n, ancho)]; tam = 64; }
  const c = limpio(comuna), ig = arroba(instagram), paso = Math.round(tam * 1.04);
  const alto = (logo ? 270 : 0) + lineas.length * paso + 90 + (c ? 70 : 0) + (ig ? 60 : 0);
  let y = Math.max(300, Math.round((H - 230 - alto) / 2 + 150));

  /* la etiqueta */
  g.font = "700 30px Inter"; const et = "NUEVA TIENDA", we = g.measureText(et).width + 56;
  g.fillStyle = C.coral; g.beginPath(); g.roundRect(PAD, 96, we, 62, 31); g.fill();
  g.fillStyle = "#fff"; g.fillText(et, PAD + 28, 138);

  /* el logo, en un círculo blanco */
  if (logo){
    const d = 210, cx = PAD + d / 2, cy = y + d / 2;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(cx, cy, d / 2, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, d / 2 - 12, 0, 7); g.clip();
    const k = Math.min((d - 24) / logo.width, (d - 24) / logo.height);
    g.drawImage(logo, cx - logo.width * k / 2, cy - logo.height * k / 2, logo.width * k, logo.height * k); g.restore();
    y += 270;
  }

  /* nombre, «se une a ByePass», comuna e Instagram */
  g.fillStyle = C.texto; g.font = "300 " + tam + "px Newsreader";
  lineas.forEach((l, i) => g.fillText(l, PAD, y + tam * .82 + i * paso));
  y += lineas.length * paso + 40;
  g.font = "300 64px Newsreader"; g.fillStyle = C.suave; g.fillText("se une a ", PAD, y + 50);
  let x = PAD + g.measureText("se une a ").width;
  g.fillStyle = C.texto; g.fillText("Bye", x, y + 50); x += g.measureText("Bye").width;
  g.fillStyle = C.coral; g.fillText("Pass", x, y + 50);
  y += 90;
  if (c){ g.fillStyle = C.coral; g.beginPath(); g.arc(PAD + 10, y + 26, 10, 0, 7); g.fill();
    g.fillStyle = C.texto; g.font = "600 40px Inter"; g.fillText(cabe(g, c, ancho - 40), PAD + 36, y + 40); y += 70; }
  if (ig){ g.fillStyle = C.suave; g.font = "600 36px Inter"; g.fillText("@" + ig, PAD + 36, y + 36); }

  /* pie: invitación y marca */
  g.fillStyle = C.suave; g.font = "600 32px Inter"; g.fillText("Búscala y síguela en byepass.cl", PAD, H - 150);
  g.fillStyle = C.linea; g.fillRect(PAD, H - 124, W - 2 * PAD, 2);
  g.font = "300 56px Newsreader"; g.fillStyle = C.texto; g.fillText("Bye", PAD, H - 56);
  g.fillStyle = C.coral; g.fillText("Pass", PAD + g.measureText("Bye").width, H - 56);
  g.textAlign = "right"; g.font = "600 26px Inter"; g.fillStyle = C.suave; g.fillText("byepass.cl", W - PAD, H - 62);
  return cv;
}

export async function entregarPost(datos){
  return entregarImagen(await dibujarPost(datos), "nueva-tienda-" + limpio(datos.nombre), "Nueva tienda en ByePass");
}
