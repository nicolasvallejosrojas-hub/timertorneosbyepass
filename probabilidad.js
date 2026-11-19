/* ▌ÍNDICE de probabilidad.js
    1. Exacto: hipergeométrica condicionada al mulligan
    2. Simulación: metas con varias condiciones
*/
/* ============================================================
   probabilidad.js — qué tan seguido sale lo que el mazo necesita
   ------------------------------------------------------------
   Sin DOM ni Firebase: lo usa probar.js y se prueba con node (pruebas/probar-probabilidad.mjs).

   En Pokémon, una mano sin Pokémon Básico se vuelve a repartir (mulligan): la mano que de verdad se
   juega SIEMPRE tiene un Básico. Por eso todo se condiciona a eso (P(A | mano con Básico)), si no los
   números salen corridos. Los premios (6) se apartan después de la mano; robar en cada turno es tomar
   la siguiente carta del mazo, y como el orden es al azar, da lo mismo que los premios estén antes.
   Los dos jugadores roban en su turno 1: «turno n» = 7 + n cartas vistas.
   ============================================================ */

/* ▌BLOQUE 1 · Exacto ════════════════════════════════════════════════════════════ */
const LF = [0];
for (let i = 1; i <= 200; i++) LF[i] = LF[i - 1] + Math.log(i);
/* Combinaciones, con logaritmos para que no se desborde. */
export const C = (n, k) => k < 0 || n < 0 || k > n ? 0 : Math.exp(LF[n] - LF[k] - LF[n - k]);

/* Probabilidad de que la mano de 7 tenga al menos un Básico (b Básicos en un mazo de N). */
export const valida = (N, b) => 1 - C(N - b, 7) / C(N, 7);
export const mulligan = (N, b) => 1 - valida(N, b);

/* Al menos una de t cartas buscadas (tb de ellas son Básicos) en las primeras `vistas` cartas, dada una
   mano válida. P(sin buscadas) − P(sin buscadas y mano sin Básicos), sobre P(mano válida). */
export function alMenosUna({ N, t, tb = 0, b, vistas = 7 }){
  if (t <= 0) return 0;
  const u = t + b - tb, noT = C(N - t, vistas) / C(N, vistas);
  const noTnoB = C(N - u, 7) / C(N, 7) * C(N - 7 - t, vistas - 7) / C(N - 7, vistas - 7);
  return Math.min(1, Math.max(0, 1 - (noT - noTnoB) / valida(N, b)));
}

/* Premios: se recorre cada mano válida posible (buscadas que son Básicos, otros Básicos, otras buscadas,
   resto) y, con lo que queda en el mazo, cuántas buscadas caen en los 6 premios.
   al1: al menos una en premios; todas: todas las copias en premios. */
export function premios({ N, t, tb = 0, b }){
  const O = N - t - b + tb, resto = N - 7, v = valida(N, b), dist = Array(Math.min(t, 6) + 1).fill(0);
  for (let a = 0; a <= Math.min(tb, 7); a++) for (let bb = 0; bb <= Math.min(b - tb, 7 - a); bb++)
    for (let c = 0; c <= Math.min(t - tb, 7 - a - bb); c++){
      const o = 7 - a - bb - c;
      if (o > O || a + bb < 1) continue;
      const p = C(tb, a) * C(b - tb, bb) * C(t - tb, c) * C(O, o) / C(N, 7) / v, quedan = t - a - c;
      for (let k = 0; k <= Math.min(quedan, 6); k++) dist[k] += p * C(quedan, k) * C(resto - quedan, 6 - k) / C(resto, 6);
    }
  /* al1: al menos una en premios; todas: todas las copias en premios; dist[k]: exactamente k en premios */
  return { al1: 1 - dist[0], todas: t <= 6 ? dist[t] : 0, dist };
}

/* Cuántos Básicos trae, en promedio, una mano que se juega. */
export function promedioBasicos(N, b){
  let s = 0;
  for (let k = 1; k <= 7; k++) s += k * C(b, k) * C(N - b, 7 - k) / C(N, 7);
  return s / valida(N, b);
}

/* Cuántos Básicos trae una mano que se juega: dist[k] = P(exactamente k), k = 1…7. */
export function distBasicos(N, b){
  const v = valida(N, b), dist = [0];
  for (let k = 1; k <= 7; k++) dist[k] = C(b, k) * C(N - b, 7 - k) / C(N, 7) / v;
  return dist;
}
/* Que todos los Básicos de la mano sean de los «malos para empezar» (m copias entre los b Básicos):
   el Activo inicial sale sí o sí de ahí. */
export function soloMalos(N, b, m){
  let s = 0;
  for (let k = 1; k <= Math.min(7, m); k++) s += C(m, k) * C(N - b, 7 - k) / C(N, 7);
  return s / valida(N, b);
}
/* Energías (e cartas de Energía, que no son Básicos) en una mano que se juega: dist[j] = P(exactamente j),
   j = 0…6 (con al menos un Básico, la mano tiene a lo más 6 Energías). */
export function energiasDist(N, b, e){
  const O = N - b - e, v = valida(N, b), dist = Array(7).fill(0);
  for (let k = 1; k <= 7; k++) for (let j = 0; j <= 7 - k; j++){
    if (7 - k - j > O) continue;
    dist[j] += C(b, k) * C(e, j) * C(O, 7 - k - j) / C(N, 7) / v;
  }
  return dist;
}
/* Sin ninguna Energía, o con 3 o más. */
export function energias(N, b, e){
  const d = energiasDist(N, b, e);
  return { sin: d[0], muchas: d.slice(3).reduce((x, y) => x + y, 0) };
}
/* Mulligans por partida, en promedio (cada uno le da una carta extra al rival). */
export const mulligansPromedio = (N, b) => mulligan(N, b) / valida(N, b);

/* ▌BLOQUE 2 · Simulación ════════════════════════════════════════════════════════
   Para las metas con varias condiciones juntas («Caramelo Raro y una Fase 2 al turno 2»), donde el
   cálculo exacto se vuelve un enredo. mazo: arreglo con un índice de carta por copia; esBasico[i]: si la
   carta i es Pokémon Básico; reqs: [[índices]…], cada requisito se cumple con al menos una de sus cartas,
   y la meta pide todos. Devuelve la probabilidad y su margen al 95 % (±1,96 errores estándar). */
export function simular({ mazo, esBasico, reqs, turno = 0, veces = 100000, azar = Math.random }){
  const m = mazo.slice(), n = m.length, hasta = Math.min(n, 13 + turno), sets = reqs.map(r => new Set(r));
  if (n < 13 || !mazo.some(i => esBasico[i])) return { p: 0, mas: 0 };
  let ok = 0;
  for (let v = 0; v < veces; v++){
    let conB;
    do {
      for (let i = n - 1; i > 0; i--){ const j = azar() * (i + 1) | 0, x = m[i]; m[i] = m[j]; m[j] = x; }
      conB = false; for (let k = 0; k < 7 && !conB; k++) conB = esBasico[m[k]];
    } while (!conB);
    let cumple = true;
    for (const s of sets){
      let hay = false;
      for (let k = 0; k < hasta && !hay; k++) if ((k < 7 || k >= 13) && s.has(m[k])) hay = true;   // 7..12: premios
      if (!hay){ cumple = false; break; }
    }
    if (cumple) ok++;
  }
  const p = ok / veces;
  return { p, mas: 1.96 * Math.sqrt(p * (1 - p) / veces) };
}

/* Baraja una mano para la mesa de prueba: hace los mulligans que hagan falta y aparta los premios. */
export function repartir(mazo, esBasico, azar = Math.random){
  const pila = mazo.slice();
  let mulligans = -1;
  if (!mazo.some(i => esBasico[i])) return null;
  do {
    mulligans++;
    for (let i = pila.length - 1; i > 0; i--){ const j = azar() * (i + 1) | 0, x = pila[i]; pila[i] = pila[j]; pila[j] = x; }
  } while (!pila.slice(0, 7).some(i => esBasico[i]));
  return { mano: pila.slice(0, 7), premios: pila.slice(7, 13), pila: pila.slice(13), mulligans };
}
