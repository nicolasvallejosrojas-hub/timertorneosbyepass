/* ============================================================
   analisis.js — de una lista de mazo a las cartas con las que calculan Probar mazo y Comparar
   ------------------------------------------------------------
   armarCartas(lista, base) lee la lista y deja, por carta: nombre (como está escrito en la lista), en (su nombre en inglés,
   de la base: así una lista en castellano y otra en inglés se pueden comparar), cant, sec, basico, foto, set, num, x, reg.
   También el mazo como arreglo de índices (MAZO) para simular, y los totales N (cartas), B (Pokémon Básicos), E (Energías).
   ============================================================ */
import { leerLista, imagenCarta } from "./listamazo.js?v=11231c1e2ccf";
import { simular } from "./probabilidad.js?v=11231c1e2ccf";

const sinCeros = n => String(n || "").replace(/^0+(?=\d)/, "");

export function armarCartas(lista, base){
  const r = leerLista(lista, base);
  const CARTAS = [...r.pokemon.map(c => ({ ...c, sec: "Pokémon" })), ...r.entrenador.map(c => ({ ...c, sec: "Entrenador" })), ...r.energia.map(c => ({ ...c, sec: "Energía" }))]
    .map((c, i) => ({ ...c, i, foto: c.set ? imagenCarta(base, c.set, c.num) : "", basico: c.x === "B" && c.sec === "Pokémon" }));
  const INGLES = new Map((base && base.cartas || []).map(c => [c[0] + " " + sinCeros(c[1]), c[2]]));
  CARTAS.forEach(c => { c.en = INGLES.get(c.set + " " + sinCeros(c.num)) || c.nombre; });
  const N = CARTAS.reduce((s, c) => s + c.cant, 0), B = CARTAS.filter(c => c.basico).reduce((s, c) => s + c.cant, 0);
  const E = CARTAS.filter(c => c.sec === "Energía").reduce((s, c) => s + c.cant, 0);
  return { CARTAS, N, B, E, MAZO: CARTAS.flatMap(c => Array(c.cant).fill(c.i)), ES_B: CARTAS.map(c => c.basico), errores: r.errores, avisos: r.avisos };
}
/* ¿Se puede probar? (al menos 13 cartas: la mano y los premios; y un Básico). Da el motivo si no. */
export const motivoNoSePuede = a => a.N < 13 ? "La lista tiene " + a.N + " cartas: para probarla hacen falta al menos 13 (la mano y los premios)."
  : !a.B ? "No encontramos ningún Pokémon Básico en la lista, así que toda mano sería mulligan. Revisa que los Pokémon tengan su expansión y número." : "";

/* Una meta (requisitos por nombre en inglés) simulada sobre una lista. falta: algún requisito no tiene ninguna carta en esa lista. */
export function simularMetaEn(a, reqsEn, turno, veces = 50000){
  const sets = reqsEn.map(r => a.CARTAS.filter(c => c.cant > 0 && r.includes(c.en)).map(c => c.i));
  if (sets.some(s => !s.length)) return { p: 0, mas: 0, falta: true };
  return simular({ mazo: a.MAZO, esBasico: a.ES_B, reqs: sets, turno, veces });
}
/* Los nombres de una meta guardada (como estaban en la lista donde se hizo) pasados a inglés con las cartas de esa lista. */
export const metaAEn = (a, meta) => meta.reqs.map(r => r.map(n => (a.CARTAS.find(c => c.nombre === n) || { en: n }).en));
