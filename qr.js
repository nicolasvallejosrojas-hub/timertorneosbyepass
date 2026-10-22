/* ▌ÍNDICE de qr.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Generador de QR
*/
/* ▌BLOQUE 1 · Generador de QR ═══════════════════════════════════════════════════
   Codifica en modo byte con corrección M (versiones 1 a 10) y entrega la matriz, un SVG, una
   imagen para <img> o un PNG. */
/* Códigos QR generados aquí mismo: el enlace no sale a ningún servicio externo.
   Modo byte, corrección M, versiones 1 a 10 (hasta 213 caracteres en ASCII: sobra para un enlace de la página).
     qrMatriz(texto)           → matriz de booleanos (true = módulo oscuro)
     qrSvg(texto, {borde:4})   → texto SVG, escala sin perder nitidez
     qrImg(texto)              → "data:image/svg+xml,…" listo para <img src>
     qrPng(texto, px)          → Promise<Blob> PNG para descargar o imprimir */
const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], BLOQ = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];   // por versión: ECC por bloque y nº de bloques (M)
const ALIN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const brutos = v => { let r = (16 * v + 128) * v + 64; if (v >= 2){ const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const gfMul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
function restoRS(datos, d){   // los d bytes de corrección de Reed-Solomon
  const gen = Array(d).fill(0); gen[d - 1] = 1;
  for (let i = 0, raiz = 1; i < d; i++){ for (let j = 0; j < d; j++){ gen[j] = gfMul(gen[j], raiz); if (j + 1 < d) gen[j] ^= gen[j + 1]; } raiz = gfMul(raiz, 2); }
  const r = Array(d).fill(0);
  for (const b of datos){ const f = b ^ r.shift(); r.push(0); gen.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
  return r;
}

function codificar(texto){
  const bytes = [...new TextEncoder().encode(texto)];
  let v = 1;
  while (v <= 10 && bytes.length > Math.floor(brutos(v) / 8) - ECC[v] * BLOQ[v] - (v < 10 ? 2 : 3)) v++;
  if (v > 10) throw new Error("El enlace es demasiado largo para el QR");
  const bits = [], poner = (n, largo) => { for (let i = largo - 1; i >= 0; i--) bits.push((n >>> i) & 1); };
  poner(4, 4); poner(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => poner(b, 8));
  const cap = (Math.floor(brutos(v) / 8) - ECC[v] * BLOQ[v]) * 8;
  poner(0, Math.min(4, cap - bits.length)); poner(0, (8 - bits.length % 8) % 8);
  for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) poner(p, 8);
  const datos = []; for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  /* bloques + corrección, intercalados */
  const nb = BLOQ[v], eb = ECC[v], total = Math.floor(brutos(v) / 8), cortos = nb - total % nb, largoCorto = Math.floor(total / nb), bloques = [];
  for (let i = 0, k = 0; i < nb; i++){
    const d = datos.slice(k, k + largoCorto - eb + (i < cortos ? 0 : 1)); k += d.length;
    const e = restoRS(d, eb); if (i < cortos) d.push(0); bloques.push(d.concat(e));
  }
  const salida = [];
  for (let i = 0; i < bloques[0].length; i++) bloques.forEach((b, j) => { if (i !== largoCorto - eb || j >= cortos) salida.push(b[i]); });
  return { v, salida };
}

function dibujar(v, palabras, mascara){
  const n = 17 + 4 * v, m = Array.from({ length: n }, () => Array(n).fill(false)), f = Array.from({ length: n }, () => Array(n).fill(false));
  const poner = (x, y, c) => { if (x >= 0 && y >= 0 && x < n && y < n){ m[y][x] = c; f[y][x] = true; } };
  for (let i = 0; i < n; i++){ poner(6, i, i % 2 === 0); poner(i, 6, i % 2 === 0); }
  const buscador = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){ const d = Math.max(Math.abs(dx), Math.abs(dy)); poner(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  buscador(3, 3); buscador(n - 4, 3); buscador(3, n - 4);
  const a = ALIN[v];
  a.forEach((cx, i) => a.forEach((cy, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === a.length - 1) || (i === a.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poner(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formato = mk => {   // corrección M = 00
    let r = mk; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = ((mk << 10) | r) ^ 0x5412, b = i => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) poner(8, i, b(i)); poner(8, 7, b(6)); poner(8, 8, b(7)); poner(7, 8, b(8));
    for (let i = 9; i < 15; i++) poner(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) poner(n - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) poner(8, n - 15 + i, b(i));
    poner(8, n - 8, true);
  };
  formato(0);   // reserva el lugar; el bueno se escribe al elegir la máscara
  if (v >= 7){
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const bits = (v << 12) | r;
    for (let i = 0; i < 18; i++){ const c = ((bits >>> i) & 1) !== 0, x = n - 11 + i % 3, y = Math.floor(i / 3); poner(x, y, c); poner(y, x, c); }
  }
  for (let i = 0, d = palabras.length * 8, der = n - 1; der >= 1; der -= 2){
    if (der === 6) der = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++){
      const x = der - j, y = ((der + 1) & 2) === 0 ? n - 1 - vert : vert;
      if (!f[y][x] && i < d){ m[y][x] = ((palabras[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }
  const MASCARAS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const aplicar = k => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!f[y][x] && MASCARAS[k](x, y)) m[y][x] = !m[y][x]; };
  let mejor = 0, menor = Infinity;
  for (let k = 0; k < 8; k++){ aplicar(k); formato(k); const p = penalidad(m); if (p < menor){ menor = p; mejor = k; } aplicar(k); }
  if (mascara !== undefined) mejor = mascara;
  aplicar(mejor); formato(mejor);
  return m;
}

/* Las cuatro reglas de la norma: rachas, cuadrados, parecido a un buscador y balance de oscuros. */
function penalidad(m){
  const n = m.length; let p = 0, oscuros = 0;
  const lineas = []; for (let y = 0; y < n; y++){ lineas.push(m[y].map(c => +c).join("")); lineas.push(m.map(r => +r[y]).join("")); }
  for (const l of lineas){
    for (const r of l.matchAll(/0{5,}|1{5,}/g)) p += r[0].length - 2;
    p += 40 * (l.match(/(?=(?:10111010000|00001011101))/g) || []).length;
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++){ const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  m.forEach(r => r.forEach(c => { if (c) oscuros++; }));
  return p + 10 * (Math.ceil(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) - 1);
}

export function qrMatriz(texto, mascara){ const { v, salida } = codificar(String(texto)); return dibujar(v, salida, mascara); }

export function qrSvg(texto, { borde = 4 } = {}){
  const m = qrMatriz(texto), n = m.length + borde * 2;
  let d = ""; m.forEach((fila, y) => fila.forEach((c, x) => { if (c) d += "M" + (x + borde) + "," + (y + borde) + "h1v1h-1z"; }));
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
export const qrImg = texto => "data:image/svg+xml," + encodeURIComponent(qrSvg(texto));

export function qrPng(texto, px = 1024){
  const m = qrMatriz(texto), borde = 4, n = m.length + borde * 2, e = Math.max(1, Math.floor(px / n)), c = document.createElement("canvas");
  c.width = c.height = n * e;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#000";
  m.forEach((fila, y) => fila.forEach((o, x) => { if (o) g.fillRect((x + borde) * e, (y + borde) * e, e, e); }));
  return new Promise(ok => c.toBlob(ok, "image/png"));
}
