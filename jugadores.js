/* ▌ÍNDICE de jugadores.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Claves por ID
    2. Nombres parecidos
*/
/* ============================================================
   jugadores.js — un mismo jugador, aunque su nombre cambie
   ------------------------------------------------------------
   Versión actual: v=2   (subir el ?v= al tocar este archivo)

   Problema: las tablas públicas (ranking, insignias, rachas, perfil de jugador,
   directorio, estadísticas) reconocían a una persona por cómo estaba escrito su
   NOMBRE. Con más de un computador (o un error de tipeo), la misma persona queda como
   «Juan Pérez» en un torneo y «JP Juan» en otro y salía repetida; y dos personas
   distintas que se llaman igual se sumaban como una sola.

   Regla: la persona es su ID de Play! Pokémon.
     · Mismo ID = misma persona, con el nombre que sea.
     · Mismo nombre y distinto ID = personas distintas.

   Cómo: cada fila archivada con ID lleva una «clave» al azar, la misma para
   todas las filas de ese ID. La clave no dice nada del ID, así que puede viajar
   con el historial público; el ID sigue en idsHistorial, que solo lee la tienda.
   Las tablas agrupan por clave (claveJugador, en clasificacion.js).

   Las filas SIN ID (torneos de antes del 29-09) no tienen cómo saberlo. Solo
   se les da una clave PROVISIONAL, aparte (`claveN`), cuando su nombre calza con
   UNA sola persona; si el nombre es ambiguo se quedan solas. La provisional
   nunca se confunde con una de verdad: en cuanto se recupera el ID de esa fila,
   la reemplaza la clave de su ID. Así una suposición por nombre no puede
   juntar a dos personas para siempre.

   Lo usa el panel (admin.html), que es quien puede leer los dos lados (el
   historial y los ID). Sin dependencias del navegador: se prueba con node.
   ============================================================ */

/* ▌BLOQUE 1 · Claves por ID ═════════════════════════════════════════════════════
   planClaves(historial, idsHistorial): qué escribir para que todas las filas del mismo ID
   compartan una clave (y una provisional `claveN` para filas viejas sin ID cuyo nombre es de una
   sola persona). Idempotente; lo usa el panel. */
export const normNombre = s => String(s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const ID_OK = /^[0-9]{6,8}$/;

/* Una clave nueva: 10 caracteres hexadecimales al azar. */
export function claveNueva(){
  const b = new Uint8Array(5);
  globalThis.crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}

/* standings puede venir como arreglo o como objeto {0:…, 1:…}. */
const filasDe = t => Object.entries((t && t.standings) || {}).filter(([, f]) => f);

/* Lo que hay que escribir en el historial para que todas las filas queden bien.
   Devuelve { "<torneo>/standings/<puesto>/clave": valor, ".../claveN": valor|null }.
   `null` borra el campo. Correrlo dos veces seguidas devuelve {}.

     1) Fila con ID: la clave de ese ID. Si ya hay filas de ese ID con clave,
        se usa esa (si hubiera dos por una carrera entre dos paneles, gana la
        menor, siempre la misma); si no, una nueva.
     2) Fila sin ID y sin clave: la provisional, solo si su uid (o, si no tiene,
        su nombre) pertenece a UNA sola clave. Los reservados no se juntan por
        nombre: todos dicen «Jugador reservado». */
export function planClaves(hist, idsHist, nueva = claveNueva){
  const idDe = (tid, i) => { const id = String(((idsHist || {})[tid] || {})[i] || ""); return ID_OK.test(id) ? id : ""; };
  const filas = [];
  Object.keys(hist || {}).forEach(tid => filasDe(hist[tid]).forEach(([i, f]) => filas.push({ tid, i, f, id: idDe(tid, i) })));
  const ruta = (x, campo) => x.tid + "/standings/" + x.i + "/" + campo;

  const claveDeId = {};                                   // ID → clave (la menor de las que ya existen)
  filas.forEach(x => { if (x.id && x.f.clave && (!claveDeId[x.id] || x.f.clave < claveDeId[x.id])) claveDeId[x.id] = x.f.clave; });

  const cambios = {}, final = new Map();
  filas.forEach(x => {                                    // 1) por ID
    if (!x.id) return;
    const c = claveDeId[x.id] ??= nueva();
    final.set(x, c);
    if (x.f.clave !== c) cambios[ruta(x, "clave")] = c;
    if (x.f.claveN !== undefined) cambios[ruta(x, "claveN")] = null;   // ya no hace falta la provisional
  });
  filas.forEach(x => { if (!x.id && x.f.clave) final.set(x, x.f.clave); });   // con clave y sin ID: se respeta

  const porUid = {}, porNombre = {};
  const juntar = (m, k, c) => { if (k && c) (m[k] ??= new Set()).add(c); };
  filas.forEach(x => {
    const c = final.get(x); if (!c) return;
    juntar(porUid, x.f.uid, c);
    if (!x.f.reservado) juntar(porNombre, normNombre(x.f.name), c);
  });
  const unica = s => s && s.size === 1 ? [...s][0] : "";
  filas.forEach(x => {                                    // 2) provisional
    if (final.has(x)) return;
    const c = (x.f.uid && unica(porUid[x.f.uid])) || (!x.f.uid && !x.f.reservado && unica(porNombre[normNombre(x.f.name)])) || "";
    if (c) { if (x.f.claveN !== c) cambios[ruta(x, "claveN")] = c; }
    else if (x.f.claveN !== undefined) cambios[ruta(x, "claveN")] = null;
  });
  return cambios;
}

/* ▌BLOQUE 2 · Nombres parecidos ═════════════════════════════════════════════════
   parecido(a, b): ¿puede ser la misma persona escrita distinto? Solo para SUGERIR («¿Eres tú?» en el
   perfil): nunca enlaza solo, lo confirma la tienda. Idénticos (sin tildes ni mayúsculas) no cuentan:
   esos ya calzan por nombre. */
const palabras = s => normNombre(s).replace(/[.,;'’"-]/g, " ").replace(/\s+/g, " ").trim();
function distancia(a, b){                                 // Levenshtein, con salida temprana sobre 2
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++){
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...cur) > 2) return 3;
    prev = cur;
  }
  return prev[b.length];
}
export function parecido(a, b){
  const x = palabras(a), y = palabras(b);
  if (!x || !y || x === y) return false;
  const px = x.split(" "), py = y.split(" "), [corta, larga] = px.length <= py.length ? [px, py] : [py, px];
  /* Cada palabra de la corta está en la larga, entera o como inicial: «Marco» y «Marco Antonio Benítez»,
     «Marco B.» y «Marco Benítez», «Benítez Marco» y «Marco Benítez». Con al menos una palabra de 3 letras. */
  const usadas = new Set();
  let enteras = 0;   // palabras iguales de 3 letras o más: dos iniciales solas («M. B.») no bastan
  const cubre = corta.every(p => {
    const i = larga.findIndex((q, k) => !usadas.has(k) && (q === p || (p.length === 1 && q[0] === p) || (q.length === 1 && p[0] === q)));
    if (i >= 0 && larga[i] === p && p.length >= 3) enteras++;
    return i >= 0 && usadas.add(i);
  });
  if (cubre && enteras) return true;
  return x.length >= 6 && distancia(x, y) <= 2;          // «Benites» por «Benítez»
}
