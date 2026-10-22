/* ▌ÍNDICE de calendarioimg.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Calendario del mes como imagen
*/
/* ============================================================
   calendarioimg.js — el calendario del mes como imagen para compartir
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   La rejilla del mes (lunes a domingo) con los torneos de cada día, y debajo la
   lista con la fecha, la hora, el título, el juego y el lugar. Mismo lienzo
   oscuro por defecto (o el fondo que la tienda eligió), letras y marca como la tabla final. Cada juego tiene su color.
   Se entrega como PNG: en el celular abre el menú de compartir; en el
   computador se descarga. No sube nada: la imagen queda solo en el aparato.
   ============================================================ */
import { cabe, entregarImagen } from "./tablafinal.js?v=4";
import { paletaDe, pintarFondo, cargarImagen } from "./fondoimg.js?v=1";
import { celdasDelMes, porFecha, ordenar, DOWS, MES_LARGO } from "./agenda.js?v=5";

/* ▌BLOQUE 1 · Calendario del mes como imagen ════════════════════════════════════
   Dibuja el mes (rejilla lunes a domingo y lista, un color por juego) sobre el fondo elegido y lo
   comparte o descarga. */
const W = 1080, PAD = 56, CAB = 270, DOW = 52, CH = 158, MAXCHIPS = 3, FILA = 84, PIE = 150;
const COLORES = ["#F45B45", "#FFB020", "#3FD0B0", "#6AA7FF", "#B58CFF", "#FF7DB0"];   // un juego, un color
const SIN_JUEGO = "#9DBDB4";   // sin juego: gris, para no confundirlo con ninguno

/* El color de cada juego, según el orden en que aparecen: el mismo juego, el mismo color en toda la imagen. */
const coloresDe = evs => {
  const m = new Map();
  evs.forEach(e => { if (e.juego && !m.has(e.juego)) m.set(e.juego, COLORES[m.size % COLORES.length]); });
  return m;
};
const conAlfa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; };

/* estilo: el fondo elegido (fondoimg.js); puede venir como promesa. */
export async function dibujarCalendario({ tienda, a, m, eventos, estilo }){
  estilo = await estilo; const C = paletaDe(estilo);   // colores del texto y las filas según el fondo
  await Promise.all(["300 100px Newsreader", "700 30px Inter", "600 22px Inter", "400 22px Inter"].map(f => document.fonts.load(f).catch(() => {})));
  const delMes = ordenar(eventos.filter(e => e.fecha && e.fecha.slice(0, 7) === a + "-" + String(m + 1).padStart(2, "0")));
  const colores = coloresDe(delMes), colorDe = e => colores.get(e.juego) || SIN_JUEGO;
  const celdas = celdasDelMes(a, m), semanas = celdas.length / 7, ix = porFecha(delMes);
  const yGrid = CAB + DOW, yLeyenda = yGrid + semanas * CH + 22, hayLeyenda = colores.size > 0;
  const yLista = yLeyenda + (hayLeyenda ? 54 : 6), listaH = Math.max(1, delMes.length) * FILA;
  const H = yLista + 66 + listaH + PIE;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  pintarFondo(g, W, H, estilo, await cargarImagen(estilo && estilo.fondo)); g.textBaseline = "alphabetic";

  /* cabecera: tienda, mes y año, cuántos torneos */
  g.textAlign = "left"; g.fillStyle = C.suave; g.font = "600 24px Inter";
  g.fillText(cabe(g, (tienda || "Calendario").toUpperCase(), W - 2 * PAD), PAD, 96);
  g.fillStyle = C.texto; g.font = "300 104px Newsreader";
  const mes = MES_LARGO[m][0].toUpperCase() + MES_LARGO[m].slice(1);
  g.fillText(mes, PAD, 196);
  g.fillStyle = C.coral; g.fillText(String(a), PAD + g.measureText(mes + " ").width, 196);
  g.fillStyle = C.suave; g.font = "400 28px Inter";
  g.fillText(delMes.length ? delMes.length + (delMes.length === 1 ? " torneo este mes" : " torneos este mes") : "Sin torneos agendados este mes", PAD, 244);

  /* rejilla */
  const cw = (W - 2 * PAD) / 7;
  g.textAlign = "center"; g.font = "600 20px Inter"; g.fillStyle = C.suave;
  DOWS.forEach((d, i) => g.fillText(d, PAD + cw * i + cw / 2, CAB + 34));
  celdas.forEach((c, i) => {
    const x = PAD + (i % 7) * cw, y = yGrid + Math.floor(i / 7) * CH, evs = ix[c.iso] || [];
    g.fillStyle = evs.length && !c.fuera ? C.filaFuerte : C.filaTenue;
    g.beginPath(); g.roundRect(x + 3, y + 3, cw - 6, CH - 6, 12); g.fill();
    g.textAlign = "left"; g.font = "700 22px Inter";
    g.fillStyle = c.fuera ? C.apagado : evs.length ? C.texto : C.suave;
    g.fillText(String(c.dia), x + 14, y + 33);
    if (c.fuera) return;
    const ver = evs.length > MAXCHIPS ? MAXCHIPS - 1 : evs.length;
    evs.slice(0, ver).forEach((e, k) => {
      const cy = y + 44 + k * 34, col = colorDe(e);
      g.fillStyle = conAlfa(col, .24); g.beginPath(); g.roundRect(x + 9, cy, cw - 18, 30, 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.roundRect(x + 9, cy, 5, 30, 3); g.fill();
      /* con hora, solo la hora (el título cortado no dice nada y está entero en la lista); de todo el día, el título */
      g.fillStyle = C.texto; g.font = "700 18px Inter";
      g.fillText(e.hora || cabe(g, e.titulo, cw - 38), x + 20, cy + 21);
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
  g.textAlign = "left"; g.font = "700 24px Inter"; g.fillStyle = C.ambar; g.fillText("TORNEOS DEL MES", PAD, yLista + 34);
  g.fillStyle = C.linea; g.fillRect(PAD, yLista + 52, W - 2 * PAD, 1);
  if (!delMes.length){ g.fillStyle = C.suave; g.font = "400 26px Inter"; g.fillText("Todavía no hay fechas agendadas.", PAD, yLista + 66 + 44); }
  delMes.forEach((e, i) => {
    const y = yLista + 66 + i * FILA, col = colorDe(e), d = new Date(a, m, +e.fecha.slice(8, 10)), dia = DOWS[(d.getDay() + 6) % 7] + " " + d.getDate();
    g.fillStyle = col; g.beginPath(); g.roundRect(PAD, y + 8, 6, FILA - 22, 3); g.fill();
    g.textAlign = "left"; g.fillStyle = C.texto; g.font = "700 28px Inter"; g.fillText(dia, PAD + 24, y + 34);
    g.fillStyle = C.suave; g.font = "400 24px Inter"; g.fillText(e.hora || "Todo el día", PAD + 24, y + 64);
    g.fillStyle = C.texto; g.font = "700 30px Inter";
    g.fillText(cabe(g, e.titulo, W - 2 * PAD - 230), PAD + 230, y + 34);
    const meta = [e.juego, e.lugar].filter(Boolean).join(" · ");
    if (meta){ g.fillStyle = C.suave; g.font = "400 23px Inter"; g.fillText(cabe(g, meta, W - 2 * PAD - 230), PAD + 230, y + 64); }
  });

  /* pie: la marca */
  const yPie = H - 56;
  g.textAlign = "left"; g.font = "300 56px Newsreader"; g.fillStyle = C.texto; g.fillText("Bye", PAD, yPie);
  const wBye = g.measureText("Bye").width; g.fillStyle = C.coral; g.fillText("Pass", PAD + wBye, yPie);
  g.textAlign = "right"; g.font = "600 26px Inter"; g.fillStyle = C.suave; g.fillText("byepass.cl", W - PAD, yPie - 6);
  return cv;
}

export async function entregarCalendario(datos){
  return entregarImagen(await dibujarCalendario(datos), "calendario-" + (datos.tienda || "") + "-" + MES_LARGO[datos.m] + "-" + datos.a, "Calendario de " + MES_LARGO[datos.m] + " " + datos.a);
}
