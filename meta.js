/* meta.js — el meta de un torneo: cruza las listas de mazo (el CSV de inscritos del panel) con los resultados (el archivo del
   torneo, leído por importar.js del sitio) y saca, por baraja, cuántos la jugaron, su winrate y su mejor puesto.
   Puro (sin DOM): lo usa meta.html (en el panel de la tienda y en la herramienta local files/meta-torneo/) y se prueba con node
   (pruebas/probar-meta-torneo.mjs).

   · La persona es su ID de Play! Pokémon: así calzan la lista y la fila del torneo. Sin ID, por nombre o nick.
   · La baraja sale de la lista (arquetipos.js: el Pokémon, o los dos, que más pesan). Se puede corregir a mano.
   · Winrate de una baraja = partidas ganadas / jugadas contra OTRAS barajas (los espejos no dicen nada de la baraja y
     los byes no son partidas). Los empates cuentan como jugadas no ganadas; también se dan V-D-E. */
import { pokemonDe, clasificar } from "./arquetipos.js?v=04fd01b03cf9";
import { division, temporada } from "./listamazo.js?v=04fd01b03cf9";

/* Categorías como las numera TOM: 0 Junior, 1 Senior, 2 Masters. */
export const CATEGORIAS = ["Junior", "Senior", "Masters"];
const CAT = { junior: 0, senior: 1, masters: 2, master: 2 };

/* ── CSV (el del panel: ; y todo entre comillas, con la lista en varias líneas; o uno vuelto a guardar en Excel) ── */
export function leerCSV(texto){
  texto = String(texto || "").replace(/^﻿/, "");
  const primera = texto.split(/\r?\n/)[0] || "";
  const sep = [";", ",", "\t"].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = []; let fila = [], celda = "", comillas = false;
  for (let i = 0; i < texto.length; i++){
    const c = texto[i];
    if (comillas){
      if (c === '"'){ if (texto[i + 1] === '"'){ celda += '"'; i++; } else comillas = false; }
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep){ fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && texto[i + 1] === "\n") i++; fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else celda += c;
  }
  if (celda || fila.length){ fila.push(celda); filas.push(fila); }
  /* csv.js antepone ' a lo que Excel tomaría por fórmula */
  return filas.filter(f => f.some(x => x.trim())).map(f => f.map(x => x.replace(/^'(?=[=+\-@])/, "")));
}

export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const clave = s => norm(s).replace(/[^a-z0-9]/g, "");
const COLUMNAS = { id: ["iddejugador", "playerid", "id", "userid"], lista: ["listademazo", "lista", "decklist", "mazo", "deck"],
                   nombre: ["nombre", "firstname", "name"], apellido: ["apellido", "lastname"], nick: ["nick", "nickname"], cat: ["categoria", "division"],
                   nac: ["nacimiento", "fechadenacimiento", "birthdate", "dateofbirth"] };

/* «17/06/1999» (el CSV del panel) o «1999-06-17» → «1999-06-17». */
const aISO = t => { const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t); return m ? m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0") : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ""; };

/* Las listas del CSV: [{ id, nombre, nick, lista }]. Las cabeceras se buscan por nombre (español o inglés). */
export function listasDeCSV(texto){
  const [cab, ...filas] = leerCSV(texto);
  if (!cab) return { listas: [], error: "El archivo de listas está vacío." };
  const col = {}; cab.forEach((h, i) => { for (const [k, alias] of Object.entries(COLUMNAS)) if (col[k] == null && alias.includes(clave(h))) col[k] = i; });
  if (col.lista == null) return { listas: [], error: "No encontré la columna «Lista de mazo» en el archivo de listas." };
  const v = (f, k) => col[k] == null ? "" : String(f[col[k]] || "").trim();
  return { listas: filas.map(f => ({ id: v(f, "id").replace(/\D/g, ""), nombre: [v(f, "nombre"), v(f, "apellido")].filter(Boolean).join(" "), nick: v(f, "nick"), cat: v(f, "cat"), nac: aISO(v(f, "nac")), lista: v(f, "lista") }))
    .filter(x => x.lista || x.id || x.nombre) };
}

/* ── cruzar listas y resultados ──
   torneos: lo que devuelve importarCategorias() de importar.js (un torneo por grupo; también sirve uno solo).
   manual: { <clave del jugador>: "Nombre de la baraja" } para corregir la que sale de la lista.
   La categoría de cada uno (0 Junior, 1 Senior, 2 Masters): la del archivo del torneo (la que puso TOM); si no la trae, la de su
   fecha de nacimiento en la temporada del torneo; si no, la que marcó al inscribirse (puede estar mal: por eso va al final). */
export function cruzar(torneos, listas, base, manual = {}){
  const usadas = new Set(), jugadores = [], duelos = [];
  const porId = new Map(listas.filter(l => l.id).map(l => [l.id, l]));
  const porNombre = new Map(); listas.forEach(l => [l.nombre, l.nick].filter(Boolean).forEach(n => porNombre.has(norm(n)) || porNombre.set(norm(n), l)));
  let hayCorte = false;
  for (const torneo of [].concat(torneos)){
    const off = jugadores.length, filas = torneo.parsed.standings, ids = torneo.ids;
    const fecha = torneo.torneo && torneo.torneo.fecha, t = /^\d{4}-\d{2}-\d{2}$/.test(fecha || "") ? temporada(Date.parse(fecha + "T12:00:00Z")) : temporada();
    filas.forEach((f, k) => {
      const id = /^\d{6,8}$/.test(ids[k] || "") ? ids[k] : "";
      const l = (id && porId.get(id)) || porNombre.get(norm(f.name)) || null;
      if (l) usadas.add(l);
      const pk = l && l.lista ? pokemonDe(l.lista, base) : [];
      const auto = clasificar(pk), clave = id || "n:" + norm(f.name);
      const deck = manual[clave] ? { arquetipo: manual[clave], insignia: manual[clave].split(/\s*[+/]\s*/).filter(Boolean) } : l && l.lista ? auto : { arquetipo: "Sin lista", insignia: [] };
      const delArchivo = f.categoria ?? f.cat, porEdad = l && l.nac ? CAT[norm(division(l.nac, t))] : undefined, marcada = l ? CAT[norm(l.cat)] : undefined;
      const cat = delArchivo != null && /^[012]$/.test(String(delArchivo)) ? +delArchivo : porEdad ?? marcada ?? null;
      jugadores.push({ i: off + k, clave, puesto: f.place, nombre: f.name, id, cat, marcada: marcada ?? null, catDe: delArchivo != null ? "archivo" : porEdad != null ? "edad" : marcada != null ? "inscripción" : "",
        w: f.w, l: f.l, t: f.t, pts: f.pts, conLista: !!(l && l.lista), manual: !!manual[clave], deck: deck.arquetipo, insignia: deck.insignia, auto: auto.arquetipo });
    });
    /* el top cut: quienes juegan rondas después de las suizas (de ese grupo) */
    const suizas = (torneo.torneo && torneo.torneo.rondas) || 0;
    torneo.duelos.forEach(([r, a, b, g]) => {
      duelos.push([r, off + a, off + b, g]);
      if (suizas && r > suizas){ jugadores[off + a].corte = jugadores[off + b].corte = true; hayCorte = true; }
    });
  }
  jugadores.forEach(j => j.corte = !!j.corte);
  return { jugadores, duelos, sobran: listas.filter(l => !usadas.has(l) && l.lista), hayCorte };
}

/* ── las barajas ── r de cada duelo (torneo.js): 1 gana a, 2 gana b, 0 empate, 3 doble derrota. */
export function estadisticas({ jugadores, duelos }, { cat = null, espejos = false } = {}){
  const J = jugadores.filter(j => cat == null || j.cat == cat), dentro = new Set(J.map(j => j.i)), deckDe = i => jugadores[i].deck;
  const D = new Map();
  const d = n => D.get(n) || (D.set(n, { deck: n, insignia: J.find(j => j.deck === n).insignia, jugadores: [], w: 0, l: 0, t: 0, espejos: 0, vs: {} }), D.get(n));
  J.forEach(j => d(j.deck).jugadores.push(j));
  for (const [, a, b, r] of duelos){
    if (!dentro.has(a) || !dentro.has(b)) continue;
    const A = deckDe(a), B = deckDe(b);
    if (A === B && !espejos){ d(A).espejos++; continue; }
    const anotar = (x, y, res) => { const s = d(x), v = s.vs[y] = s.vs[y] || { w: 0, l: 0, t: 0 }; s[res]++; v[res]++; };
    if (r === 1){ anotar(A, B, "w"); anotar(B, A, "l"); }
    else if (r === 2){ anotar(A, B, "l"); anotar(B, A, "w"); }
    else if (r === 0){ anotar(A, B, "t"); anotar(B, A, "t"); }
    else if (r === 3){ anotar(A, B, "l"); anotar(B, A, "l"); }
  }
  const total = J.length || 1;
  return [...D.values()].map(s => {
    const jug = s.w + s.l + s.t;
    return { ...s, n: s.jugadores.length, cuota: s.jugadores.length / total, partidas: jug, wr: jug ? s.w / jug : null,
             mejor: Math.min(...s.jugadores.map(j => j.puesto)), corte: s.jugadores.filter(j => j.corte).length };
  }).sort((a, b) => b.n - a.n || (b.wr ?? -1) - (a.wr ?? -1) || a.mejor - b.mejor);
}

/* ── sprites ── El nombre de la carta («Mega Manectric ex», «Alolan Ninetales», «Team Rocket's Mewtwo ex») a su nombre en
   pokesprite (manectric-mega, ninetales-alola, mewtwo) y la especie sola, por si esa forma no tiene sprite. */
const REGION = { alolan: "alola", galarian: "galar", hisuian: "hisui", paldean: "paldea" };
export function especieDe(nombre){
  let n = String(nombre || "").trim(), forma = "";
  for (let i = 0; i < 3; i++) n = n.replace(/\s+(ex|EX|GX|V|VSTAR|VMAX|V-UNION|BREAK|LV\.X|δ|◇|☆)$/, "");
  n = n.replace(/^(Radiant|Shining|Dark|Light)\s+/, "").replace(/^(?:[A-Z][\w.]*\s)?[A-Z][\w.]*['’]s\s+/, "");
  let m = /^(\w+)\s+Mask\s+(.+)$/.exec(n);   // Ogerpon: la Turquesa es la forma de siempre; las otras tienen nombre propio en PokeAPI
  if (m){ n = m[2]; forma = /^teal$/i.test(m[1]) ? "" : m[1].toLowerCase() + "-mask"; }
  m = /^Bloodmoon\s+(.+)$/.exec(n);
  if (m){ n = m[1]; forma = "bloodmoon"; }
  /* formas que la carta nombra antes de la especie: «Heat Rotom» → rotom-heat, «Black Kyurem» → kyurem-black, «Castform Sunny Form» → castform-sunny */
  m = /^(Heat|Wash|Frost|Fan|Mow)\s+(Rotom)$/.exec(n) || /^(Black|White)\s+(Kyurem)$/.exec(n);
  if (m){ n = m[2]; forma = m[1].toLowerCase(); }
  m = /^(Castform)\s+(\w+)\s+Form$/.exec(n);
  if (m){ n = m[1]; forma = m[2].toLowerCase(); }
  m = /^Mega\s+(.+?)(?:\s+([XY]))?$/.exec(n);
  if (m){ n = m[1]; forma = "mega" + (m[2] ? "-" + m[2].toLowerCase() : ""); }
  m = /^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/.exec(n);
  if (m){ n = m[2]; forma = REGION[m[1].toLowerCase()]; }
  const base = n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/♀/g, "-f").replace(/♂/g, "-m").replace(/[.'’:]/g, "").trim().replace(/\s+/g, "-");
  return { base, slug: forma ? base + "-" + forma : base };
}

/* El nombre para las imágenes: con dos Pokémon, sin «ex» ni la máscara ni el dueño («Raging Bolt ex + Teal Mask Ogerpon ex» →
   «Raging Bolt / Ogerpon»); con uno, tal cual. */
export const nombreCorto = deck => {
  const p = String(deck).split(/\s*[+/]\s*/).filter(Boolean);
  return p.length < 2 ? String(deck) : p.map(n => n.replace(/\s+ex$/i, "").replace(/^\w+\s+Mask\s+/, "").replace(/^(?:[A-Z][\w.]*\s)?[A-Z][\w.]*['’]s\s+/, "")).join(" / ");
};
