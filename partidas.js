/* partidas.js — «Mis partidas» (como Training Court): cada jugador anota con qué baraja jugó un torneo, contra qué barajas
   y cómo le fue en cada ronda. Puro (sin DOM ni Firebase): lo usan partidas.html (lo de cada uno) y estadisticas.html
   (el recuento del país, solo admins). Se prueba con node (pruebas/probar-partidas.mjs).

   Un torneo anotado, en partidas/<uid>/<id>:
     { f: "2026-11-21", fm: "estandar", tipo: "cup", nombre?, reg?, mia: "Dragapult ex + Dusknoir",
       r: [ { op: "Gardevoir ex", res: "G" }, … ], creado, act }
   res: G ganó, P perdió, E empate, B bye (sin rival: no es partida y no cuenta).
   Las barajas se escriben como las arma arquetipos.js: uno o dos Pokémon con su nombre de carta en inglés, unidos por « + ». */
import { norm } from "./listamazo.js?v=a7d81edb2d2d";

export const TIPOS = { liga: "Liga / torneo local", challenge: "League Challenge", cup: "League Cup", regional: "Regional",
  especial: "Especial", internacional: "Internacional o Mundial", casual: "Casual / práctica", otro: "Otro" };
export const RES = { G: "Gané", P: "Perdí", E: "Empate", B: "Bye" };
export const MAX_RONDAS = 20;

/* Los nombres de los Pokémon de la base (en inglés y en castellano) → el de la carta en inglés, para que «dragapult EX»,
   «Dragapult ex» y su nombre en castellano sean la misma baraja en el recuento. */
export function vocabulario(base){
  const v = new Map();
  if (!base) return v;
  for (const c of base.cartas) if (c[3] === "P"){ const en = c[2]; if (!v.has(norm(en))) v.set(norm(en), en); }
  for (const [en, es] of base.esN || []) if (v.has(norm(en)) && !v.has(norm(es))) v.set(norm(es), en);
  return v;
}
/* Lo que tipeó el jugador → la baraja: hasta dos Pokémon, cada uno con su nombre de la base si lo encuentra. */
export function canonica(texto, voc){
  return String(texto || "").split(/\s*[+/]\s*/).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 2)
    .map(s => (voc && voc.get(norm(s))) || (s.charAt(0).toUpperCase() + s.slice(1)).replace(/\s+ex$/i, " ex")).join(" + ").slice(0, 80);
}

/* Los rondas que son partida (sin byes ni rival vacío). */
const jugadas = reg => (reg.r || []).filter(x => x && x.res !== "B" && x.op);
export const record = reg => { const o = { G: 0, P: 0, E: 0 }; jugadas(reg).forEach(x => { if (x.res in o) o[x.res]++; }); return o; };
export const wr = o => { const n = o.G + o.P + o.E; return n ? o.G / n : null; };

/* El resumen de muchos torneos anotados: por baraja, cuántos torneos, su récord y winrate, y contra qué barajas.
   espejos: false deja fuera las partidas contra la misma baraja del winrate (no dicen nada de ella), como el meta del torneo.
   Los empates cuentan como jugadas no ganadas. jugadores: cuántas personas distintas (si cada torneo trae su uid en «u»). */
export function resumen(regs, { espejos = true } = {}){
  const por = new Map();
  const de = k => por.get(k) || (por.set(k, { baraja: k, torneos: 0, jugadores: new Set(), G: 0, P: 0, E: 0, vs: new Map(), enfrentada: 0 }), por.get(k));
  for (const reg of regs){
    if (!reg || !reg.mia) continue;
    const d = de(reg.mia); d.torneos++; if (reg.u) d.jugadores.add(reg.u);
    for (const x of jugadas(reg)){
      if (!(x.res in { G: 1, P: 1, E: 1 })) continue;
      de(x.op).enfrentada++;
      const m = d.vs.get(x.op) || (d.vs.set(x.op, { G: 0, P: 0, E: 0 }), d.vs.get(x.op)); m[x.res]++;
      if (espejos || x.op !== reg.mia) d[x.res]++;
    }
  }
  return [...por.values()].map(d => ({ ...d, jugadores: d.jugadores.size, wr: wr(d),
    vs: [...d.vs].map(([op, o]) => ({ op, ...o, n: o.G + o.P + o.E, wr: wr(o) })).sort((a, b) => b.n - a.n || (a.op < b.op ? -1 : 1)) }))
    .sort((a, b) => b.torneos - a.torneos || b.enfrentada - a.enfrentada || (a.baraja < b.baraja ? -1 : 1));
}
export const pctTxt = x => x == null ? "—" : Math.round(100 * x) + "%";
export const recTxt = o => o.G + "-" + o.P + (o.E ? "-" + o.E : "");
