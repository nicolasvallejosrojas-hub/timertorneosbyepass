/* arquetipos.js — qué baraja es una lista y de qué región viene (puro, sin Firebase ni DOM; lo usa estadisticas.html).
   La lista se lee con armarCartas (nombres pasados a inglés, así «Dragapult ex» cuenta igual escrita en castellano). */
import { armarCartas } from "./analisis.js?v=873cc28a8e2f";

export const REGIONES = ["Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana de Santiago",
  "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"];

/* Los Pokémon de una lista como [{n, c, b}] (nombre en inglés, copias, si es Básico): lo único que se guarda de cada lista. */
export const pokemonDe = (lista, base) => {
  const por = new Map();
  armarCartas(lista, base).CARTAS.filter(c => c.sec === "Pokémon").forEach(c => {
    const f = por.get(c.en) || { n: c.en, c: 0, ...(c.basico ? { b: 1 } : {}) };
    f.c += c.cant; por.set(c.en, f);
  });
  return [...por.values()];
};

const FUERTE = /(?:^Mega |\b(?:ex|V|VSTAR|VMAX|GX)$)/;
/* La insignia de una baraja: el Pokémon (o los dos) que más pesa. Peso = copias + 3 si es ex/Mega… + 1 si no es Básico (una
   línea evolutiva pesa en su última etapa). Solo cuentan los de 2 copias o más. El segundo entra solo si pesa al menos 75 % del
   primero, lleva 3 copias o más y no es un Básico común (ese suele ser la pre-evolución: Pawniard en Kingambit, Electrike en Manectric).
   ponytail: heurística, no conoce el meta; un compañero de apoyo con muchas copias puede colarse. Se afina con las cifras reales. */
export function clasificar(pk){
  const cand = (pk || []).filter(p => p.c >= 2).map(p => ({ n: p.n, c: p.c, b: p.b, peso: p.c + (FUERTE.test(p.n) ? 3 : 0) + (p.b ? 0 : 1) }))
    .sort((a, b) => b.peso - a.peso || (a.n < b.n ? -1 : 1));
  if (!cand.length) return { insignia: [], arquetipo: "Sin clasificar" };
  const segundo = cand.slice(1).find(p => p.peso >= cand[0].peso * 0.75 && p.c >= 3 && (FUERTE.test(p.n) || !p.b));
  const insignia = [cand[0].n, ...(segundo ? [segundo.n] : [])];
  return { insignia, arquetipo: insignia.join(" + ") };
}

/* Un número corto y estable a partir de un texto (para no guardar el uid de quien inscribió la lista). */
export const hash = s => { let h = 5381; for (const ch of String(s)) h = (h * 33 ^ ch.charCodeAt(0)) >>> 0; return h.toString(36); };

if (typeof process !== "undefined" && process.argv[1] && process.argv[1].endsWith("arquetipos.js")){
  const a = clasificar([{ n: "Dreepy", c: 4, b: 1 }, { n: "Drakloak", c: 3, b: 0 }, { n: "Dragapult ex", c: 3, b: 0 }, { n: "Munkidori", c: 1, b: 1 }]);
  console.assert(a.arquetipo === "Dragapult ex", a.arquetipo);
  console.assert(clasificar([{ n: "Pidgey", c: 1, b: 1 }]).arquetipo === "Sin clasificar");
}
