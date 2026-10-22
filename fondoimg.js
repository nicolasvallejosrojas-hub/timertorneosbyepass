/* ▌ÍNDICE de fondoimg.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Fondo de las imágenes
*/
/* ============================================================
   fondoimg.js — el fondo de las imágenes que genera la página
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   La tabla final y el calendario del mes se dibujan sobre un fondo que la tienda
   elige: un color, un degradado de dos colores o una imagen (con un velo oscuro
   para que se lea el texto). Se guarda en salas/<tienda>/imagenes.
   Con un fondo claro, las letras y los bordes pasan a oscuros solos (o se eligen a mano: «letras»).
   El QR no usa esto: necesita fondo blanco para que lo lea el celular.
   ============================================================ */

/* ▌BLOQUE 1 · Fondo de las imágenes ═════════════════════════════════════════════
   El fondo por defecto, la paleta según el fondo (letras claras u oscuras, o a mano) y el dibujo
   del fondo en un canvas. */
export const FONDO_DEF = { tipo: "color", color1: "#0F2E2A", color2: "#0A221F", dir: "to bottom", fondo: "", oscuro: 40, letras: "auto" };
export const DIRECCIONES = { "to bottom": [0, 0, 0, 1], "to right": [0, 0, 1, 0], "to bottom right": [0, 0, 1, 1], "to top right": [0, 1, 1, 0] };

const OSCURA = { texto: "#F3FFFB", suave: "#9DBDB4", coral: "#F45B45", ambar: "#FFB020", fila: "rgba(243,255,251,.055)",
                 filaFuerte: "rgba(243,255,251,.11)", filaTenue: "rgba(243,255,251,.035)", linea: "rgba(243,255,251,.1)", apagado: "rgba(157,189,180,.35)" };
const CLARA = { texto: "#10231E", suave: "#3E5E55", coral: "#D43A25", ambar: "#A85F00", fila: "rgba(16,35,30,.06)",
                filaFuerte: "rgba(16,35,30,.12)", filaTenue: "rgba(16,35,30,.04)", linea: "rgba(16,35,30,.14)", apagado: "rgba(62,94,85,.45)" };

const luz = hex => { const n = parseInt(String(hex).slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const valido = e => ({ ...FONDO_DEF, ...(e || {}) });
export const esClaro = estilo => { const e = valido(estilo); return e.tipo === "color" ? luz(e.color1) > 0.6 : e.tipo === "degradado" ? (luz(e.color1) + luz(e.color2)) / 2 > 0.6 : false; };

/* Los colores del texto y de las filas que quedan bien sobre ese fondo. «letras» los fuerza (un degradado de oscuro a
   claro no tiene una elección automática buena para las dos puntas). */
export const paletaDe = estilo => { const l = valido(estilo).letras; return l === "claras" ? OSCURA : l === "oscuras" ? CLARA : esClaro(estilo) ? CLARA : OSCURA; };

export const cargarImagen = src => new Promise(ok => {
  if (!src) return ok(null);
  const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
});

/* Pinta el fondo de todo el canvas. `img`: la imagen ya cargada (cargarImagen), si el fondo es una imagen. */
export function pintarFondo(g, W, H, estilo, img){
  const e = valido(estilo);
  if (e.tipo === "imagen" && img){
    const k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k;   // cubre todo el lienzo, centrada
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    g.fillStyle = "rgba(0,0,0," + Math.min(.8, Math.max(0, e.oscuro / 100)) + ")"; g.fillRect(0, 0, W, H);
    return;
  }
  if (e.tipo === "degradado"){
    const [x0, y0, x1, y1] = DIRECCIONES[e.dir] || DIRECCIONES["to bottom"], gr = g.createLinearGradient(x0 * W, y0 * H, x1 * W, y1 * H);
    gr.addColorStop(0, e.color1); gr.addColorStop(1, e.color2); g.fillStyle = gr;
  } else g.fillStyle = e.color1;
  g.fillRect(0, 0, W, H);
}
