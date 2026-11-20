/* ▌ÍNDICE de efectos.js
    1. Leer el texto de una carta: cada efecto con sus números
    2. Roles, etiquetas y cuántas cartas quedan en la mano
    3. Qué Pokémon alcanza una búsqueda y qué Energía paga cada tipo
*/
/* ============================================================
   efectos.js — qué hace cada carta, leído del texto de TCGdex (inglés)
   ------------------------------------------------------------
   Sin DOM ni red: lo usan probar.js (motores y atacantes) y comparar.js, y se prueba con node
   (pruebas/probar-efectos.mjs) con textos reales de cartas de Estándar.

   Un texto da una LISTA de efectos, cada uno con sus números, porque una carta puede hacer varias cosas:
     Lillie's Determination → baraja la mano + roba 6 (u 8 con exactamente 6 premios)
     Hilda                  → busca una Evolución + busca una Energía
     Ultra Ball             → cuesta descartar 2 cartas + busca un Pokémon
   Es una lectura por palabras, no por significado: lo que no entiende queda sin rol y el jugador lo corrige
   en la pestaña Motores (esa corrección manda sobre esta lectura).
   ============================================================ */

/* ▌BLOQUE 1 · Leer el texto ═════════════════════════════════════════════════════ */
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const n_ = s => { s = String(s).toLowerCase(); return NUM[s] ?? (+s || 1); };
const CANT = "a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+";
export const TIPO_DE_LETRA = { G: "Grass", R: "Fire", W: "Water", L: "Lightning", P: "Psychic", F: "Fighting", D: "Darkness", M: "Metal", Y: "Fairy", N: "Dragon", C: "Colorless" };
const NOMBRES_TIPO = Object.values(TIPO_DE_LETRA).filter(x => x !== "Colorless");

/* «a Basic Pokémon», «up to 2 Basic Energy cards», «an Evolution Pokémon»: una parte de lo que busca una carta. */
function parteBusca(q){
  q = q.trim();
  const up = new RegExp("up to (" + CANT + ")\\b", "i").exec(q), ini = /^(\d+)\s/.exec(q);
  const n = up ? n_(up[1]) : ini ? +ini[1] : 1;
  let cat;
  if (/energy/i.test(q)) cat = "energia";
  else if (/Pok[eé]mon Tool/i.test(q)) cat = "entrenador";
  else if (/pok[eé]mon|evolution|stage/i.test(q)) cat = "pokemon";
  else if (/\b(item|supporter|stadium|tool|trainer)\b/i.test(q)) cat = "entrenador";
  else cat = "carta";
  const p = { cat, n };
  if (cat === "pokemon"){
    const f = [];
    if (/\bbasic\b/i.test(q)) f.push("Basic");
    if (/stage ?1/i.test(q)) f.push("Stage1");
    if (/stage ?2/i.test(q)) f.push("Stage2");
    if (/\bevolution\b/i.test(q)) f.push("Evolution");
    if (f.length) p.fases = f;
    if (/(?:doesn['’]t|does not|without a?) have a Rule Box|without a Rule Box/i.test(q)) p.sinRegla = true;
    const hp = /(\d+) HP or less/i.exec(q); if (hp) p.hpMax = +hp[1];
    const tl = /\{([GRWLPFDMYN])\}/.exec(q), tn = new RegExp("\\b(" + NOMBRES_TIPO.join("|") + ")\\b", "i").exec(q);
    if (tl) p.tipo = TIPO_DE_LETRA[tl[1]];
    else if (tn) p.tipo = tn[1][0].toUpperCase() + tn[1].slice(1).toLowerCase();
  }
  if (cat === "energia" && /\bbasic\b/i.test(q)) p.basica = true;
  return p;
}

export function leerEfectos(texto){
  const t = String(texto || "").replace(/\s+/g, " ").trim(), ef = [];
  if (!t) return ef;
  let m;
  /* lo que cuesta: «You can use this card only if you discard 2 other cards / another card» */
  if ((m = new RegExp("only if you discard (?:(" + CANT + ") other|another) cards?", "i").exec(t))) ef.push({ t: "costo", n: /another/i.test(m[0]) ? 1 : n_(m[1]) });
  /* qué hace con la mano */
  if (/shuffles? (?:your|their) hand (?:into|and puts it (?:on the bottom of|into)) (?:your|their) deck|shuffle your hand into your deck|put your hand on the bottom of your deck/i.test(t))
    ef.push({ t: "barajaMano", ambos: /each player/i.test(t) });
  if (/discard your hand/i.test(t)) ef.push({ t: "descartaMano" });
  /* robar */
  if ((m = new RegExp("discard up to (" + CANT + ") [^.]*?from your hand,? and draw (" + CANT + ") cards? for each", "i").exec(t))) ef.push({ t: "descartaParaRobar", max: n_(m[1]), n: n_(m[2]) });
  else if ((m = /draw cards? until you have (\d+) cards? in your hand/i.exec(t))) ef.push({ t: "robaHasta", n: +m[1] });
  else if (/draws? (?:a|an|one|\d+) cards? for each (?:of )?(?:their|your) (?:remaining )?Prize|draw (?:a number of )?cards equal to [^.]*Prize|draw as many cards as [^.]*Prize/i.test(t)) ef.push({ t: "robaPremios" });
  else if ((m = new RegExp("draws? (" + CANT + ") cards? for each", "i").exec(t))) ef.push({ t: "robaPorCada", n: n_(m[1]) });
  else if ((m = new RegExp("\\bdraws? (" + CANT + ") cards?\\b", "i").exec(t))){
    const e = { t: "roba", n: n_(m[1]) }, alt = new RegExp("exactly (\\d+) Prize cards? remaining, draw (" + CANT + ") cards? instead", "i").exec(t);
    if (alt){ e.alt = n_(alt[2]); e.si = "exactamente " + alt[1] + " premios"; }
    ef.push(e);
  }
  if ((m = new RegExp("look at the top (" + CANT + ") cards? of your deck", "i").exec(t))) ef.push({ t: "mira", n: n_(m[1]) });
  /* buscar: «Search your deck for <partes>, reveal them / and put it …» */
  for (const s of t.matchAll(/search your deck for ([^.]*?)(?:, reveal| and put | and attach|, and (?:put|attach)|, then|\. |\.$|$)/gi))
    ef.push({ t: "busca", partes: s[1].split(/,\s*(?:and\s+)?|\s+and\s+/i).filter(x => x.trim()).map(parteBusca) });
  if (/\battach\b/i.test(t) && /Energy/i.test(t)) ef.push({ t: "une" });
  /* recuperar del descarte */
  for (const s of t.split(/(?<=\.)\s+/)){
    if (!/from your discard pile/i.test(s) || !/\b(put|shuffle|return|attach|move)\b/i.test(s)) continue;
    ef.push({ t: "recupera", destino: /into your hand/i.test(s) ? "mano" : /into your deck|bottom of your deck|top of your deck/i.test(s) ? "mazo" : "juego",
      energia: /Energy/i.test(s), pokemon: /Pok[eé]mon(?! Tool)/i.test(s) });
  }
  for (const s of t.split(/(?<=\.)\s+/)) if (/\bswitch\b/i.test(s)){ ef.push({ t: "cambia", atrae: /opponent/i.test(s) }); break; }
  return ef;
}

/* ▌BLOQUE 2 · Roles, etiquetas y cartas en la mano ══════════════════════════════ */
export const ROLES = {
  robo: "Roba cartas", mira: "Mira el mazo", buscaPokemon: "Busca Pokémon", buscaEnergia: "Busca Energía", buscaEntrenador: "Busca Entrenadores",
  buscaCarta: "Busca otra carta", une: "Une Energía", recupera: "Recupera del descarte", cambia: "Cambia o atrae Pokémon",
};
const ROL_DE_CAT = { pokemon: "buscaPokemon", energia: "buscaEnergia", entrenador: "buscaEntrenador", carta: "buscaCarta" };
export function rolesDe(ef){
  const r = new Set();
  for (const e of ef){
    if (["roba", "robaHasta", "robaPorCada", "robaPremios", "descartaParaRobar"].includes(e.t)) r.add("robo");
    else if (e.t === "mira") r.add("mira");
    else if (e.t === "busca") e.partes.forEach(p => r.add(ROL_DE_CAT[p.cat]));
    else if (e.t === "une") r.add("une");
    else if (e.t === "recupera") r.add("recupera");
    else if (e.t === "cambia") r.add("cambia");
  }
  return [...r];
}

const FASE = { Basic: "Básico", Stage1: "de Fase 1", Stage2: "de Fase 2", Evolution: "de Evolución" };
const cartas_ = n => n + (n === 1 ? " carta" : " cartas");
function textoParte(p){
  if (p.cat === "pokemon"){
    const fases = (p.fases || []).map(f => FASE[f]).join(" o ");
    return (p.n > 1 ? "hasta " + p.n : "un") + " Pokémon" + (fases ? " " + fases : "") + (p.tipo ? " de tipo " + p.tipo : "") + (p.sinRegla ? " sin regla" : "") + (p.hpMax ? " de " + p.hpMax + " PS o menos" : "");
  }
  if (p.cat === "energia") return (p.n > 1 ? "hasta " + p.n : "una") + (p.basica ? " Energía básica" : " Energía");
  if (p.cat === "entrenador") return (p.n > 1 ? "hasta " + p.n : "un") + " Entrenador";
  return (p.n > 1 ? "hasta " + p.n : "una") + " carta";
}
/* Etiquetas para mostrar: [{ t: texto, c: color }]. Colores: rojo = roba, azul = la mano, verde = busca, amar = cuesta o depende. */
export function etiquetas(ef){
  const o = [];
  for (const e of ef){
    if (e.t === "costo") o.push({ t: "Cuesta: descartar " + cartas_(e.n), c: "amar" });
    else if (e.t === "barajaMano") o.push({ t: e.ambos ? "Cada jugador baraja su mano" : "Baraja tu mano al mazo", c: "azul" });
    else if (e.t === "descartaMano") o.push({ t: "Descarta tu mano", c: "azul" });
    else if (e.t === "roba"){ o.push({ t: "Roba " + e.n, c: "rojo" }); if (e.alt) o.push({ t: "u " + e.alt + " si te quedan " + e.si, c: "amar" }); }
    else if (e.t === "robaHasta") o.push({ t: "Roba hasta tener " + e.n, c: "rojo" });
    else if (e.t === "robaPorCada") o.push({ t: "Roba " + e.n + " por cada algo", c: "rojo" });
    else if (e.t === "robaPremios") o.push({ t: "Roba según tus premios", c: "rojo" });
    else if (e.t === "descartaParaRobar") o.push({ t: "Descarta hasta " + e.max + " y roba " + e.n + " por cada una", c: "rojo" });
    else if (e.t === "mira") o.push({ t: "Mira las " + e.n + " primeras del mazo", c: "rojo" });
    else if (e.t === "busca") e.partes.forEach(p => o.push({ t: "Busca " + textoParte(p), c: "verde" }));
    else if (e.t === "une") o.push({ t: "Une Energía", c: "verde" });
    else if (e.t === "recupera") o.push({ t: "Recupera " + (e.energia ? "Energía" : e.pokemon ? "Pokémon" : "cartas") + " del descarte", c: "verde" });
    else if (e.t === "cambia") o.push({ t: e.atrae ? "Atrae un Pokémon rival" : "Cambia tu Pokémon", c: "azul" });
  }
  return o;
}
/* Cartas que te quedan en la mano después de jugarlo, si al soltarlo tenías «m» (sin contar la carta misma).
   null: no se puede calcular (depende de los premios, de lo que descartes…) o no se puede jugar con tan pocas cartas. */
export function manoDespues(ef, m){
  let h = m;
  const costo = ef.find(e => e.t === "costo");
  if (costo){ if (m < costo.n) return null; h -= costo.n; }
  if (ef.some(e => e.t === "barajaMano" || e.t === "descartaMano")) h = 0;
  let roba = false;
  for (const e of ef){
    if (e.t === "roba"){ h += e.n; roba = true; }
    else if (e.t === "robaHasta"){ h = Math.max(h, e.n); roba = true; }
    else if (e.t === "robaPorCada" || e.t === "robaPremios" || e.t === "descartaParaRobar") return null;
  }
  return roba ? h : null;
}

/* ▌BLOQUE 3 · Pokémon alcanzados y Energía ══════════════════════════════════════ */
/* poke: { stage, hp, types, name } de TCGdex. Los que llevan «Rule Box»: ex, V, VMAX, VSTAR, GX, EX, Radiant. */
export const tieneRegla = poke => /\b(ex|V|VMAX|VSTAR|VUNION|V-UNION|GX|EX|BREAK)\b|Radiant/.test(String(poke.name || ""));
export function alcanza(parte, poke){
  if (!parte || parte.cat !== "pokemon" || !poke) return false;
  const st = poke.stage || "Basic";
  if (parte.fases && parte.fases.length){
    const ok = parte.fases.some(f => f === "Evolution" ? st !== "Basic" : f === st);
    if (!ok) return false;
  }
  if (parte.sinRegla && tieneRegla(poke)) return false;
  if (parte.hpMax && (+poke.hp || 0) > parte.hpMax) return false;
  if (parte.tipo && poke.types && !poke.types.includes(parte.tipo)) return false;
  return true;
}
/* ¿Esta carta (sus efectos) puede ir por ese Pokémon? */
export const traePokemon = (ef, poke) => ef.some(e => e.t === "busca" && e.partes.some(p => alcanza(p, poke)));

const TIPO_POR_NOMBRE = [[/grass|planta/i, "Grass"], [/fire|fuego/i, "Fire"], [/water|agua/i, "Water"], [/lightning|rayo/i, "Lightning"], [/psychic|ps[ií]quic/i, "Psychic"],
  [/fighting|lucha/i, "Fighting"], [/darkness|oscur/i, "Darkness"], [/metal/i, "Metal"], [/fairy|hada/i, "Fairy"]];
/* El tipo de una Energía básica por su nombre («Psychic Energy», «Basic {P} Energy», «Energía Psíquica»), o "". */
export function tipoDeBasica(nombre){
  const n = String(nombre || "").trim();
  if (!/^(?:basic\s+)?(?:\{[grwlpfdmy]\}|grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy)\s+energy$|^energ[ií]a\s+(?:b[aá]sica\s+)?(?:\{[grwlpfdmy]\}|planta|fuego|agua|rayo|ps[ií]quica|lucha|oscura|met[aá]lica|hada)(?:\s+b[aá]sica)?$/i.test(n)) return "";
  const l = /\{([grwlpfdmy])\}/i.exec(n);
  if (l) return TIPO_DE_LETRA[l[1].toUpperCase()];
  return (TIPO_POR_NOMBRE.find(([re]) => re.test(n)) || [])[1] || "";
}
/* Qué tipos de Energía da una carta de Energía: ["Psychic"], ["*"] (todos) o ["Colorless"]. dato: TCGdex (si hay). */
export function proveeEnergia(nombre, dato){
  const b = tipoDeBasica(nombre);
  if (b) return [b];
  const ef = String((dato && dato.effect) || "");
  if (/provides? (?:every|all) types?|every type of Energy/i.test(ef)) return ["*"];
  const prov = /provides?\s+((?:\{[GRWLPFDMYNC]\}\s*(?:,|and|or)?\s*)+)/i.exec(ef);   // «Provides {P} Energy», «Provides {R} or {P}»
  if (prov){ const tipos = [...new Set([...prov[1].matchAll(/\{([GRWLPFDMYNC])\}/g)].map(x => TIPO_DE_LETRA[x[1]]))]; if (tipos.length) return tipos; }
  const porNombre = TIPO_POR_NOMBRE.find(([re]) => re.test(String(nombre)));
  return porNombre ? [porNombre[1]] : ["Colorless"];
}
/* El ataque: costo contado por tipo y daño numérico («120+», «30×» → 120, 30). */
export function costoDe(ataque){
  const c = {}; let total = 0;
  for (const t of (ataque && ataque.cost) || []){ c[t] = (c[t] || 0) + 1; total++; }
  return { porTipo: c, total };
}
export const danoDe = ataque => parseInt(String((ataque && ataque.damage) ?? "").replace(/[^\d]/g, ""), 10) || 0;
