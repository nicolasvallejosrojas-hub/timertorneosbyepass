/* partidas.js — «Mis partidas» (como Training Court): cada jugador anota con qué baraja jugó un torneo, contra qué barajas
   y cómo le fue en cada ronda. Puro (sin DOM ni Firebase): lo usan partidas.html (lo de cada uno) y estadisticas.html
   (el recuento del país, solo admins). Se prueba con node (pruebas/probar-partidas.mjs).

   Un torneo anotado, en partidas/<uid>/<id>:
     { f: "2026-11-21", fm: "estandar", tipo: "cup", nombre?, reg?, mia: "Dragapult ex + Dusknoir",
       r: [ { op: "Gardevoir ex", res: "G" }, … ], creado, act }
   res: G ganó, P perdió, E empate, B bye (sin rival: no es partida y no cuenta).
   Las barajas se escriben como las arma arquetipos.js: uno o dos Pokémon con su nombre de carta en inglés, unidos por « + ». */
import { norm } from "./listamazo.js?v=e78d9286eec9";
import { REGIONES } from "./arquetipos.js?v=e78d9286eec9";

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
   Los empates cuentan como jugadas no ganadas. jugadores: cuántas personas distintas (si cada torneo trae su uid en «u»).
   p1 / p2: el récord empezando primero o segundo (las rondas que lo dicen). versiones: una por lista distinta (la copia que
   guardó el torneo), con su récord, para ver cómo le fue a cada versión. */
export function resumen(regs, { espejos = true } = {}){
  const por = new Map();
  const cero = () => ({ G: 0, P: 0, E: 0 });
  const de = k => por.get(k) || (por.set(k, { baraja: k, torneos: 0, jugadores: new Set(), G: 0, P: 0, E: 0, vs: new Map(), enfrentada: 0, p1: cero(), p2: cero(), versiones: new Map() }), por.get(k));
  for (const reg of regs){
    if (!reg || !reg.mia) continue;
    const d = de(reg.mia); d.torneos++; if (reg.u) d.jugadores.add(reg.u);
    const v = reg.lista ? d.versiones.get(huella(reg.lista)) || (d.versiones.set(huella(reg.lista), { lista: reg.lista, nombre: reg.mazoNom || "", desde: reg.f, torneos: 0, ...cero() }), d.versiones.get(huella(reg.lista))) : null;
    if (v){ v.torneos++; if (reg.f < v.desde) v.desde = reg.f; }
    for (const x of jugadas(reg)){
      if (!(x.res in { G: 1, P: 1, E: 1 })) continue;
      de(x.op).enfrentada++;
      const m = d.vs.get(x.op) || (d.vs.set(x.op, { G: 0, P: 0, E: 0 }), d.vs.get(x.op)); m[x.res]++;
      if (espejos || x.op !== reg.mia){ d[x.res]++; if (x.pr === 1 || x.pr === 2) d["p" + x.pr][x.res]++; if (v) v[x.res]++; }
    }
  }
  return [...por.values()].map(d => ({ ...d, jugadores: d.jugadores.size, wr: wr(d),
    versiones: [...d.versiones.values()].sort((a, b) => a.desde < b.desde ? -1 : 1),
    vs: [...d.vs].map(([op, o]) => ({ op, ...o, n: o.G + o.P + o.E, wr: wr(o) })).sort((a, b) => b.n - a.n || (a.op < b.op ? -1 : 1)) }))
    .sort((a, b) => b.torneos - a.torneos || b.enfrentada - a.enfrentada || (a.baraja < b.baraja ? -1 : 1));
}
/* La misma lista escrita igual da la misma huella (sin espacios de más ni líneas vacías). */
const huella = lista => String(lista).split(/\r?\n/).map(l => l.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n");
export const pctTxt = x => x == null ? "—" : Math.round(100 * x) + "%";
export const recTxt = o => o.G + "-" + o.P + (o.E ? "-" + o.E : "");

/* ── Desde los torneos de ByePass ── Las partidas archivadas ([ronda, a, b, g], a/b = índice en la tabla final; g: 1 ganó a,
   2 ganó b, 0 empate, 3 doble derrota) vistas por la fila «yo». barajas[i] = la baraja de la fila i (de su lista de inscripción)
   o "": sin ella, la ronda va sin rival y el jugador lo escribe. Los byes no se archivan. */
export function rondasDesde(partidas, yo, barajas = []){
  return Object.values(partidas || {}).filter(p => p && (p[1] === yo || p[2] === yo)).sort((x, y) => x[0] - y[0])
    .map(([, a, b, g]) => { const otro = a === yo ? b : a, res = g === 0 ? "E" : g === 3 ? "P" : (g === 1) === (a === yo) ? "G" : "P";
      return barajas[otro] ? { op: barajas[otro], res } : { res }; });
}
/* El tipo de la agenda («League Cup», «Liga de los sábados»…) → el de Mis partidas. */
export const tipoDe = s => /cup/i.test(s || "") ? "cup" : /challenge/i.test(s || "") ? "challenge" : /regional/i.test(s || "") ? "regional" : "liga";
/* Un torneo anotado es «verificado» si sus partidas (sin byes) son las que archivó la tienda: mismos resultados, en orden, y el
   mismo rival donde la tienda lo sabía. La baraja propia se puede corregir (la lista no siempre la dice bien). */
export function verificada(g, pre){
  if (!g || !pre || !pre.r) return false;
  const mias = (g.r || []).filter(x => x && x.res !== "B"), suyas = Object.values(pre.r);
  return mias.length === suyas.length && suyas.every((x, i) => mias[i].res === x.res && (!x.op || mias[i].op === x.op));
}

/* ── El meta que se publica (metaPublico/<AAAA-MM>, lo lee cualquiera en meta-chile.html) ── De los torneos de UN mes (cada uno
   con su «u», para contar personas, y «ver» si es verificado): por baraja, torneos, jugadores, récord sin espejos, «como rival» y sus
   enfrentamientos; y las 5 más jugadas de cada región. Sin cuentas ni nombres. La región solo si es una de las 16 (es una clave). */
export function instantanea(regs){
  const limpio = o => ({ G: o.G, P: o.P, E: o.E }), regDe = g => REGIONES.includes(g.reg) ? g.reg : "Sin región";
  const R = resumen(regs, { espejos: false }).filter(d => d.torneos), reg = {};
  for (const r of new Set(regs.map(regDe))) reg[r] = resumen(regs.filter(g => regDe(g) === r)).filter(d => d.torneos).slice(0, 5).map(d => ({ b: d.baraja, t: d.torneos }));
  return { torneos: regs.length, jugadores: new Set(regs.map(g => g.u)).size, verif: regs.filter(g => g.ver).length, reg,
    b: R.slice(0, 25).map(d => ({ b: d.baraja, t: d.torneos, j: d.jugadores, ri: d.enfrentada, ...limpio(d), vs: d.vs.slice(0, 12).map(v => ({ op: v.op, ...limpio(v) })) })) };
}
