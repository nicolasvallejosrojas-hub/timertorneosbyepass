/* ▌ÍNDICE de vistapub.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Qué ven los jugadores
*/
/* ============================================================
   vistapub.js — qué de los emparejamientos ven los jugadores
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   La tienda elige (salas/<tienda>/vistaJugadores = { pos, rec, pct }):
     · pos: la pestaña «Posiciones». Apagada, la clasificación NO se publica (no solo se esconde: quien abra la consola
       del navegador tampoco la encuentra), así los jugadores no calculan desempates. Los puntos de cada mesa se ven siempre.
     · rec: el récord (G-P-E) de cada jugador. Apagado, solo se publican sus puntos.
     · pct: el % de victorias que sale junto al récord. Se calcula del récord: es solo de pantalla; para que no se pueda
       calcular hay que apagar también el récord.
   Por defecto se ve todo menos el %. Lo usan el panel (al publicar) y las vistas de los jugadores y de la tele.
   ============================================================ */

/* ▌BLOQUE 1 · Qué ven los jugadores ═════════════════════════════════════════════
   Los tres valores (posiciones, récord, %) con sus defectos y la copia de los emparejamientos sin
   lo que la tienda decidió no mostrar. */
export const VISTA_DEF = { pos: true, rec: true, pct: false };
export const vistaDe = v => v && typeof v === "object" ? { pos: v.pos !== false, rec: v.rec !== false, pct: v.pct === true } : { ...VISTA_DEF };

const soloPts = r => r && typeof r === "object" ? (r.pts === undefined ? {} : { pts: r.pts }) : r;
const sinRecord = ({ w, l, t, ...resto }) => resto;   // se queda con place, name, pts, cat…

/* Lo que se publica de `pairings` (no toca el original: el panel lo sigue usando entero para archivar). */
export function publicable(pairings, vista){
  if (!pairings) return pairings;
  const v = vistaDe(vista), p = { ...pairings };
  if (!v.pos) delete p.standings;
  else if (!v.rec && Array.isArray(p.standings)) p.standings = p.standings.map(sinRecord);
  if (!v.rec && Array.isArray(p.rounds))
    p.rounds = p.rounds.map(r => ({ ...r, matches: (r.matches || []).map(m => ({ ...m, ...(m.p1rec !== undefined ? { p1rec: soloPts(m.p1rec) } : {}), ...(m.p2rec !== undefined ? { p2rec: soloPts(m.p2rec) } : {}) })) }));
  return p;
}
