/* ▌ÍNDICE de armador.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Marcado y arranque
    2. Registrador de la lista
    3. Buscador de cartas
*/
/* ============================================================
   armador.js — el armador de la lista de mazo
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   El buscador de cartas, las filas con − y +, el contador de 60 y la revisión de la lista. Antes vivía dentro de
   inscripcion.html; ahora lo usan la inscripción y «Mis mazos» (mazos.html), así las dos arman y revisan la lista igual.
   Se monta en el elemento #cajaLista de la página (estilos en armador.css) y usa siempre los mismos id adentro.

   Las fotos de las cartas no se guardan en ningún lado nuestro: el navegador las pide a TCGdex con imagenCarta()
   (listamazo.js). Si una no carga, se saca y la fila queda como antes. Tocar una foto la muestra grande.

     const A = armador({ estandar, pista, alCambiar })
       A.lista()        el texto de la lista, con títulos (lo que se guarda)
       A.poner(texto)   reemplaza la lista que se está armando
       A.revisar()      vuelve a pintar y devuelve lo que leyó leerLista (total, errores, avisos…)
       A.baseE()        la base de Estándar si el formato es Estándar (para la hoja impresa), si no null
       A.formato(est)   cambia entre Estándar (true) y Expandido (false)
   `alCambiar` se llama cada vez que la persona cambia algo (no al poner una lista desde el código).
   ============================================================ */
import { leerLista, cuenta, cargarEstandar, componer, norm, imagenCarta, nombreEn, esEnergiaBasica } from "./listamazo.js?v=e78d9286eec9";

/* ▌BLOQUE 1 · Marcado y arranque ════════════════════════════════════════════════
   El HTML del armador (con un lugar #misMazos para la página), las fotos de TCGdex y la carga de
   la base. */
const $ = id => document.getElementById(id);
const PISTA = "Busca cada carta por su nombre o código y elige la impresión; con − y + cambias la cantidad. «4 iono» agrega 4 de una.";
const MARCADO = pista => `<div class="armarIn">
 <div class="buscar">
  <h2>Lista de mazo</h2>
  <div id="misMazos" class="oculto"></div>
  <p class="pista" id="pistaLista">${esc(pista)}</p>
  <div class="idioma oculto" id="idiomaCartas">
    <span id="idiomaTit">Nombres de las cartas</span>
    <div class="seg" role="group" aria-labelledby="idiomaTit">
      <button type="button" data-idioma="es" aria-pressed="false">Español</button><button type="button" data-idioma="en" aria-pressed="false">English</button>
    </div>
  </div>
  <div class="busca">
    <input id="buscaCarta" type="search" role="combobox" aria-expanded="false" aria-controls="sugerencias"
      aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Busca una carta: «dragapult», «ultra ball»…" aria-label="Buscar una carta">
    <ul id="sugerencias" role="listbox" class="oculto" aria-label="Cartas encontradas"></ul>
  </div>
  <p class="pista" id="baseFecha"></p>
  <details id="importar">
    <summary>¿Juegas en línea? Pega la lista exportada (en español o inglés)</summary>
    <textarea id="pegado" rows="7" spellcheck="false" aria-label="Lista exportada" placeholder="Pokémon: 12
3 Dreepy TWM 128
…
Trainer: 40
…"></textarea>
    <div class="acc"><button type="button" class="btn" id="importarBtn">Usar esta lista</button></div>
    <p class="pista" id="importarMsg" role="status"></p>
  </details>
 </div>
 <div class="mazo">
  <div class="conteo" id="conteo" aria-live="polite"></div>
  <section class="seccion sP"><h3>Pokémon <b id="nP"></b></h3><ul class="cartas" id="filasP"></ul></section>
  <section class="seccion sT"><h3>Entrenadores <b id="nT"></b></h3><ul class="cartas" id="filasT"></ul></section>
  <section class="seccion sE"><h3>Energías <b id="nE"></b></h3><ul class="cartas" id="filasE"></ul></section>
  <ul class="revision" id="revision"></ul>
 </div>
</div>
 <dialog id="verCarta" aria-label="Carta"><img alt=""></dialog>`;

export function armador({ estandar = true, pista = PISTA, alCambiar = () => {} } = {}){
  let BASE = null, BASE_E = null;          // BASE: el buscador y las fotos; BASE_E: además revisa legalidad (solo Estándar)
  let LISTA = { pokemon: [], entrenador: [], energia: [] };
  $("cajaLista").innerHTML = MARCADO(pista);
  const cambio = () => { revisarLista(); alCambiar(); };
  /* Cambiar la foto de un <img> que ya se ve: si solo se cambia «src», el navegador deja la carta anterior hasta que
     baja la nueva (y si la nueva falla, la anterior se queda). Se pone un <img> nuevo, con fondo de carga mientras llega. */
  const cambiarFoto = (img, url, alt) => {
    const n = img.cloneNode(false);
    n.removeAttribute("src"); n.classList.add("cargando");
    if (alt != null) n.alt = alt;
    n.addEventListener("load", () => n.classList.remove("cargando"), { once: true });
    n.src = url;
    img.replaceWith(n);
    return n;
  };
  const foto = (set, num, alt) => { const u = imagenCarta(BASE, set, num); return u ? '<img class="foto" loading="lazy" alt="' + esc(alt) + '" src="' + esc(u) + '">' : ""; };
  /* una foto que no carga (TCGdex caído, carta sin foto) se saca: el error no sube, por eso se escucha en la captura */
  $("cajaLista").addEventListener("error", e => { if (e.target.classList && e.target.classList.contains("foto")) e.target.remove(); }, true);

  /* ▌BLOQUE 2 · Registrador de la lista ═══════════════════════════════════════════
     LISTA por secciones; revisarLista muestra cada carta con su foto y su estado (legal,
     reimpresión, más de 4) y el contador de 60. */
  const SEC_DE_CAT = { P: "pokemon", T: "entrenador", E: "energia" };
  const FILAS = { pokemon: "filasP", entrenador: "filasT", energia: "filasE" };
  const linea = c => c.cant + " " + c.nombre + (c.set ? " " + c.set + " " + c.num : "");
  const lista = () => componer(Object.fromEntries(Object.keys(LISTA).map(k => [k, LISTA[k].map(linea).join("\n")])));
  const copiar = r => ({ pokemon: r.pokemon.map(c => ({ ...c })), entrenador: r.entrenador.map(c => ({ ...c })), energia: r.energia.map(c => ({ ...c })) });
  const ponerLista = texto => { LISTA = copiar(leerLista(texto)); };

  const ESTADO = { fuera: "No es legal en Estándar", reimp: "Otra impresión: en la hoja va con NA" };
  function revisarLista(){
    const r = leerLista(lista(), BASE_E);
    const vacia = !r.total;
    /* Más de 4 por nombre (salvo Energía básica): se marca en cada fila. */
    const porNombre = {};
    [...r.pokemon, ...r.entrenador, ...r.energia].forEach(c => { if (!esEnergiaBasica(c.nombre)) porNombre[norm(c.nombre)] = (porNombre[norm(c.nombre)] || 0) + c.cant; });
    Object.keys(FILAS).forEach(sec => {
      $(FILAS[sec]).innerHTML = r[sec].map((c, i) => {
        const mas4 = porNombre[norm(c.nombre)] > 4, nota = ESTADO[c.estado] || (mas4 ? "Más de 4 copias" : "");
        return '<li class="carta' + (nota ? " mal" : "") + '"><div class="cant">' +
          '<button type="button" data-cambio="-1" data-pos="' + sec + ":" + i + '" aria-label="Una ' + esc(c.nombre) + ' menos">−</button>' +
          "<b>" + c.cant + "</b>" +
          '<button type="button" data-cambio="1" data-pos="' + sec + ":" + i + '" aria-label="Una ' + esc(c.nombre) + ' más">+</button></div>' +
          foto(c.set, c.num, c.nombre) +
          '<div class="nom"><b>' + esc(c.nombre) + "</b><small>" + esc([c.set ? c.set + " " + c.num : "sin expansión", c.x === "A" ? "ACE SPEC" : c.x === "R" ? "reimpresión" : ""].filter(Boolean).join(" · ")) +
          (nota ? ' · <span class="aviso-carta">' + esc(nota) + "</span>" : "") + "</small></div>" +
          (c.reg ? '<span class="reg" title="Marca de regulación">' + esc(c.reg) + "</span>" : "") +
          '<button type="button" class="quitar" data-quitar="' + sec + ":" + i + '" aria-label="Quitar ' + esc(c.nombre) + '">×</button></li>';
      }).join("") || '<li class="vacia">Todavía no hay cartas.</li>';
    });
    [["nP", "pokemon"], ["nT", "entrenador"], ["nE", "energia"]].forEach(([id, k]) => $(id).textContent = cuenta(r, k) || "");
    $("conteo").innerHTML = '<span class="tot' + (vacia ? "" : r.total === 60 ? " ok" : " mal") + '"><b>' + r.total + "</b> / 60</span>" +
      '<span class="grupos">' + [["pokemon", "Pokémon"], ["entrenador", "Entrenadores"], ["energia", "Energías"]].map(([k, t]) => "<span><b>" + cuenta(r, k) + "</b> " + t + "</span>").join("") + "</span>" +
      '<span class="barra' + (r.total > 60 ? " mas" : "") + '" aria-hidden="true">' + '<i class="si"></i>'.repeat(Math.min(r.total, 60)) + "<i></i>".repeat(Math.max(60 - r.total, 0)) + "</span>";
    /* Lo que ya se ve en cada fila no se repite abajo. */
    const enFila = /^(No aparecen en la lista|Estos Pokémon no están|Más de 4 copias)/;
    $("revision").innerHTML = vacia ? "" : r.errores.map(e => '<li class="mal">' + esc(e) + "</li>").join("") +
      r.avisos.filter(a => !enFila.test(a)).map(a => '<li class="av">' + esc(a) + "</li>").join("") +
      (r.errores.length || r.avisos.length ? "" : '<li class="ok">Listo: 60 cartas y nada que revisar.</li>');
    return r;
  }
  $("cajaLista").addEventListener("click", e => {
    const img = e.target.closest(".carta .foto");
    if (img){ const v = $("verCarta"); cambiarFoto(v.querySelector("img"), img.src.replace(/\/low\.webp$/, "/high.webp"), img.alt); v.showModal(); return; }
    const b = e.target.closest("[data-pos],[data-quitar]");
    if (!b) return;
    const [sec, i] = (b.dataset.pos || b.dataset.quitar).split(":"), c = LISTA[sec][+i];
    if (!c) return;
    c.cant += b.dataset.quitar ? -c.cant : +b.dataset.cambio;
    if (c.cant < 1) LISTA[sec].splice(+i, 1);
    c.cant = Math.min(c.cant, 60);
    cambio();
  });
  $("verCarta").onclick = () => $("verCarta").close();

  /* ▌BLOQUE 3 · Buscador de cartas ════════════════════════════════════════════════
     Busca en cartas-estandar.json (legales y reimpresiones), atajo «4 iono», elegir con flechas y
     Enter, pegar la lista exportada. */
  /* Idioma de los nombres: se busca en los dos, y se muestra y agrega en el elegido (se recuerda en este navegador). */
  let IDIOMA = "en";
  try { IDIOMA = localStorage.getItem("armador-idioma") === "es" ? "es" : "en"; } catch(e){ /* sin almacenamiento: inglés */ }
  const nom = c => nombreEn(BASE, c, IDIOMA), otro = c => nombreEn(BASE, c, IDIOMA === "es" ? "en" : "es");
  const pintarIdioma = () => $("idiomaCartas").querySelectorAll("[data-idioma]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.idioma === IDIOMA)));
  $("idiomaCartas").onclick = e => {
    const b = e.target.closest("[data-idioma]"); if (!b) return;
    IDIOMA = b.dataset.idioma; pintarIdioma(); pintarSugerencias();
    try { localStorage.setItem("armador-idioma", IDIOMA); } catch(e){ /* solo por esta visita */ }
  };
  pintarIdioma();
  const ORDEN_REG = { J: 0, I: 1, H: 2, G: 3, F: 4, E: 5, D: 6 };   // las legales primero; las reimpresiones, de la marca más nueva a la más vieja
  const ENERGIA_PREF = ["MEE", "SVE"];
  const prefE = s => { const i = ENERGIA_PREF.indexOf(s); return i < 0 ? 99 : i; };
  /* Una opción por carta (mismo nombre en inglés) con TODAS sus impresiones, como el armador de Limitless: la
     búsqueda calza con cualquiera (en inglés, en castellano o por expansión y número) y la opción trae las demás.
     Primero las impresiones que calzaron (si escribes «ultra ball svi», la de SVI), después las legales de la marca
     más nueva y las reimpresiones viejas al final. La Energía básica, solo las de MEE y SVE (son todas iguales). */
  function buscar(q){
    const ws = norm(q).split(" ").filter(Boolean);
    if (!BASE || !ws.length) return [];
    const todo = ws.join(" "), grupos = new Map();
    for (const c of BASE.cartas){
      const [s, n] = c, nn = norm(nom(c)), k = nn + " " + norm(otro(c)) + " " + s.toLowerCase() + " " + n;
      if (!ws.every(w => k.includes(w))) continue;
      const punt = nn.startsWith(todo) ? 0 : nn.split(" ").some(p => p.startsWith(ws[0])) ? 1 : 2;
      const g = grupos.get(c[2]) || grupos.set(c[2], { punt, calzan: new Set(), imps: [] }).get(c[2]);
      g.punt = Math.min(g.punt, punt); g.calzan.add(c);
    }
    for (const c of BASE.cartas){ const g = grupos.get(c[2]); if (g) g.imps.push(c); }
    const orden = g => (a, b) => (g.calzan.has(b) - g.calzan.has(a)) || (ORDEN_REG[a[4]] ?? 7) - (ORDEN_REG[b[4]] ?? 7) || prefE(a[0]) - prefE(b[0]) || a[0].localeCompare(b[0]) || (parseInt(a[1], 10) || 0) - (parseInt(b[1], 10) || 0);
    return [...grupos.values()].map(g => {
      let imps = g.imps.sort(orden(g));
      if (esEnergiaBasica(imps[0][2])){ const pref = imps.filter(c => prefE(c[0]) < 99); if (pref.length) imps = pref.sort((a, b) => prefE(a[0]) - prefE(b[0]) || (parseInt(a[1], 10) || 0) - (parseInt(b[1], 10) || 0)); }
      return { punt: g.punt, imps };
    }).sort((a, b) => a.punt - b.punt || nom(a.imps[0]).localeCompare(nom(b.imps[0]))).slice(0, 12).map(g => g.imps);
  }
  let OPCIONES = [], ACTIVA = -1, CANT = 1;
  const DETALLE = c => [otro(c) !== nom(c) ? otro(c) : "", c[0] + " " + c[1], c[4], c[5] === "A" ? "ACE SPEC" : c[5] === "R" ? "reimpresión" : ""].filter(Boolean).join(" · ");
  function pintarSugerencias(){
    const q = $("buscaCarta").value.trim();
    /* «4 iono»: el número de adelante es cuántas agregar. */
    const m = /^(\d{1,2})\s+(.+)$/.exec(q);
    CANT = m ? Math.max(+m[1], 1) : 1;
    OPCIONES = buscar(m ? m[2] : q).map(imps => ({ carta: imps[0], imps }));
    /* «2 Carta Nueva ABC 12»: una carta que la base no tiene (o Expandido) se agrega tal cual, eligiendo la sección. */
    if (/^\d{1,2}\s+\S/.test(q) && !OPCIONES.length)
      OPCIONES = ["pokemon", "entrenador", "energia"].map(sec => ({ linea: q, sec }));
    ACTIVA = OPCIONES.length ? 0 : -1;
    const NOM_SEC = { pokemon: "Pokémon", entrenador: "Entrenadores", energia: "Energías" };
    $("sugerencias").innerHTML = OPCIONES.map((o, i) => '<li role="option" id="op' + i + '" data-op="' + i + '"' + (i === ACTIVA ? ' aria-selected="true"' : "") + ">" +
      (o.carta ? (foto(o.carta[0], o.carta[1], "") || '<span class="foto vacia"></span>') + '<span class="sn"><b>' + (CANT > 1 ? CANT + " × " : "") + esc(nom(o.carta)) + "</b></span><small>" + esc(DETALLE(o.carta)) + "</small>" +
        (o.imps.length > 1 ? '<span class="imps" aria-label="Impresiones">' + o.imps.map((c, k) => '<button type="button" tabindex="-1" class="imp' + (k ? "" : " on") + '" data-imp="' + k + '" title="' +
          esc([c[0] + " " + c[1], c[4] ? "marca " + c[4] : "", c[5] === "R" ? "reimpresión" : ""].filter(Boolean).join(" · ")) + '">' + esc(c[0] + " " + c[1]) + "</button>").join("") + "</span>" : "")
               : "Agregar «" + esc(o.linea) + "» a <b>" + NOM_SEC[o.sec] + "</b>") + "</li>").join("") ||
      (q.length > 1 ? '<li class="nada">' + (BASE ? "No encontramos esa carta. Si es nueva, escribe la línea completa: «2 Nombre ABC 12»."
                                                    : "Cargando las cartas…") + "</li>" : "");
    const ver = !!$("sugerencias").innerHTML;
    $("sugerencias").classList.toggle("oculto", !ver);
    $("buscaCarta").setAttribute("aria-expanded", String(ver));
    $("buscaCarta").setAttribute("aria-activedescendant", ACTIVA >= 0 ? "op" + ACTIVA : "");
  }
  $("sugerencias").addEventListener("error", e => { if (e.target.classList && e.target.classList.contains("foto")) e.target.remove(); }, true);
  function elegir(i, imp = 0){
    const o = OPCIONES[i];
    if (!o) return;
    if (o.carta){
      const carta = (o.imps && o.imps[imp]) || o.carta;
      const [set, num, , cat] = carta, nombre = nom(carta), sec = SEC_DE_CAT[cat] || "pokemon";
      const ya = LISTA[sec].find(c => c.set === set && c.num === num);
      if (ya) ya.cant = Math.min(ya.cant + CANT, 60); else LISTA[sec].push({ cant: CANT, nombre, set, num });
    } else {
      const r = leerLista({ pokemon: "Pokémon:", entrenador: "Entrenador:", energia: "Energía:" }[o.sec] + "\n" + o.linea);
      LISTA[o.sec].push(...r[o.sec].map(c => ({ ...c })));
    }
    $("buscaCarta").value = ""; pintarSugerencias(); cambio(); $("buscaCarta").focus();
  }
  $("buscaCarta").oninput = pintarSugerencias;
  $("buscaCarta").onkeydown = e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp"){
      if (!OPCIONES.length) return;
      e.preventDefault();
      ACTIVA = (ACTIVA + (e.key === "ArrowDown" ? 1 : -1) + OPCIONES.length) % OPCIONES.length;
      $("sugerencias").querySelectorAll("[data-op]").forEach(li => li.toggleAttribute("aria-selected", +li.dataset.op === ACTIVA));
      $("buscaCarta").setAttribute("aria-activedescendant", "op" + ACTIVA);
    } else if (e.key === "Enter"){ e.preventDefault(); elegir(ACTIVA); }
    else if (e.key === "Escape"){ $("buscaCarta").value = ""; pintarSugerencias(); }
  };
  /* mousedown y no click: con click, el campo pierde el foco antes y la lista se cierra. */
  $("sugerencias").onmousedown = e => { const li = e.target.closest("[data-op]"), imp = e.target.closest("[data-imp]"); if (li){ e.preventDefault(); elegir(+li.dataset.op, imp ? +imp.dataset.imp : 0); } };
  /* Pasar por una impresión muestra su foto en la opción. */
  $("sugerencias").addEventListener("mouseover", e => {
    const b = e.target.closest("[data-imp]"), li = b && b.closest("[data-op]"), o = li && OPCIONES[+li.dataset.op];
    if (!o) return;
    const c = o.imps[+b.dataset.imp], u = imagenCarta(BASE, c[0], c[1]), img = li.querySelector(".foto");
    li.querySelectorAll(".imp").forEach(x => x.classList.toggle("on", x === b));
    if (img && img.getAttribute("src") === u) return;
    /* Siempre se reemplaza: una impresión sin foto (TCGdex no la tiene) deja el espacio vacío, no la carta anterior. */
    if (u && img && img.tagName === "IMG") cambiarFoto(img, u);
    else {
      const n = u ? Object.assign(document.createElement("img"), { className: "foto cargando", alt: "" }) : Object.assign(document.createElement("span"), { className: "foto vacia" });
      if (u){ n.addEventListener("load", () => n.classList.remove("cargando"), { once: true }); n.src = u; }
      if (img) img.replaceWith(n); else li.prepend(n);
    }
  });
  $("buscaCarta").onblur = () => setTimeout(() => { $("sugerencias").classList.add("oculto"); $("buscaCarta").setAttribute("aria-expanded", "false"); }, 150);
  $("buscaCarta").onfocus = pintarSugerencias;

  /* --- pegar la lista exportada: reemplaza la que hay. */
  $("importarBtn").onclick = () => {
    const t = $("pegado").value.trim();
    if (!t) return;
    const r = leerLista(t);
    const malas = r.errores.filter(e => /^(No entendí|Falta el título|«)/.test(e));
    if (LISTA.pokemon.length + LISTA.entrenador.length + LISTA.energia.length && !confirm("¿Reemplazar la lista que llevas por la que pegaste?")) return;
    LISTA = copiar(r);
    $("importarMsg").textContent = r.total + " cartas importadas." + (malas.length ? " No se pudieron leer: " + malas.join(" ") : "");
    $("pegado").value = ""; $("importar").open = !!malas.length;
    cambio();
  };

  revisarLista();
  const cargada = cargarEstandar().then(b => {
    BASE = b; BASE_E = estandar ? b : null; revisarLista();
    if (b){
      $("idiomaCartas").classList.toggle("oculto", !Object.keys(b.es).length);
      /* Para saber si la base ya trae la última expansión: la fecha en que se armó. */
      const f = /^\d{4}-\d{2}-\d{2}$/.test(b.actualizado || "") && new Date(b.actualizado + "T12:00:00");
      $("baseFecha").textContent = f ? "Cartas de Estándar al " + f.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) +
        ". Una carta de una expansión más nueva se agrega escribiendo la línea completa: «2 Nombre ABC 12»." : "";
    }
    return b;
  });
  /* cambiar de Estándar a Expandido (o al revés) con la lista armada: cambia solo la revisión de legalidad */
  const formato = e => { estandar = e; BASE_E = e ? BASE : null; revisarLista(); };
  return { lista, poner: ponerLista, revisar: revisarLista, baseE: () => BASE_E, formato, cargada };
}
