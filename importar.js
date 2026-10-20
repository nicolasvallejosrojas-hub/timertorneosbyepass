/* ▌ÍNDICE de importar.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Columnas y metadatos
    2. Leer el archivo
    3. Buscar en un XML
    4. Armar el torneo
*/
/* =========================================================
   importar.js — el torneo desde el archivo que sea
   ---------------------------------------------------------
   Versión actual: v=2   (subir el ?v= al tocar este archivo)

   Entra un archivo con el torneo y se buscan adentro los datos de las
   personas y las partidas: quién es quién (nombre e ID), las mesas de cada
   ronda y sus resultados. Con eso se arma el mismo torneo que corre la página
   (torneo.js): la tabla sale con los desempates del manual, el top cut se
   nombra solo y lo publicado tiene la forma de siempre.

   Sirve cualquiera de estos, sin importar la extensión del archivo:
   · Una tabla (CSV, TSV, bloc de notas o celdas pegadas desde Excel), una fila
     por mesa. Cabeceras en español o inglés; separador ; , o tab:
       # torneo: Liga de octubre
       # fecha: 2026-10-10               aaaa-mm-dd o dd/mm/aaaa
       # tiempo: 50                      minutos por ronda
       # suizas: 4                       rondas suizas; las que siguen son el top cut
       # inscrito: Pedro Soto; 1234567   se inscribió y no jugó (una línea cada uno)
       ronda;mesa;jugador1;id1;jugador2;id2;resultado
       1;1;Ana Pérez;1234567;Beto Soto;7654321;1
       1;;Carla Díaz;;BYE;;
     resultado: 1 o 2 (quién ganó), E (empate), D (doble derrota), vacío (en
     juego); también el nombre o el ID del ganador. Jugador 2 vacío o BYE = bye.
     Mesa vacía: se numeran en orden.
   · Un XML de torneo: se buscan las etiquetas por su nombre en español,
     inglés, portugués, francés o alemán (jugadores, rondas, partidas, mesas,
     resultados). Si trae la tabla final, se respeta su orden; si trae más de
     un grupo con los mismos jugadores, los siguientes son el top cut.

   La persona es su ID de Play! Pokémon (7 u 8 dígitos). Sin ID, su nombre; si
   ese nombre trae ID en otra fila, es esa persona.
   En la tabla, quien aparece desde una ronda posterior a la primera llegó tarde
   y pierde las anteriores; quien deja de aparecer se retiró (torneo.js).

   Se prueba con node (pruebas/probar-importar.mjs); la parte XML usa el
   DOMParser del navegador: esa prueba se corre abriendo el mismo archivo ahí.
   ========================================================= */
import { aPairings, aHistorial, clasificacion, EMPATE, DOBLE } from "./torneo.js?v=2";
import { normNombre } from "./jugadores.js?v=1";

/* ▌BLOQUE 1 · Columnas y metadatos ══════════════════════════════════════════════
   Alias de las cabeceras (español o inglés) y de las líneas # (torneo, fecha, tiempo, suizas,
   inscrito). */
/* Deja solo letras y números, sin tildes ni mayúsculas: «Jugador 1», «jugador_1» y
   «JUGADOR 1» quedan como «jugador1». Así una cabecera calza escrita como sea. */
const quitar = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const esBye = s => quitar(s) === "bye";
const LARGO = 120;     // las reglas: nombre de jugador hasta 120 letras; el del torneo, hasta 200

/* Da vuelta una lista de sinónimos: de { ronda: ["round", "r"] } a
   { round: "ronda", r: "ronda" }. Después basta CAMPO[quitar(cabecera)] para saber
   qué es cada columna, en el idioma que venga. */
const alias = o => { const m = {}; for (const [k, l] of Object.entries(o)) l.forEach(a => m[a] = k); return m; };
const CAMPO = alias({
  ronda: ["ronda", "round", "r"],
  mesa: ["mesa", "table", "tablenumber", "nmesa"],
  j1: ["jugador1", "j1", "player1", "nombre1", "jugador"],
  id1: ["id1", "idj1", "userid1", "idjugador1"],
  j2: ["jugador2", "j2", "player2", "nombre2", "oponente", "rival"],
  id2: ["id2", "idj2", "userid2", "idjugador2"],
  res: ["resultado", "result", "outcome", "ganador", "res"],
});
const META = alias({
  torneo: ["torneo", "nombre", "name", "tournament"],
  fecha: ["fecha", "date"],
  tiempo: ["tiempo", "minutos", "roundtime"],
  suizas: ["suizas", "rondassuizas", "swiss"],
  inscrito: ["inscrito", "inscrita", "player"],
});

/* ▌BLOQUE 2 · Leer el archivo ═══════════════════════════════════════════════════
   Bytes → texto (UTF-8, ANSI o UTF-16 de Excel; avisa si es un .xlsx), filas y partidas de una
   tabla. */
/* Bytes del archivo -> texto. Excel en español guarda el CSV en ANSI
   (windows-1252) y su «Texto Unicode» en UTF-16: leído como UTF-8, «Pérez»
   sale «P�rez» y ya no calza con nadie. */
function textoDeBytes(buf){
  const b = new Uint8Array(buf);
  /* Los primeros bytes delatan el formato: «PK» es un .zip (así es un .xlsx por dentro)
     y D0 CF es el .xls antiguo. Ninguno es texto: mejor pedir que lo guarden como CSV. */
  if ((b[0] === 0x50 && b[1] === 0x4B) || (b[0] === 0xD0 && b[1] === 0xCF))
    throw new Error("es un libro de Excel: guárdalo como «CSV» (Archivo › Guardar como) o copia las celdas y pégalas");
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder("utf-16le").decode(b);   // marca de UTF-16
  /* fatal: si los bytes no son UTF-8 válido, falla en vez de poner «�»… y entonces es ANSI. */
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b); }
  catch(e){ return new TextDecoder("windows-1252").decode(b); }
}

/* Texto -> metadatos (líneas #) y filas, con el número de línea para los errores. */
function filasDeTexto(texto){
  const lineas = String(texto).split(/\r\n|\r|\n/).map((l, i) => ({ n: i + 1, l })).filter(x => x.l.trim());
  const esMeta = l => /^"?#/.test(l.trim());
  const primera = lineas.find(x => !esMeta(x.l));
  if (!primera) throw new Error("el archivo no trae la tabla de partidas");
  /* El separador es el que más se repite en la fila de títulos: tab (Excel pegado),
     ; (Excel en español) o , (CSV en inglés). */
  const cuenta = c => primera.l.split(c).length - 1;
  const sep = ["\t", ";", ","].sort((a, b) => cuenta(b) - cuenta(a))[0];
  /* Parte una línea en celdas. q = «estoy dentro de comillas»: ahí el separador es
     texto («"Pérez, Ana"» es una sola celda) y "" es una comilla escrita. */
  const celdas = l => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++){
      const c = l[i];
      if (q){ if (c === '"'){ if (l[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep){ out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    return out.concat(cur.trim());
  };
  const meta = { inscritos: [] }, filas = [];
  lineas.forEach(({ n, l }) => {
    if (!esMeta(l)) return filas.push({ n, c: celdas(l) });
    /* Escrita en una celda de Excel, la línea llega como «# torneo: Liga;;;;» o entre comillas. */
    const m = l.trim().replace(/^"?#+\s*/, "").replace(/["\s;,\t]+$/, "").match(/^([^:]+):\s*(.*)$/);
    const k = m && META[quitar(m[1])];
    if (!k) return;                                            // un comentario
    if (k !== "inscrito") return meta[k] = m[2].trim();
    const [nombre, id] = m[2].split(/\t|;|,(?=\s*\d)/).map(x => x.trim());
    meta.inscritos.push({ donde: "fila " + n, nombre, id });
  });
  return { meta, filas };
}

/* Filas -> partidas crudas, por nombre de columna. */
function partidasDeFilas(filas){
  /* cab[j] = qué es la columna j («ronda», «j1»…, o undefined si no se usa). */
  const cab = filas[0].c.map(h => CAMPO[quitar(h)]);
  for (const k of ["ronda", "j1"])
    if (!cab.includes(k)) throw new Error("falta la columna «" + (k === "ronda" ? "ronda" : "jugador1") + "» en la fila de títulos");
  return filas.slice(1).filter(f => f.c.some(x => x)).map(({ n, c }) => {
    /* La fila como objeto { ronda, mesa, j1, … }. Si dos columnas significan lo mismo, vale la primera. */
    const o = {}; cab.forEach((k, j) => { if (k && o[k] === undefined) o[k] = c[j] ?? ""; });
    const p = { donde: "fila " + n, ronda: parseInt(o.ronda, 10), mesa: parseInt(o.mesa, 10) || 0,
                j1: o.j1 || o.id1 || "", id1: o.id1 || "", j2: o.j2 || o.id2 || "", id2: o.id2 || "", res: o.res || "" };
    if (!(p.ronda > 0)) throw new Error(p.donde + ": la ronda no es un número");
    if (esBye(p.j1)) [p.j1, p.id1, p.j2, p.id2] = [p.j2, p.id2, "", ""];    // BYE escrito a la izquierda
    if (!p.j1) throw new Error(p.donde + ": falta el jugador 1");
    if (esBye(p.j2)) p.j2 = p.id2 = "";
    return p;
  });
}

/* ▌BLOQUE 3 · Buscar en un XML ══════════════════════════════════════════════════
   Las etiquetas en varios idiomas (jugadores, rondas, partidas, mesas, resultados, tabla final);
   grupos con los mismos jugadores = top cut; otra categoría = el último grupo. */
/* XML: cada dato se busca por el nombre de su etiqueta, en varios idiomas. */
const ETQ = alias({
  datos: ["data", "datos", "info", "informacion", "donnees", "daten"],
  nombre: ["name", "nombre", "nome", "titel"],
  tiempo: ["roundtime", "tiemporonda", "tiempord", "duracionronda"],
  fecha: ["startdate", "fechainicio", "fecha", "datedebut", "startdatum", "date"],
  jugadores: ["players", "jugadores", "jogadores", "joueurs", "teilnehmer"],
  jugador: ["player", "jugador", "jogador", "joueur", "spieler"],
  nombres: ["firstname", "nombres", "vorname", "prenom"],
  apellidos: ["lastname", "apellido", "apellidos", "nachname", "sobrenome"],
  grupo: ["pod", "grupo"],
  ronda: ["round", "ronda", "ronde", "turno", "runde"],
  partida: ["match", "partida", "partido", "partita", "jogo"],
  j1: ["player1", "jugador1", "jogador1", "spieler1"],
  j2: ["player2", "jugador2", "jogador2", "spieler2"],
  mesa: ["tablenumber", "numeromesa", "mesa", "table"],
  tabla: ["standings", "clasificacion", "classement", "posiciones"],
});
const ATR = alias({
  id: ["userid", "id", "idjugador", "jugadorid"],
  resultado: ["outcome", "resultado", "result"],
  numero: ["number", "numero"],
  puesto: ["place", "puesto", "lugar", "posicion"],
  tipo: ["type", "tipo"],
  categoria: ["category", "categoria"],
});
const TERMINADA = new Set(["finished", "finalizado", "finalizada", "terminado", "terminada"]);
/* El resultado de una partida en el XML: 1 y 8 gana el jugador 1, 2 y 10 el
   jugador 2, 3 empate, 4 doble derrota, 5 bye; cualquier otro, en juego. */
const RES_XML = { 1: "1", 8: "1", 2: "2", 10: "2", 3: "E", 4: "D" };
/* La fecha en estos archivos viene mes/día/año. */
const fechaMDA = s => { const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s); return m ? m[3] + "-" + m[1].padStart(2, "0") + "-" + m[2].padStart(2, "0") : s; };

function datosDeXml(texto){
  const leer = x => { const d = new DOMParser().parseFromString(x, "text/xml"); return d.getElementsByTagName("parsererror").length ? null : d; };
  /* Un trozo sin la etiqueta de afuera también sirve: se le pone una. */
  const doc = leer(texto) || leer("<raiz>" + texto.replace(/^\s*<\?xml[^>]*>/, "") + "</raiz>");
  if (!doc) throw new Error("el archivo parece XML, pero viene cortado o dañado");
  /* Herramientas para buscar sin saber el idioma ni la estructura exacta:
     canon(e): qué es una etiqueta («round», «ronda» o «Runde» → "ronda").
     bajo(r, c): todas las etiquetas de ese tipo dentro de r, a cualquier profundidad.
     hijo(e, c): la primera hija directa de ese tipo. txt: su texto. at(e, c): un atributo. */
  const canon = e => ETQ[quitar(e.localName)] || "";
  const bajo = (r, c) => [...r.getElementsByTagName("*")].filter(e => canon(e) === c);
  const hijo = (e, c) => e && [...e.children].find(h => canon(h) === c);
  const txt = (e, c) => { const h = hijo(e, c); return h ? h.textContent.replace(/\s+/g, " ").trim() : ""; };
  const at = (e, c) => { if (e) for (const a of e.attributes) if (ATR[quitar(a.name)] === c) return a.value.trim(); return ""; };
  const raiz = doc.documentElement, avisos = [];

  /* Quiénes son. La lista va directo bajo la raíz (la tabla final también nombra jugadores). */
  const nombre = {};
  [...raiz.children].filter(e => canon(e) === "jugadores").forEach(l => [...l.children].forEach(p => {
    const id = at(p, "id"), n = (txt(p, "nombres") + " " + txt(p, "apellidos")).trim() || txt(p, "nombre");
    if (id && n) nombre[id] = n;
  }));

  /* Las rondas, por grupo. Un grupo con los mismos jugadores que los anteriores es su
     top cut; uno con otros jugadores es otra categoría, y vale el último. */
  /* Los ID que juegan una partida (el bye trae un solo «jugador»). */
  const lados = m => ["j1", "j2", "jugador"].map(c => at(hijo(m, c), "id")).filter(Boolean);
  /* fases: un arreglo de rondas por cada grupo que tenga partidas (sin grupos, el archivo
     entero es uno). Las rondas, ordenadas por su número. */
  const fases = (bajo(raiz, "grupo").filter(g => bajo(g, "partida").length).length
    ? bajo(raiz, "grupo").filter(g => bajo(g, "partida").length) : [raiz])
    .map(g => bajo(g, "ronda").filter(r => bajo(r, "partida").length)
      .sort((a, b) => (+at(a, "numero") || 0) - (+at(b, "numero") || 0)));
  const quienes = rs => new Set(rs.flatMap(r => bajo(r, "partida").flatMap(lados)));
  /* Si los jugadores de un grupo ya estaban todos en los anteriores, es su top cut y se
     suma; si no, es otra categoría y reemplaza a lo anterior. fuera: quienes quedaron en
     una categoría que no se muestra (no se cuentan como inscritos). */
  let usar = [fases[0]];
  for (const f of fases.slice(1)){
    const antes = quienes(usar.flat());
    if ([...quienes(f)].every(id => antes.has(id))) usar.push(f);
    else { usar = [f]; avisos.push("El archivo trae varias categorías: se muestra la última."); }
  }
  const fuera = quienes(fases.filter(f => !usar.includes(f)).flat());

  const partidas = [];
  let n = 0, finSuizo = 0;
  usar.forEach((rs, i) => { rs.forEach(r => {
    /* En el suizo vale el número del archivo; el corte sigue después (suizo 1–5 → corte 6, 7). */
    n = i === 0 ? Math.max(n + 1, +at(r, "numero") || 0) : n + 1;
    bajo(r, "partida").forEach(m => {
      const a = hijo(m, "j1") || hijo(m, "jugador"), b = hijo(m, "j2");
      const id1 = at(a, "id"), id2 = at(b, "id"), mesa = parseInt(txt(m, "mesa"), 10) || 0;
      if (!id1) return;
      /* La misma forma que una fila de la tabla: de acá en adelante el XML y el CSV
         siguen el mismo camino (construirTorneo). */
      partidas.push({ donde: "ronda " + n + (mesa ? ", mesa " + mesa : ""), ronda: n, mesa,
        j1: nombre[id1] || id1, id1, j2: id2 ? nombre[id2] || id2 : "", id2,
        res: id2 ? RES_XML[parseInt(at(m, "resultado"), 10)] || "" : "" });
    });
  }); if (i === 0) finSuizo = n; });
  const suizas = usar.length > 1 ? finSuizo : 0;

  /* La tabla final del archivo, si está terminada. Los archivos de TOM la traen una por categoría
     (category 0 = Junior, 1 = Senior, 2 = Masters): cada jugador queda en la suya (cats) y, si
     están todas, el orden del archivo es Masters, Senior y Junior, cada una por su puesto. */
  const todas = bajo(raiz, "tabla").flatMap(t => bajo(t, "grupo"));
  const fin = todas.filter(g => TERMINADA.has(quitar(at(g, "tipo"))));
  const porPuesto = g => bajo(g, "jugador").sort((a, b) => (+at(a, "puesto") || 0) - (+at(b, "puesto") || 0)).map(p => at(p, "id"));
  const catDe = g => /^[012]$/.test(at(g, "categoria")) ? +at(g, "categoria") : null;
  const cats = {};
  todas.forEach(g => { if (catDe(g) != null) bajo(g, "jugador").forEach(p => { if (at(p, "id")) cats[at(p, "id")] = catDe(g); }); });
  const puestos = fin.length === 1 ? porPuesto(fin[0])
    : fin.length > 1 && fin.every(g => catDe(g) != null) ? [...fin].sort((a, b) => catDe(b) - catDe(a)).flatMap(porPuesto) : [];

  const datos = hijo(raiz, "datos") || raiz;
  return { partidas, meta: {
    torneo: txt(datos, "nombre"), fecha: fechaMDA(txt(datos, "fecha")), tiempo: txt(datos, "tiempo"),
    suizas: suizas ? String(suizas) : "", puestos, cats, avisos, tal: true,
    inscritos: Object.entries(nombre).filter(([id]) => !fuera.has(id)).map(([id, n]) => ({ donde: "lista de jugadores", nombre: n, id })) } };
}

/* Resultado escrito -> 1, 2, 0 (empate), 3 (doble), "bye" o null (en juego). */
function codigoResultado(p){
  const r = quitar(p.res);
  if (!r || r === "pendiente") return null;
  if (["1", "p1", "j1", "gana1", "ganaj1", "p1win"].includes(r)) return 1;
  if (["2", "p2", "j2", "gana2", "ganaj2", "p2win"].includes(r)) return 2;
  if (["e", "empate", "tie", "t", "0"].includes(r)) return EMPATE;
  if (["d", "dd", "doble", "doblederrota"].includes(r)) return DOBLE;
  if (r === "bye") return "bye";
  if (r === quitar(p.j1) || r === quitar(p.id1)) return 1;
  if (r === quitar(p.j2) || r === quitar(p.id2)) return 2;
  throw new Error(p.donde + ": el resultado «" + p.res + "» no se entiende (usa 1, 2, E, D o vacío)");
}

function fechaISO(txt){
  let m = String(txt || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = String(txt || "").match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);     // dd/mm/aaaa, como se escribe acá
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31)
    return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "";
}

/* El último desempate es al azar: con una semilla sacada del nombre y la
   fecha, el orden no cambia cada vez que se vuelve a cargar el archivo. */
/* Es el hash FNV-1a de 32 bits: mezcla cada letra con una multiplicación por un
   primo. Mismo texto → mismo número, siempre; textos distintos → números muy distintos. */
const semillaDe = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0; return h || 1; };

/* ▌BLOQUE 4 · Armar el torneo ═══════════════════════════════════════════════════
   Quién es quién por ID, mesas por ronda, llegó tarde / se retiró, y el torneo de torneo.js → {
   parsed, ids, duelos, avisos }. */
/* Partidas -> torneo de torneo.js -> lo que usa el panel: { parsed, ids, duelos, avisos }.
   parsed: lo que se publica en pairings. ids: la clave de cada puesto (el ID, o
   «n:nombre» sin ID), que nunca se publica. duelos: las partidas para las
   rachas. avisos: lo que conviene revisar antes de publicar.
   meta.tal: los datos vienen de un programa de torneos y se toman tal cual
   (sin deducir llegadas tarde). meta.puestos: el orden de la tabla final del archivo. */
function construirTorneo(partidas, meta){
  if (!partidas.length) throw new Error("el archivo no contiene partidas");
  const avisos = new Set(meta.avisos || []);
  const nombreT = String(meta.torneo || "Torneo").replace(/\s+/g, " ").trim();
  if (nombreT.length > 200) throw new Error("el nombre del torneo pasa de 200 letras");
  let suizas = parseInt(meta.suizas, 10) || 0;
  if (meta.suizas && !(suizas >= 1 && suizas <= 20)){ suizas = 0; avisos.add("«suizas: " + meta.suizas + "» no es un número entre 1 y 20: todas las rondas se cuentan como suizas."); }

  /* 1. Cada lado de cada mesa, con nombre e ID limpios. «1.234.567» es 1234567. */
  /* Si el ID son solo números con puntos, espacios o guiones, quedan los dígitos;
     si trae letras, se deja tal cual (no se inventa un ID mezclando dígitos). */
  const limpiarId = id => /^[\d.\s-]+$/.test(id) ? id.replace(/\D/g, "") : id;
  const lado = (nombre, id, donde) => {
    nombre = String(nombre || "").replace(/\s+/g, " ").trim();
    if (nombre.length > LARGO) throw new Error(donde + ": el nombre «" + nombre.slice(0, 30) + "…» pasa de " + LARGO + " letras");
    id = String(id || "").trim();
    const d = limpiarId(id);
    if (d && !/^\d{7,8}$/.test(d)) avisos.add("El ID «" + id + "» de " + nombre + " no tiene 7 u 8 dígitos: no se va a enlazar con su cuenta.");
    return { nombre: nombre || d, id: d, donde };
  };
  partidas.forEach(p => { p.A = lado(p.j1, p.id1, p.donde); p.B = p.j2 ? lado(p.j2, p.id2, p.donde) : null; });
  const inscritos = (meta.inscritos || []).filter(x => x.nombre || x.id).map(x => lado(x.nombre, x.id, x.donde));
  const todos = partidas.flatMap(p => p.B ? [p.A, p.B] : [p.A]).concat(inscritos);

  /* 2. Quién es quién: mismo ID = misma persona; sin ID, el nombre, y si ese
     nombre trae ID en otra fila, es esa persona. */
  /* idsDe: nombre → los ID con que aparece. nombreDe: ID → el primer nombre con que aparece. */
  const idsDe = new Map(), nombreDe = new Map();
  todos.filter(x => x.id).forEach(x => {
    const k = normNombre(x.nombre);
    if (!idsDe.has(k)) idsDe.set(k, new Set());
    idsDe.get(k).add(x.id);
    if (!nombreDe.has(x.id)) nombreDe.set(x.id, x.nombre);
    else if (normNombre(nombreDe.get(x.id)) !== k)
      avisos.add("El ID " + x.id + " aparece como «" + nombreDe.get(x.id) + "» y como «" + x.nombre + "»: se cuentan como la misma persona.");
  });
  /* alta(x): la clave de esa persona en el torneo (su ID, o «n:nombre» si no hay
     cómo saberlo), y la anota en jug la primera vez. */
  const jug = {};
  const alta = x => {
    let k = x.id;
    if (!k){
      const s = idsDe.get(normNombre(x.nombre));
      if (s && s.size > 1) throw new Error(x.donde + ": hay " + s.size + " «" + x.nombre + "» con distinto ID; escribe el ID acá");
      k = s ? [...s][0] : "n:" + normNombre(x.nombre);
    }
    if (!jug[k]) jug[k] = { nombre: nombreDe.get(k) || x.nombre };
    return k;
  };

  /* 3. Las mesas de cada ronda. Nadie juega dos veces la misma ronda. */
  const ronda = {};
  partidas.forEach(p => {
    /* en: quién ya juega esta ronda (y en qué fila). cuenta: para numerar las mesas sin número. */
    const r = ronda[p.ronda] = ronda[p.ronda] || { mesas: [], en: new Map(), cuenta: 0 };
    const a = alta(p.A), b = p.B ? alta(p.B) : null;
    [[a, p.A], [b, p.B]].forEach(([k, x]) => {
      if (!k) return;
      if (r.en.has(k)) throw new Error(x.donde + ": " + jug[k].nombre + " ya juega la ronda " + p.ronda + " (" + r.en.get(k) + ")");
      r.en.set(k, x.donde);
    });
    const corte = suizas > 0 && p.ronda > suizas;
    if (!b){
      if (corte) throw new Error(p.donde + ": en el top cut no hay bye");
      return r.mesas.push({ a });
    }
    const cod = codigoResultado(p);
    if (cod === "bye") throw new Error(p.donde + ": dice bye, pero tiene jugador 2");
    if (corte && (cod === EMPATE || cod === DOBLE)) throw new Error(p.donde + ": en el top cut solo se gana o se pierde");
    const m = { a, b, mesa: p.mesa || ++r.cuenta };
    if (p.mesa) r.cuenta++;
    if (cod != null) m.r = cod;
    r.mesas.push(m);
  });
  inscritos.forEach(alta);

  /* 4. Llegó tarde / se retiró, mirando solo el suizo (en el corte no están todos). */
  const nums = Object.keys(ronda).map(Number).sort((x, y) => x - y);
  /* ap: las rondas suizas en que aparece. Si la primera es posterior a la del torneo,
     llegó tarde; si la última es anterior, se retiró (drop). */
  const sw = suizas ? nums.filter(n => n <= suizas) : nums;
  Object.keys(jug).forEach(k => {
    const ap = sw.filter(n => ronda[n].en.has(k));
    if (!ap.length) return;
    if (ap[0] > sw[0] && !meta.tal){
      jug[k].desde = ap[0];
      avisos.add(jug[k].nombre + " aparece desde la ronda " + ap[0] + ": pierde las anteriores (llegó tarde).");
    }
    if (ap[ap.length - 1] < sw[sw.length - 1]) jug[k].drop = ap[ap.length - 1];
  });

  const fecha = fechaISO(meta.fecha);
  if (meta.fecha && !fecha) avisos.add("No entendí la fecha «" + meta.fecha + "»: elígela en el panel antes de archivar.");
  const t = { nombre: nombreT, fecha, rondas: suizas, semilla: semillaDe(nombreT + "|" + fecha), jugadores: jug,
              ronda: Object.fromEntries(nums.map(n => [n, { mesas: ronda[n].mesas }])) };
  const min = parseInt((String(meta.tiempo || "").match(/\d+/) || [])[0], 10);
  if (min > 0 && min <= 300) t.minutos = min;
  else if (meta.tiempo) avisos.add("No entendí el tiempo «" + meta.tiempo + "»: queda sin minutos por ronda.");

  /* torneo.js hace el resto: la hoja que ven los jugadores (aPairings), la tabla con
     desempates (clasificacion) y las partidas por puesto (aHistorial). */
  const parsed = aPairings(t);
  const cl = clasificacion(t);
  let ids = cl.map(p => p.id), duelos = aHistorial(t).partidas;
  /* % de victorias de los rivales y de los rivales de los rivales de cada uno (5.3.3), para la tabla general. */
  const pct = Object.fromEntries(cl.map(p => [p.id, [p.pts || 0, p.owp || 0, p.oowp || 0]]));
  let general = null;
  /* 5. Si el archivo trae la tabla final con todos, manda su orden. */
  const orden = (meta.puestos || []).filter(k => jug[k]);
  if (orden.length === ids.length && new Set(orden).size === orden.length){
    /* fila: la fila de cada persona. nuevo: su puesto en el orden del archivo. Las
       partidas guardan puestos, no personas, así que se traducen al orden nuevo. */
    const fila = Object.fromEntries(ids.map((k, i) => [k, parsed.standings[i]]));
    const nuevo = Object.fromEntries(orden.map((k, i) => [k, i]));
    parsed.standings = orden.map((k, i) => ({ ...fila[k], place: i + 1 }));
    duelos = duelos.map(([r, a, b, g]) => [r, nuevo[ids[a]], nuevo[ids[b]], g]);
    ids = orden;
  }
  /* 6. Si el archivo dice la categoría de cada uno (cats), la tabla se divide: Masters, Senior y
     Junior, cada una con su propio 1.º, 2.º… Así un Junior no sale «campeón» de la tabla de los
     Masters. Las partidas y los ID se reordenan igual que la tabla. Con una sola categoría solo se
     anota cuál es (el ranking del mes la separa); si a alguien le falta, la tabla queda como estaba. */
  const catPor = {};
  Object.entries(meta.cats || {}).forEach(([id, c]) => catPor[limpiarId(id)] = c);
  const catFila = ids.map(k => catPor[k]);
  if (catFila.some(c => c != null)){
    if (catFila.some(c => c == null)) avisos.add("La tabla por categorías no incluye a todos: se deja junta.");
    else if (new Set(catFila).size === 1) parsed.standings = parsed.standings.map((f, i) => ({ ...f, cat: catFila[i] }));   // una sola: se anota para el ranking del mes
    else {
      /* viejo[i]: el puesto de antes de quien queda i-ésimo; nuevo[v]: dónde queda el que estaba en v. */
      const viejo = ids.map((k, i) => i).sort((a, b) => catFila[b] - catFila[a] || a - b), nuevo = [];
      viejo.forEach((v, i) => nuevo[v] = i);
      const lugar = {};
      parsed.standings = viejo.map(v => ({ ...parsed.standings[v], cat: catFila[v], place: lugar[catFila[v]] = (lugar[catFila[v]] || 0) + 1 }));
      duelos = duelos.map(([r, a, b, g]) => [r, nuevo[a], nuevo[b], g]);
      ids = viejo.map(v => ids[v]);
      avisos.add("La tabla se dividió en " + new Set(catFila).size + " categorías (Masters, Senior y Junior), cada una con su puesto.");
      /* La tabla general, para la imagen: las categorías juntas. Dentro de cada una manda el orden del
         archivo (el de TOM); entre ellas, el mejor que queda al frente de cada una por puntos, % de
         victorias de los rivales y % de los rivales de los rivales. El archivo no trae esos %: los
         calcula torneo.js con la regla oficial. A igualdad total, la categoría mayor primero. */
      const colas = {};
      parsed.standings.forEach((f, i) => (colas[f.cat] = colas[f.cat] || []).push(i));
      const orden = Object.keys(colas).sort((a, b) => b - a).map(c => colas[c]);
      const mejor = (a, b) => { const x = pct[ids[a]] || [0, 0, 0], y = pct[ids[b]] || [0, 0, 0];
        for (let k = 0; k < 3; k++) if (Math.abs(x[k] - y[k]) > 1e-9) return x[k] > y[k];
        return false; };
      general = { filas: [], ids: [] };
      while (orden.some(c => c.length)){
        let cola = null;
        for (const c of orden) if (c.length && (!cola || mejor(c[0], cola[0]))) cola = c;
        const i = cola.shift();
        general.filas.push({ ...parsed.standings[i], cat: undefined, categoria: parsed.standings[i].cat, place: general.filas.length + 1 }); general.ids.push(ids[i]);
      }
    }
  }
  return { parsed, ids, duelos, avisos: [...avisos], torneo: t, general };
}

/* Puertas de entrada: el texto (pegado o leído) o el archivo (ArrayBuffer). */
export function importarTexto(texto){
  texto = String(texto).replace(/^\uFEFF/, "");
  /* Si empieza con «<» es XML; si no, es una tabla. La extensión del archivo no importa. */
  if (/^\s*</.test(texto)){ const { partidas, meta } = datosDeXml(texto); return construirTorneo(partidas, meta); }
  const { meta, filas } = filasDeTexto(texto);
  return construirTorneo(partidasDeFilas(filas), meta);
}
export const importarArchivo = buf => importarTexto(textoDeBytes(buf));

/* Plantilla descargable, con datos inventados. */
export const PLANTILLA = [
  "# torneo: Torneo de ejemplo", "# fecha: 2026-10-10", "# tiempo: 50", "# suizas: 3",
  "# Ayuda: resultado 1 o 2 = quién ganó / E = empate / D = doble derrota / vacío = en juego. Jugador 2 vacío o BYE = bye.",
  "ronda;mesa;jugador1;id1;jugador2;id2;resultado",
  "1;1;Ana Prueba;1111111;Beto Ejemplo;2222222;1",
  "1;2;Carla Falsa;3333333;Diego Inventado;4444444;E",
  "1;;Eva Muestra;5555555;BYE;;",
  "2;1;Ana Prueba;;Carla Falsa;;",
  "2;2;Eva Muestra;;Beto Ejemplo;;",
  "2;;Diego Inventado;;;;",
].join("\r\n");
