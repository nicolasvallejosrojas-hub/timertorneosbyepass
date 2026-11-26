/* metaimg.js — las imágenes para redes del meta (estilo rojo/negro con el corte diagonal) y los sprites de Limitless que llevan.
   Lo usan meta.html (el meta de un torneo) y meta-chile.html (el meta del país). Solo dibuja: los datos los pone cada página.

   Sprites: los iconos de Limitless (los de Training Court) copiados al sitio en sprites/ (meta-torneo/bajar-sprites.mjs); en la
   herramienta local, los que no estén los trae servidor.mjs en /sprite/ (usarProxyLocal); si no hay, pokesprite (gen 8) y el
   pixel art de PokeAPI (gen 9); sin ninguno, la fila va sin sprite. */
import { especieDe } from "./meta.js?v=6a8e75c14088";

const PS = "https://cdn.jsdelivr.net/gh/msikma/pokesprite@master/pokemon-gen8/regular/";
const PA = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/";
let DEX = null, LOCAL = false;
export const usarProxyLocal = v => { LOCAL = !!v; };
const dex = () => DEX ??= fetch("https://cdn.jsdelivr.net/gh/PokeAPI/pokeapi@master/data/v2/csv/pokemon.csv").then(r => r.text())
  .then(t => new Map(t.split("\n").slice(1).map(l => l.split(",")).filter(c => c[1]).map(c => [c[1], c[0]]))).catch(() => new Map());
const traer = url => new Promise(ok => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
/* sin el borde transparente: así todos ocupan su caja igual */
function recortar(img){
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let k = 0; k < c.width; k++) if (d[(y * c.width + k) * 4 + 3] > 8){ x0 = Math.min(x0, k); x1 = Math.max(x1, k); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); o.url = o.toDataURL(); return o;
}
const SPR = new Map();
function sprite(nombre){
  if (!SPR.has(nombre)) SPR.set(nombre, (async () => {
    const { slug, base } = especieDe(nombre);
    for (const s of new Set([slug.replace(/-mask$/, ""), base])){ const i = await traer("sprites/" + s + ".png"); if (i) return recortar(i); }   // Limitless: ogerpon-wellspring, sin -mask
    if (LOCAL) for (const s of new Set([slug.replace(/-mask$/, ""), base])){ const i = await traer("../sprite/" + s + ".png"); if (i) return recortar(i); }
    for (const s of new Set([slug, base])){ const i = await traer(PS + s + ".png"); if (i) return recortar(i); }
    const d = await dex();
    for (const s of new Set([slug, base])) if (d.get(s)){ const i = await traer(PA + d.get(s) + ".png"); if (i) return recortar(i); }
    return null;
  })());
  return SPR.get(nombre);
}
export const sprites = async ins => (await Promise.all(ins.slice(0, 2).map(sprite))).filter(Boolean);
export const sprHTML = async ins => '<span class="spr">' + (await sprites(ins)).map(s => '<img alt="" src="' + s.url + '">').join("") + "</span>";

/* ── el lienzo: negro, rojo y blanco, con el corte diagonal arriba ── */
export const C = { fondo: "#0D0D0D", fila: "#1B1B1B", pista: "#2E2E2E", texto: "#FFFFFF", apagado: "#B9B9B9", rojo: "#E3000F", gris: "#7A7A7A" };
export const COND = '"Barlow Condensed"', INTER = "Inter";
export const TAM = { post: [1080, 1350], historia: [1080, 1920] };
const TAN = Math.tan(14 * Math.PI / 180);   // la inclinación del corte (la misma de la página)
export function lienzo(fmt){ const [w, h] = TAM[fmt], c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = C.fondo; x.fillRect(0, 0, w, h); return [c, x, w, h]; }
export function texto(x, t, X0, Y, { size = 32, peso = 600, color = C.texto, max = 0, align = "left", espacio = 0, fam = INTER, ital = false } = {}){
  const f = k => (ital ? "italic " : "") + peso + " " + k + "px " + fam;
  x.font = f(size); x.fillStyle = color; x.textAlign = align; x.letterSpacing = espacio + "px";
  let s = String(t);
  if (max) for (let k = size; k > size * 0.75 && x.measureText(s).width > max; k -= 2) x.font = f(k);
  if (max) while (s.length > 1 && x.measureText(s).width > max) s = s.slice(0, -2) + "…";
  x.fillText(s, X0, Y); x.letterSpacing = "0px";
}
/* un paralelogramo con la inclinación del corte */
export function corte(x, X0, Y, w, h, color){ const d = h * TAN; x.fillStyle = color; x.beginPath(); x.moveTo(X0 + d, Y); x.lineTo(X0 + w, Y); x.lineTo(X0 + w - d, Y + h); x.lineTo(X0, Y + h); x.closePath(); x.fill(); }
/* los sprites, pixelados, dentro de una caja de alto h (dos lado a lado) */
export async function dibujarSprites(x, ins, X0, Y, h, ancho){
  const ss = await sprites(ins); if (!ss.length) return;
  x.imageSmoothingEnabled = false;
  const w = ancho / ss.length;
  ss.forEach((s, i) => { const k = Math.min(h / s.height, w / s.width), dw = s.width * k, dh = s.height * k;
    x.drawImage(s, X0 + i * w + (w - dw) / 2, Y + h - dh, dw, dh); });
}
/* arriba: el título grande y, pegado a su derecha, el bloque rojo en diagonal con su filo blanco (nunca cruza las letras);
   debajo, a todo el ancho, el subtítulo (de qué torneo o período es). Devuelve dónde sigue. */
export function cabecera(x, w, titulo, sub, fmt){
  const top = fmt === "historia" ? 170 : 96, base = top + 34, alto = top + 62;
  let size = 112; const fuente = k => "italic 800 " + k + 'px "Barlow Condensed"';
  x.font = fuente(size); while (size > 64 && x.measureText(titulo.toUpperCase()).width > w * 0.66) x.font = fuente(size -= 4);
  const ancho = x.measureText(titulo.toUpperCase()).width, x0 = 64 + ancho + 56;   // el borde de abajo del bloque, después del título
  const bloque = (d, color) => { x.fillStyle = color; x.beginPath(); x.moveTo(x0 + d + alto * TAN, 0); x.lineTo(w, 0); x.lineTo(w, alto); x.lineTo(x0 + d, alto); x.closePath(); x.fill(); };
  bloque(-10, "#FFFFFF"); bloque(0, C.rojo);
  texto(x, titulo.toUpperCase(), 64, base, { size, peso: 800, fam: COND, ital: true });
  texto(x, sub, 66, top + 104, { size: 30, peso: 600, color: "#FFFFFF", max: w - 128 });
  x.fillStyle = C.rojo; x.fillRect(64, top + 128, 120, 6);   // una raya roja cierra la cabecera
  return top + 176;
}
export function pie(x, w, h, nota){
  if (nota) texto(x, nota, 64, h - 108, { size: 22, peso: 500, color: C.apagado, max: w - 128 });
  corte(x, 64, h - 76, 26, 34, C.rojo);
  texto(x, "byepass.cl", 104, h - 49, { size: 30, peso: 700, fam: COND, ital: true, espacio: 1 });
}
export const fila = (x, X0, Y, w, h, color = C.fila) => { x.fillStyle = color; x.beginPath(); x.roundRect(X0, Y, w, h, 6); x.fill(); };
export const barra = (x, X0, Y, w, frac, color) => { x.fillStyle = C.pista; x.fillRect(X0, Y, w, 12); x.fillStyle = color; x.fillRect(X0, Y, Math.max(12, w * frac), 12); };
/* las letras de las imágenes, cargadas antes de dibujar */
export const fuentes = () => Promise.all(['italic 800 112px "Barlow Condensed"', '700 46px "Barlow Condensed"', "600 28px Inter", "500 22px Inter"].map(f => document.fonts.load(f)));
/* una lista de lienzos [nombre, canvas] como figuras con su botón «Descargar PNG» */
export function figuras(piezas, archivo){
  return piezas.map(([nom, c]) => {
    const f = document.createElement("figure"), cap = document.createElement("figcaption"), a = document.createElement("button");
    cap.textContent = nom; a.textContent = "Descargar PNG"; a.className = "sec"; a.type = "button";
    a.onclick = () => c.toBlob(bl => { const l = document.createElement("a"); l.href = URL.createObjectURL(bl); l.download = archivo(nom); l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 2000); });
    cap.append(a); f.append(c, cap); return f; });
}

/* ── los sprites en HTML (tablas de Mis partidas y del meta de Chile): Limitless (la forma y, si no, la especie) y después
   pokesprite; si ninguno existe, el <img> se quita. Cada página llama una vez a respaldoSprites(). ── */
export const spr = baraja => '<span class="spr" aria-hidden="true">' + String(baraja || "").split(" + ").filter(Boolean).slice(0, 2).map(n => {
  const { base, slug } = especieDe(n), a = slug.replace(/-mask$/, ""), otras = [...new Set([...(a !== base ? ["sprites/" + base + ".png"] : []), PS + slug + ".png", PS + base + ".png"])];
  return '<img alt="" loading="lazy" src="sprites/' + esc(a) + '.png" data-otras="' + esc(otras.join("|")) + '">'; }).join("") + "</span>";
export const respaldoSprites = () => document.addEventListener("error", e => { const i = e.target;
  if (i.tagName !== "IMG" || !i.closest(".spr")) return;
  const [sig, ...resto] = (i.dataset.otras || "").split("|").filter(Boolean);
  if (sig){ i.dataset.otras = resto.join("|"); i.src = sig; } else i.remove(); }, true);
