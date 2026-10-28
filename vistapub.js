/* ▌ÍNDICE de vistapub.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Qué ven los jugadores
*/
/* ============================================================
   vistapub.js — qué de los emparejamientos ven los jugadores
   ------------------------------------------------------------
   Versión actual: v=2   (subir el ?v= al tocar este archivo)

   La tienda elige (salas/<tienda>/vistaJugadores = { pos, pts, rec, pct }):
     · pos: la pestaña «Posiciones». Apagada, la clasificación NO se publica (no solo se esconde: quien abra la consola
       del navegador tampoco la encuentra), así los jugadores no calculan desempates.
     · pts: los puntos de cada jugador (en las mesas y en las posiciones). Apagados, no se publican: así los jugadores no
       pueden ordenarse entre ellos mesa a mesa.
     · rec: el récord (G-P-E) de cada jugador. Apagado, no se publica.
     · pct: el % de victorias que sale junto al récord. Se calcula del récord: es solo de pantalla.
   Ojo: puntos y récord se calculan uno del otro (3 por victoria, 1 por empate). Para que nadie pueda sacar los puntos,
   hay que apagar los dos. Por defecto se ve la clasificación y el récord, y no los puntos ni el %.
   Lo usan el panel (al publicar) y las vistas de los jugadores y de la tele.
   ============================================================ */

/* ▌BLOQUE 1 · Qué ven los jugadores ═════════════════════════════════════════════
   Los tres valores (posiciones, récord, %) con sus defectos y la copia de los emparejamientos sin
   lo que la tienda decidió no mostrar. */
export const VISTA_DEF = { pos: true, pts: false, rec: true, pct: false };
export const vistaDe = v => v && typeof v === "object" ? { pos: v.pos !== false, pts: v.pts === true, rec: v.rec !== false, pct: v.pct === true } : { ...VISTA_DEF };

/* La ficha de una mesa (p1rec/p2rec) con solo lo que se muestra; sin nada, no hay ficha. */
const ficha = (r, v) => {
  if (!r || typeof r !== "object") return r;
  const o = {};
  if (v.rec){ if (r.w !== undefined) o.w = r.w; if (r.l !== undefined) o.l = r.l; if (r.t !== undefined) o.t = r.t; }
  if (v.pts && r.pts !== undefined) o.pts = r.pts;
  return Object.keys(o).length ? o : undefined;
};
/* Una fila de posiciones: siempre puesto, nombre y categoría; el récord y los puntos, si se muestran. */
const fila = (f, v) => { const { w, l, t, pts, ...resto } = f; return { ...resto, ...(v.rec ? { w, l, t } : {}), ...(v.pts ? { pts } : {}) }; };

/* Lo que se publica de `pairings` (no toca el original: el panel lo sigue usando entero para archivar). */
export function publicable(pairings, vista){
  if (!pairings) return pairings;
  const v = vistaDe(vista), p = { ...pairings };
  if (!v.pos) delete p.standings;
  else if (Array.isArray(p.standings) && !(v.rec && v.pts)) p.standings = p.standings.map(f => fila(f, v));
  if (!(v.rec && v.pts) && Array.isArray(p.rounds))
    p.rounds = p.rounds.map(r => ({ ...r, matches: (r.matches || []).map(m => {
      const { p1rec, p2rec, ...resto } = m, a = ficha(p1rec, v), b = ficha(p2rec, v);
      return { ...resto, ...(a !== undefined ? { p1rec: a } : {}), ...(b !== undefined ? { p2rec: b } : {}) };
    }) }));
  return p;
}
