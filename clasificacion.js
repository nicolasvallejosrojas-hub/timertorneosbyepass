/* ▌ÍNDICE de clasificacion.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Meses y puntos
    2. Quién es cada fila
    3. Clasificar
*/
/* ============================================================
   clasificacion.js — la clasificación mensual de una tienda
   ------------------------------------------------------------
   Versión actual: v=3   (subir el ?v= al tocar este archivo)

   La usan la vista de jugadores (pestaña Ranking) y el perfil de la tienda.
   Vive acá para que las dos sumen igual: dos copias de esta cuenta terminan
   dando dos tablas distintas del mismo mes.
   ============================================================ */

/* ▌BLOQUE 1 · Meses y puntos ════════════════════════════════════════════════════
   Nombres de mes, puntos por puesto por defecto, mes y timer de cada torneo. */
export const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio",
                      "agosto","septiembre","octubre","noviembre","diciembre"];
export function nombreMes(m){
  const [a, mm] = m.split("-");
  return MESES[parseInt(mm, 10) - 1] + " " + a;
}

/* ▌BLOQUE 2 · Quién es cada fila ════════════════════════════════════════════════
   claveJugador: la persona es su ID de Play! Pokémon (clave al azar que pone el panel); sin clave,
   el nombre sin tildes. claveGlobal: lo mismo para juntar tiendas (la cuenta une). */
/* Quién es cada fila. La persona es su ID de Play! Pokémon: el panel le pone a cada
   fila con ID una «clave» al azar (la misma para todas las filas de ese ID,
   escritas como estén; ver jugadores.js). Dos nombres con la misma clave son
   la misma persona; el mismo nombre con claves distintas, dos personas.
   `claveN` es la provisional de las filas sin ID (solo si su nombre calza con
   una persona). Sin ninguna, se sigue por nombre sin tildes ni mayúsculas, y
   los reservados (todos dicen «Jugador reservado») por su uid. */
const sinTildes = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
export const claveJugador = p => (p.clave || p.claveN) ? "c:" + (p.clave || p.claveN)
  : p.reservado && p.uid ? "u:" + p.uid : sinTildes(p.name);
/* Para juntar tiendas distintas (directorio, estadísticas): la cuenta (uid) es la misma
   persona en todas; la clave solo vale dentro de su tienda. */
export const claveGlobal = (tienda, p) => p.uid ? "u:" + p.uid : (p.clave || p.claveN) ? tienda + "|c:" + (p.clave || p.claveN) : sinTildes(p.name);

export const PUNTOS_DEF = { puntos: [12, 10, 8, 7, 6, 5, 4, 3], resto: 1 };

/* El mes se saca de la fecha si falta: con UN solo torneo sin el campo, la
   pestaña entera se caía en nombreMes(undefined). */
export const mesDe = t => t.mes || String(t.fecha || "").slice(0, 7);

/* Desde el 01-10-2026 cada timer de la tienda tiene su propia tabla, con el
   nombre del timer. El torneo guarda de qué timer salió (timer: 2..5); sin el
   campo es del 1, que es de donde salían todos antes. */
export const timerDe = t => t.timer || 1;
export const deTimer = (torneos, n) => torneos.filter(t => timerDe(t) === n);

/* Los meses con torneos, del más nuevo al más viejo. */
export const mesesDe = torneos => [...new Set(torneos.map(mesDe).filter(Boolean))].sort().reverse();

/* ▌BLOQUE 3 · Clasificar ════════════════════════════════════════════════════════
   Suma puntos por jugador en el mes, agrupando por claveJugador (mismo ID = una fila aunque cambie
   el nombre; se muestra el del último torneo) y ordena la tabla. */
export function puntosPorPuesto(place, cfg = PUNTOS_DEF){
  const p = cfg.puntos;
  return (place >= 1 && place <= p.length) ? p[place - 1] : (cfg.resto || 0);
}

/* Filas de la tabla del mes, ya ordenadas. */
export function clasificar(torneos, mes, cfg = PUNTOS_DEF){
  const tabla = {};
  /* De más viejo a más nuevo: el nombre que queda en la fila es el del último
     torneo, que es como el jugador se escribe hoy. */
  torneos.filter(t => mesDe(t) === mes)
    .sort((x, y) => (x.fecha || "").localeCompare(y.fecha || "") || (x.creado || 0) - (y.creado || 0))
    .forEach(t => (t.standings || []).forEach(p => {
    const k = claveJugador(p);
    if (!tabla[k]) tabla[k] = { name: p.name, uid: p.uid || null, reservado: !!p.reservado,
                                pts: 0, torneos: 0, mejor: 99, w: 0, l: 0, e: 0 };
    const r = tabla[k];
    r.name = p.name; r.reservado = !!p.reservado; if (p.uid) r.uid = p.uid;
    r.pts += puntosPorPuesto(p.place, cfg);
    r.torneos++;
    r.mejor = Math.min(r.mejor, p.place);
    r.w += p.w || 0; r.l += p.l || 0; r.e += p.t || 0;
  }));
  const filas = Object.values(tabla)
    .sort((a, b) => b.pts - a.pts || a.mejor - b.mejor || b.w - a.w || a.name.localeCompare(b.name));
  /* Porcentaje de victorias del mes: se suman TODAS las partidas de todos los
     torneos y se divide una sola vez. Así un torneo de 7 rondas pesa más que
     uno de 3, que es lo justo. El empate vale media victoria. */
  filas.forEach(r => {
    r.jugadas = r.w + r.l + r.e;
    r.wr = r.jugadas ? ((r.w + r.e / 2) / r.jugadas * 100) : null;
  });
  return filas;
}
