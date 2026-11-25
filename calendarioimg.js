/* ▌ÍNDICE de calendarioimg.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Calendario del mes como imagen
    2. Fechas del mes con sus descripciones
*/
/* ============================================================
   calendarioimg.js — el calendario del mes como imagen para compartir
   ------------------------------------------------------------
   Versión actual: v=2   (subir el ?v= al tocar este archivo)

   Dos imágenes del mes, en una de dos plantillas (estilo.plantilla):
   · «byepass»: la de siempre, sobre el fondo que eligió la tienda (color, degradado o imagen).
   · «play»: negro, rojo y blanco con el corte en diagonal (inspirada en la paleta de Play! Pokémon, sin su logo ni su arte);
     fondo negro, o la imagen elegida con su velo.
   dibujarCalendario: la rejilla del mes (lunes a domingo) con los torneos de cada día y debajo la lista.
   dibujarFechas: las fechas del mes una bajo otra, con la descripción de cada una (el «detalle» del evento).
   mesImg (opcional): la imagen propia de ese mes (salas/<tienda>/imagenesMes/<AAAA-MM>), que manda sobre el fondo de la tienda.
   Se entrega como PNG: en el celular abre el menú de compartir; en el computador se descarga. No sube nada.
   ============================================================ */
import { cabe, entregarImagen } from "./tablafinal.js?v=11231c1e2ccf";
import { paletaDe, pintarFondo, cargarImagen } from "./fondoimg.js?v=11231c1e2ccf";
import { celdasDelMes, porFecha, ordenar, DOWS, MES_LARGO } from "./agenda.js?v=11231c1e2ccf";

/* ▌BLOQUE 1 · Calendario del mes como imagen ════════════════════════════════════
   El tema (colores, letras, cabecera y pie de cada plantilla) y la rejilla del mes. */
const W = 1080, PAD = 56, CAB = 270, DOW = 52, CH = 158, MAXCHIPS = 3, FILA = 84, PIE = 150;
const COLORES = ["#F45B45", "#FFB020", "#3FD0B0", "#6AA7FF", "#B58CFF", "#FF7DB0"];   // un juego, un color
const COLORES_PLAY = ["#E3000F", "#FFFFFF", "#9C9C9C", "#FF7A82", "#5E5E5E", "#FFC2C6"];
const SIN_JUEGO = "#9DBDB4";   // sin juego: gris, para no confundirlo con ninguno
const PLAY = { texto: "#FFFFFF", suave: "#C9C9C9", coral: "#E3000F", ambar: "#FF4D57", fila: "rgba(255,255,255,.06)", filaFuerte: "rgba(255,255,255,.11)",
               filaTenue: "rgba(255,255,255,.035)", linea: "rgba(255,255,255,.16)", apagado: "rgba(255,255,255,.28)" };
const ROJO = "#E3000F", TAN = Math.tan(14 * Math.PI / 180);
const COND = '"Barlow Condensed"';

/* El color de cada juego, según el orden en que aparecen: el mismo juego, el mismo color en toda la imagen. */
const coloresDe = (evs, lista) => {
  const m = new Map();
  evs.forEach(e => { if (e.juego && !m.has(e.juego)) m.set(e.juego, lista[m.size % lista.length]); });
  return m;
};
const conAlfa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; };

/* El fondo que vale para este mes: la imagen propia del mes (con su encuadre y velo) o el de la tienda. */
const efectivo = (estilo, mesImg) => mesImg && mesImg.fondo
  ? { ...(estilo || {}), tipo: "imagen", fondo: mesImg.fondo, zoom: mesImg.zoom, focoX: mesImg.focoX, focoY: mesImg.focoY, oscuro: mesImg.oscuro ?? (estilo && estilo.oscuro) ?? 40, letras: "claras" }
  : (estilo || {});
/* El tema de la plantilla: colores, letras y lista de colores por juego. */
function tema(e){
  const play = e.plantilla === "play";
  return play
    ? { play, C: PLAY, colores: COLORES_PLAY, grande: k => "italic 800 " + k + "px " + COND, dato: k => "700 " + k + "px " + COND, radio: 4 }
    : { play, C: paletaDe(e), colores: COLORES, grande: k => "300 " + k + "px Newsreader", dato: k => "700 " + k + "px Inter", radio: 12 };
}
const fuentes = () => Promise.all(["300 100px Newsreader", "700 30px Inter", "600 22px Inter", "400 22px Inter", "italic 800 100px " + COND, "700 40px " + COND]
  .map(f => document.fonts.load(f).catch(e => console.warn("Operación secundaria sin confirmar", e))));
async function pintarFondoDe(g, H, e, T){
  const img = e.tipo === "imagen" ? await cargarImagen(e.fondo) : null;
  if (T.play && !img){ g.fillStyle = "#0D0D0D"; g.fillRect(0, 0, W, H); return; }   // Play sin imagen: negro
  pintarFondo(g, W, H, e, img);
}
const mesNombre = m => MES_LARGO[m][0].toUpperCase() + MES_LARGO[m].slice(1);

/* La cabecera: el mes y el año grandes; debajo, de quién es y cuántos torneos. En Play, el bloque rojo en diagonal empieza
   después del título (nunca cruza las letras). */
function cabecera(g, T, tienda, a, m, linea){
  const C = T.C;
  g.textBaseline = "alphabetic"; g.textAlign = "left";
  if (!T.play){
    g.fillStyle = C.suave; g.font = "600 24px Inter";
    g.fillText(cabe(g, (tienda || "Calendario").toUpperCase(), W - 2 * PAD), PAD, 96);
    g.fillStyle = C.texto; g.font = T.grande(104);
    const mes = mesNombre(m);
    g.fillText(mes, PAD, 196);
    g.fillStyle = C.coral; g.fillText(String(a), PAD + g.measureText(mes + " ").width, 196);
    g.fillStyle = C.suave; g.font = "400 28px Inter"; g.fillText(linea, PAD, 244);
    return;
  }
  const mes = MES_LARGO[m].toUpperCase() + " ", anio = String(a);
  let size = 136; g.font = T.grande(size);
  while (size > 80 && g.measureText(mes + anio).width > W * 0.7) g.font = T.grande(size -= 4);
  const ancho = g.measureText(mes + anio).width, x0 = PAD + ancho + 56, alto = 176;
  const bloque = (d, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(x0 + d + alto * TAN, 0); g.lineTo(W, 0); g.lineTo(W, alto); g.lineTo(x0 + d, alto); g.closePath(); g.fill(); };
  if (x0 < W - 60){ bloque(-12, "#FFFFFF"); bloque(0, ROJO); }
  g.fillStyle = "#FFFFFF"; g.fillText(mes, PAD, 150);
  g.fillStyle = ROJO; g.fillText(anio, PAD + g.measureText(mes).width, 150);
  g.fillStyle = "#FFFFFF"; g.font = "600 28px Inter";
  g.fillText(cabe(g, [tienda, linea].filter(Boolean).join("  ·  "), W - 2 * PAD), PAD, 204);
  g.fillStyle = ROJO; g.fillRect(PAD, 226, 120, 6);
}
function pie(g, T, H){
  const C = T.C, yPie = H - 56;
  if (T.play){
    g.fillStyle = ROJO; g.beginPath(); g.moveTo(PAD + 9, yPie - 34); g.lineTo(PAD + 30, yPie - 34); g.lineTo(PAD + 21, yPie); g.lineTo(PAD, yPie); g.closePath(); g.fill();
    g.textAlign = "left"; g.fillStyle = "#FFFFFF"; g.font = "italic 800 38px " + COND; g.fillText("byepass.cl", PAD + 44, yPie - 2);
    return;
  }
  g.textAlign = "left"; g.font = "300 56px Newsreader"; g.fillStyle = C.texto; g.fillText("Bye", PAD, yPie);
  const wBye = g.measureText("Bye").width; g.fillStyle = C.coral; g.fillText("Pass", PAD + wBye, yPie);
  g.textAlign = "right"; g.font = "600 26px Inter"; g.fillStyle = C.suave; g.fillText("byepass.cl", W - PAD, yPie - 6);
}
const delMesDe = (eventos, a, m) => ordenar(eventos.filter(e => e.fecha && e.fecha.slice(0, 7) === a + "-" + String(m + 1).padStart(2, "0")));
const cuantos = n => n ? n + (n === 1 ? " torneo este mes" : " torneos este mes") : "Sin torneos agendados este mes";

/* estilo: el fondo elegido (fondoimg.js); puede venir como promesa. mesImg: la imagen propia de ese mes, si hay. */
export async function dibujarCalendario({ tienda, a, m, eventos, estilo, mesImg }){
  const e = efectivo(await estilo, await mesImg), T = tema(e), C = T.C;
  await fuentes();
  const delMes = delMesDe(eventos, a, m);
  const colores = coloresDe(delMes, T.colores), colorDe = x => colores.get(x.juego) || SIN_JUEGO;
  const celdas = celdasDelMes(a, m), semanas = celdas.length / 7, ix = porFecha(delMes);
  const yGrid = CAB + DOW, yLeyenda = yGrid + semanas * CH + 22, hayLeyenda = colores.size > 0;
  const yLista = yLeyenda + (hayLeyenda ? 54 : 6), listaH = Math.max(1, delMes.length) * FILA;
  const H = yLista + 66 + listaH + PIE;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  await pintarFondoDe(g, H, e, T);
  cabecera(g, T, tienda, a, m, cuantos(delMes.length));

  /* rejilla */
  const cw = (W - 2 * PAD) / 7;
  g.textAlign = "center"; g.font = T.play ? "700 22px " + COND : "600 20px Inter"; g.fillStyle = T.play ? ROJO : C.suave;
  DOWS.forEach((d, i) => g.fillText(T.play ? d.toUpperCase() : d, PAD + cw * i + cw / 2, CAB + 34));
  celdas.forEach((c, i) => {
    const x = PAD + (i % 7) * cw, y = yGrid + Math.floor(i / 7) * CH, evs = ix[c.iso] || [];
    g.fillStyle = evs.length && !c.fuera ? C.filaFuerte : C.filaTenue;
    g.beginPath(); g.roundRect(x + 3, y + 3, cw - 6, CH - 6, T.radio); g.fill();
    g.textAlign = "left"; g.font = T.play ? "700 28px " + COND : "700 22px Inter";
    g.fillStyle = c.fuera ? C.apagado : evs.length ? C.texto : C.suave;
    g.fillText(String(c.dia), x + 14, y + 33);
    if (c.fuera) return;
    const ver = evs.length > MAXCHIPS ? MAXCHIPS - 1 : evs.length;
    evs.slice(0, ver).forEach((ev, k) => {
      const cy = y + 44 + k * 34, col = colorDe(ev);
      g.fillStyle = conAlfa(col, T.play ? .3 : .24); g.beginPath(); g.roundRect(x + 9, cy, cw - 18, 30, T.play ? 3 : 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.roundRect(x + 9, cy, 5, 30, 3); g.fill();
      /* con hora, solo la hora (el título cortado no dice nada y está entero en la lista); de todo el día, el título */
      g.fillStyle = C.texto; g.font = "700 18px Inter";
      g.fillText(ev.hora || cabe(g, ev.titulo, cw - 38), x + 20, cy + 21);
    });
    if (evs.length > ver){ g.fillStyle = C.ambar; g.font = "700 17px Inter"; g.fillText("+" + (evs.length - ver) + " más", x + 14, y + 44 + ver * 34 + 20); }
  });

  /* leyenda de juegos */
  if (hayLeyenda){
    g.textAlign = "left"; g.font = "600 21px Inter"; let x = PAD;
    for (const [juego, col] of colores){
      const t = cabe(g, juego, 260), w = g.measureText(t).width;
      if (x + w + 44 > W - PAD) break;
      g.fillStyle = col; g.beginPath(); g.arc(x + 8, yLeyenda + 26, 8, 0, 7); g.fill();
      g.fillStyle = C.texto; g.fillText(t, x + 26, yLeyenda + 33); x += w + 58;
    }
  }

  /* lista del mes */
  g.textAlign = "left"; g.font = T.play ? "italic 800 34px " + COND : "700 24px Inter"; g.fillStyle = C.ambar; g.fillText("TORNEOS DEL MES", PAD, yLista + 34);
  g.fillStyle = C.linea; g.fillRect(PAD, yLista + 52, W - 2 * PAD, 1);
  if (!delMes.length){ g.fillStyle = C.suave; g.font = "400 26px Inter"; g.fillText("Todavía no hay fechas agendadas.", PAD, yLista + 66 + 44); }
  delMes.forEach((ev, i) => {
    const y = yLista + 66 + i * FILA, col = colorDe(ev), d = new Date(a, m, +ev.fecha.slice(8, 10)), dia = DOWS[(d.getDay() + 6) % 7] + " " + d.getDate();
    g.fillStyle = col; g.beginPath(); g.roundRect(PAD, y + 8, 6, FILA - 22, 3); g.fill();
    g.textAlign = "left"; g.fillStyle = C.texto; g.font = T.play ? "700 34px " + COND : "700 28px Inter"; g.fillText(dia, PAD + 24, y + 34);
    g.fillStyle = C.suave; g.font = "400 24px Inter"; g.fillText(ev.hora || "Todo el día", PAD + 24, y + 64);
    g.fillStyle = C.texto; g.font = T.play ? "700 36px " + COND : "700 30px Inter";
    g.fillText(cabe(g, ev.titulo, W - 2 * PAD - 230), PAD + 230, y + 34);
    const meta = [ev.tipo, ev.juego, ev.lugar].filter(Boolean).join(" · ");
    if (meta){ g.fillStyle = C.suave; g.font = "400 23px Inter"; g.fillText(cabe(g, meta, W - 2 * PAD - 230), PAD + 230, y + 64); }
  });

  pie(g, T, H);
  return cv;
}

export async function entregarCalendario(datos){
  return entregarImagen(await dibujarCalendario(datos), "calendario-" + (datos.tienda || "") + "-" + MES_LARGO[datos.m] + "-" + datos.a, "Calendario de " + MES_LARGO[datos.m] + " " + datos.a);
}

/* ▌BLOQUE 2 · Fechas del mes con sus descripciones ══════════════════════════════
   Una tarjeta por fecha: el día grande a la izquierda y, a la derecha, el título, la hora, el juego, el lugar y la
   descripción completa (hasta 7 renglones). El alto de la imagen sale de lo que hay que mostrar. */
/* Parte un texto en renglones que caben en `ancho`; el último, cortado con «…» si sobra. Respeta los saltos de línea. */
function envolver(g, texto, ancho, max){
  const sal = [];
  for (const par of String(texto || "").split(/\n+/)){
    let l = "";
    for (const p of par.split(/\s+/).filter(Boolean)){
      const t = l ? l + " " + p : p;
      if (!l || g.measureText(t).width <= ancho) l = t; else { sal.push(l); l = p; }
    }
    if (l) sal.push(l);
  }
  if (sal.length > max){ sal.length = max; sal[max - 1] = cabe(g, sal[max - 1] + " …", ancho); }
  return sal;
}
export async function dibujarFechas({ tienda, a, m, eventos, estilo, mesImg }){
  const e = efectivo(await estilo, await mesImg), T = tema(e), C = T.C;
  await fuentes();
  const delMes = delMesDe(eventos, a, m), colores = coloresDe(delMes, T.colores), colorDe = x => colores.get(x.juego) || SIN_JUEGO;
  const BX = PAD + 20, BW = 150, TX = BX + BW + 30, TW = W - PAD - 28 - TX, LT = T.play ? 46 : 40, LD = 34;
  const med = document.createElement("canvas").getContext("2d");
  const tarjetas = delMes.map(ev => {
    med.font = T.play ? "700 44px " + COND : "700 34px Inter"; const tit = envolver(med, ev.titulo, TW, 2);
    med.font = "400 25px Inter"; const desc = ev.detalle ? envolver(med, ev.detalle, TW, 7) : [];
    const h = Math.max(186, 36 + tit.length * LT + 38 + (desc.length ? 14 + desc.length * LD : 0) + 26);
    return { ev, tit, desc, h };
  });
  const yIni = CAB + 10, H = yIni + (tarjetas.length ? tarjetas.reduce((s, t) => s + t.h + 18, 0) : 120) + PIE;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  await pintarFondoDe(g, H, e, T);
  cabecera(g, T, tienda, a, m, delMes.length ? (delMes.length === 1 ? "1 fecha este mes" : delMes.length + " fechas este mes") : "Sin fechas agendadas este mes");
  if (!tarjetas.length){ g.textAlign = "left"; g.fillStyle = C.suave; g.font = "400 28px Inter"; g.fillText("Todavía no hay fechas agendadas.", PAD, yIni + 60); }
  let y = yIni;
  for (const { ev, tit, desc, h } of tarjetas){
    const col = colorDe(ev), d = new Date(a, m, +ev.fecha.slice(8, 10));
    g.fillStyle = T.play ? "rgba(255,255,255,.07)" : C.fila; g.beginPath(); g.roundRect(PAD, y, W - 2 * PAD, h, T.radio); g.fill();
    /* el día: en Play un bloque rojo; en ByePass, del color del juego */
    const bh = Math.min(h - 40, 150);
    g.fillStyle = T.play ? ROJO : conAlfa(col, .26); g.beginPath(); g.roundRect(BX, y + 20, BW, bh, T.play ? 3 : 10); g.fill();
    g.textAlign = "center"; g.fillStyle = "#FFFFFF";
    g.font = T.grande(T.play ? 92 : 84); g.fillText(String(d.getDate()), BX + BW / 2, y + 20 + bh * .62);
    g.font = T.play ? "700 26px " + COND : "700 22px Inter"; g.fillStyle = T.play ? "#FFFFFF" : C.texto;
    g.fillText((DOWS[(d.getDay() + 6) % 7] + " " + MES_LARGO[m].slice(0, 3)).toUpperCase(), BX + BW / 2, y + 20 + bh - 18);
    /* título, datos y descripción */
    g.textAlign = "left"; g.fillStyle = C.texto; g.font = T.play ? "700 44px " + COND : "700 34px Inter";
    let ty = y + 36 + LT - 10;
    tit.forEach(l => { g.fillText(l, TX, ty); ty += LT; });
    g.font = "600 24px Inter"; g.fillStyle = T.play ? "#FF6B73" : C.coral;
    g.fillText(cabe(g, [ev.hora ? ev.hora + " h" : "Todo el día", ev.tipo, ev.juego, ev.lugar].filter(Boolean).join("  ·  "), TW), TX, ty - 4);
    ty += 14 + 10;
    g.font = "400 25px Inter"; g.fillStyle = C.texto;
    desc.forEach(l => { g.fillText(l, TX, ty + 22); ty += LD; });
    y += h + 18;
  }
  pie(g, T, H);
  return cv;
}
export async function entregarFechas(datos){
  return entregarImagen(await dibujarFechas(datos), "fechas-" + (datos.tienda || "") + "-" + MES_LARGO[datos.m] + "-" + datos.a, "Fechas de " + MES_LARGO[datos.m] + " " + datos.a);
}
