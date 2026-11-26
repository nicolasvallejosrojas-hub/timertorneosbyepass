/* ▌ÍNDICE de probar.js
    1. Montar: las cartas de la lista, la guía, la meta principal y las pestañas
    2. Números
    3. Metas (ejemplos con tu lista y «Probar un cambio»)
    3b. Riesgos (Básicos malos, premios, líneas de evolución, rotación) y el texto de las cartas (TCGdex)
    4. Por turno
    5. Mesa
   (Motores y Atacantes viven en motores.js y atacantes.js; Comparar dos listas, en comparar.js)
*/
/* ============================================================
   probar.js — «Probar mazo» en Mis mazos (mazos.html, vista #vistaProbar)
   ------------------------------------------------------------
   Vistas sobre la misma lista: Números (exacto: resumen, gráficos y una fila por carta), Motores (robo, búsqueda y Energía leídos
   del texto de cada carta), Atacantes (ranking con orden e importancia del jugador), Metas (simulación de 100.000 partidas, con
   semáforo, ejemplos armados con la lista, la meta principal y «Probar un cambio»), Riesgos (abrir con un Básico malo, premios,
   líneas de evolución y rotación), Por turno (curva de una carta, con una copia más o menos) y Mesa (una mano de prueba).
   Ayuda: la guía «¿Qué quieres saber de tu mazo?» lleva a la vista que responde cada pregunta, con un ejemplo calculado con la
   lista; cada número y gráfico tiene su «¿Cómo se lee?» (details nativo).
   La matemática está en probabilidad.js y la lectura del texto de las cartas en efectos.js. El texto sale de TCGdex (tcgdex.js, con
   caché). En este navegador, por mazo: las metas («probar-metas:<mazo>»), los Básicos malos («probar-malos:<mazo>»), los roles
   corregidos a mano («probar-roles:<mazo>») y los atacantes («probar-atacantes:<mazo>»); y si la guía está cerrada («probar-guia»).
   esc() es la global de config.js.
   ============================================================ */
import { norm, esEnergiaBasica as esBasicaNombre } from "./listamazo.js?v=aec73935b9fd";
import { mulligan, alMenosUna, premios, distBasicos, promedioBasicos, soloMalos, energiasDist, mulligansPromedio, simular, repartir } from "./probabilidad.js?v=aec73935b9fd";
import { armarCartas, motivoNoSePuede } from "./analisis.js?v=aec73935b9fd";
import { idTcgdex, datoCarta } from "./tcgdex.js?v=aec73935b9fd";
import { pct, dif, num, TURNO, leerLS, guardarLS, ayuda, barras, columnas } from "./probar-ui.js?v=aec73935b9fd";
import { montarMotores, calcularGrupos } from "./motores.js?v=aec73935b9fd";
import { montarAtacantes } from "./atacantes.js?v=aec73935b9fd";

const esEnergiaBasica = c => esBasicaNombre(c.nombre);   // sin tope de copias (listamazo.js)
/* Cartas conocidas (nombre en inglés de la base): los ejemplos de metas las usan mientras no llega el texto de TCGdex. */
const BUSCAN_BASICOS = ["Buddy-Buddy Poffin", "Nest Ball", "Ultra Ball", "Level Ball", "Quick Ball", "Hisuian Heavy Ball", "Poké Ball", "Great Ball"];
const PARTIDARIOS_ROBO = ["Professor's Research", "Iono", "Arven", "Lillie's Determination", "Dawn", "Hilda", "Crispin", "Carmine", "Judge", "Cyrano",
  "Penny", "Brock's Scouting", "Colress's Tenacity", "Team Rocket's Petrel", "Ciphermaniac's Codebreaking", "Professor Turo's Scenario", "Professor Sada's Vitality"];

/* ▌BLOQUE 1 · Montar ════════════════════════════════════════════════════════════ */
export function montarProbar(caja, { lista, base, clave = "sin-guardar", alComparar = null }){
  const a = armarCartas(lista, base), { CARTAS, N, B, E, MAZO, ES_B } = a, sinProbar = motivoNoSePuede(a);
  if (sinProbar){ caja.innerHTML = '<p class="vacio">' + sinProbar + "</p>"; return; }
  /* La probabilidad de una carta (o con «extra» copias más: esas reemplazan cartas de las otras). */
  const prob = (c, extra = 0, vistas = 7) => alMenosUna({ N, t: c.cant + extra, tb: c.basico ? c.cant + extra : 0, b: B + (c.basico ? extra : 0), vistas });
  const foto = c => c.foto ? '<img src="' + esc(c.foto) + '" alt="" loading="lazy">' : '<span class="sinF"></span>';
  const porNombre = n => CARTAS.find(c => c.nombre === n);
  const unas = CARTAS.filter(c => c.cant === 1 && !esEnergiaBasica(c));
  const premUnas = unas.length ? premios({ N, t: unas.length, tb: unas.filter(c => c.basico).length, b: B }) : null;
  const dist = distBasicos(N, B);
  /* La carta que más gana con una copia más (para el ejemplo de la guía). */
  const mejorMas = CARTAS.filter(c => c.x !== "A" && (c.cant < 4 || esEnergiaBasica(c))).map(c => ({ c, d: prob(c, 1) - prob(c) })).sort((a, b) => b.d - a.d)[0];

  /* La guía: cada pregunta lleva a su vista, con un ejemplo calculado con esta lista. */
  const GUIA = [
    { q: "¿Mi mazo arranca bien?", v: "numeros", foco: "g-mull",
      a: "Mira el <b>mulligan</b> y <b>cuántos Básicos trae la mano</b>. En tu lista, " + pct(mulligan(N, B), 1) + " de las manos son mulligan y " + pct(dist[1], 0) +
         " de las que se juegan traen un solo Básico (empiezas sin Banca). Los gráficos muestran cuánto cambia con más o menos Básicos." },
    { q: "¿Cuántas copias pongo de una carta?", v: "numeros", foco: "g-tabla",
      a: "En la tabla, la columna <b>+1 copia</b> dice cuánto sube la probabilidad de tenerla en la mano con una copia más." +
         (mejorMas ? " Ejemplo: una " + esc(mejorMas.c.nombre) + " más la sube de " + pct(prob(mejorMas.c), 0) + " a " + pct(prob(mejorMas.c, 1), 0) + "." : "") +
         " Toca una carta para ver su curva turno a turno." },
    { q: "¿Llego a mi jugada a tiempo?", v: "metas", foco: "g-ejemplos",
      a: "En <b>Metas</b> escribes lo que necesitas y en qué turno (por ejemplo, «Rare Candy y una Fase 2 al turno 2»). Se prueba en 100.000 partidas. " +
         "Abajo hay ejemplos armados con tu lista: toca uno para probarlo." },
    { q: "¿Saco una carta y meto otra?", v: "metas", foco: "g-cambio",
      a: "Usa <b>Probar un cambio</b>: eliges qué sale y qué entra, y ves cómo se mueven el mulligan y todas tus metas. Sirve más con al menos una meta creada." },
    { q: "¿Qué puedo perder en premios?", v: "riesgos", foco: "g-premios",
      a: premUnas ? "Tienes " + unas.length + (unas.length === 1 ? " carta" : " cartas") + " de 1 copia: en " + pct(premUnas.al1, 0) + " de las partidas al menos una queda en premios. " +
         "En <b>Riesgos</b> también ves si se puede cortar una línea de evolución." : "En <b>Riesgos</b> ves qué cartas y líneas de evolución puedes perder en premios." },
    { q: "¿Cuántos motores de robo y búsqueda tengo?", v: "motores", foco: "g-motores",
      a: () => { const g = calcularGrupos(a, TEXTOS, ctx.over || {}), robo = g.find(x => x.id === "robo"), busca = g.find(x => x.id === "buscaPokemon");
        return ESTADO_TEXTOS !== "listo" ? "En <b>Motores</b> ves cuántas cartas roban, buscan Pokémon o mueven Energía, y qué tan seguido llega al menos una a tu mano. Está leyendo el texto de las cartas: en unos segundos aparece completo."
          : "En tu lista hay <b>" + robo.t + (robo.t === 1 ? " carta" : " cartas") + " de robo directo</b> (al menos una en el " + pct(robo.p7, 0) + " de las manos) y <b>" + busca.t + " que buscan Pokémon</b> (" + pct(busca.p7, 0) + "). " +
            "En <b>Motores</b> está el detalle, cuándo conviene cada robo y cómo leí cada carta, por si quieres corregirla."; } },
    { q: "¿Quiénes son mis mejores atacantes?", v: "atacantes", foco: "g-atacantes",
      a: "En <b>Atacantes</b> eliges quiénes atacan en tu mazo y salen ordenados por daño por Energía y qué tan seguido llegan a atacar, con su línea de evolución. Puedes fijar tú el orden con las flechas y la importancia con las estrellas." },
    alComparar && { q: "¿En qué se diferencia de otra lista?", accion: alComparar },
    { q: "Quiero ver cómo sale una mano", v: "mesa", foco: "",
      a: "En <b>Mesa</b> se reparte una mano de verdad (con los mulligans que toquen) y los 6 premios boca abajo. Roba, mira los premios y reparte otra cuantas veces quieras." },
  ].filter(Boolean);

  caja.innerHTML =
    '<p class="meta pr-res">' + N + " cartas · " + B + " Pokémon Básicos · " + E + " Energías" + (N !== 60 ? " · <b>no son 60</b>: los números son para esta lista tal como está" : "") + "</p>" +
    '<section class="guia" aria-labelledby="guiaT"><div class="guiaCab"><h3 id="guiaT">¿Qué quieres saber de tu mazo?</h3>' +
      '<button type="button" class="btn chico" data-guia-ver aria-expanded="true">Ocultar</button></div>' +
      '<div class="guiaQs">' + GUIA.map((g, k) => '<button type="button" class="guiaQ" data-g="' + k + '">' + g.q + "</button>").join("") + "</div>" +
      '<div class="respuesta oculto" data-resp role="status"></div></section>' +
    '<div class="principal oculto" data-principal></div>' +
    '<div class="seg vistas" role="tablist" aria-label="Vistas de la prueba">' +
      [["numeros", "Números"], ["motores", "Motores"], ["atacantes", "Atacantes"], ["metas", "Metas"], ["riesgos", "Riesgos"], ["turnos", "Por turno"], ["mesa", "Mesa"]].map(([v, t], k) =>
        '<button type="button" role="tab" data-v="' + v + '" aria-selected="' + (k === 0) + '">' + t + "</button>").join("") + "</div>" +
    ["numeros", "motores", "atacantes", "metas", "riesgos", "turnos", "mesa"].map((v, k) => '<section class="caja' + (k ? " oculto" : "") + '" data-p="' + v + '"></section>').join("");
  const P = v => caja.querySelector('[data-p="' + v + '"]');
  const ver = v => {
    caja.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.v === v)));
    caja.querySelectorAll("[data-p]").forEach(s => s.classList.toggle("oculto", s.dataset.p !== v));
    if (v === "mesa"){ if (!mesa) otraMano(); } else PINTAR[v]?.();
  };
  caja.querySelectorAll("[data-v]").forEach(b => b.onclick = () => ver(b.dataset.v));
  caja.addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.replaceWith(Object.assign(document.createElement("span"), { className: "sinF" })); }, true);
  /* la guía */
  const guia = caja.querySelector(".guia"), resp = caja.querySelector("[data-resp]");
  const plegarGuia = cerrada => {
    guia.classList.toggle("cerrada", cerrada);
    const b = guia.querySelector("[data-guia-ver]"); b.textContent = cerrada ? "Ver preguntas" : "Ocultar"; b.setAttribute("aria-expanded", String(!cerrada));
    guardarLS("probar-guia", cerrada);
  };
  plegarGuia(leerLS("probar-guia", false) === true);
  guia.querySelector("[data-guia-ver]").onclick = () => plegarGuia(!guia.classList.contains("cerrada"));
  guia.querySelector(".guiaQs").onclick = e => {
    const b = e.target.closest("[data-g]"); if (!b) return;
    const g = GUIA[+b.dataset.g];
    if (g.accion){ g.accion(); return; }
    guia.querySelectorAll("[data-g]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    resp.innerHTML = "<p>" + (typeof g.a === "function" ? g.a() : g.a) + '</p><button type="button" class="btn chico" data-resp-cerrar>Entendido</button>';
    resp.classList.remove("oculto");
    ver(g.v);
    const foco = g.foco && caja.querySelector("#" + g.foco);
    if (foco){ foco.classList.add("resaltado"); setTimeout(() => foco.classList.remove("resaltado"), 2400); }
  };
  resp.onclick = e => { if (e.target.closest("[data-resp-cerrar]")){ resp.classList.add("oculto"); guia.querySelectorAll("[data-g]").forEach(x => x.removeAttribute("aria-pressed")); } };

  /* ▌BLOQUE 2 · Números ═══════════════════════════════════════════════════════════ */
  {
    let filas = "", sec = "";
    for (const c of CARTAS){
      if (c.sec !== sec){ sec = c.sec; filas += '<tr class="sec"><td colspan="5">' + sec + "</td></tr>"; }
      const m = prob(c), t2 = prob(c, 0, 9), pr = premios({ N, t: c.cant, tb: c.basico ? c.cant : 0, b: B });
      filas += '<tr class="fila" data-i="' + c.i + '" tabindex="0"><td><div class="nomC">' + foto(c) + "<span><b>" + esc(c.nombre) + "</b> <em>×" + c.cant + "</em>" +
        (c.basico ? '<span class="marcaB" title="Pokémon Básico">B</span>' : "") + (c.x === "A" ? '<span class="marcaB">ACE</span>' : "") + "</span></div></td>" +
        "<td>" + pct(m) + '</td><td class="colT"><div class="tb"><div class="pbar"><i style="width:' + (t2 * 100).toFixed(1) + '%"></i></div><small>' + pct(t2) + "</small></div></td>" +
        '<td class="colP">' + pct(pr.al1) + "</td><td>" + (c.x === "A" ? '<small class="pista">máx. 1</small>' : c.cant >= 4 && !esEnergiaBasica(c) ? '<small class="pista">máx. 4</small>'
          : '<span class="sube">' + dif(prob(c, 1) - m) + "</span>") + "</td></tr>";
    }
    const en = energiasDist(N, B, E), mp = mulligansPromedio(N, B);
    const rango = []; for (let b = Math.max(1, B - 4); b <= Math.min(N - 7, B + 4); b++) rango.push([b, mulligan(N, b)]);
    P("numeros").innerHTML =
      '<div class="resumen">' +
        '<div class="dato" id="g-mull"><small>Mulligan</small><b>' + pct(mulligan(N, B), 1) + "</b><span>de las manos no traen Básico y se reparten de nuevo.</span>" +
          ayuda("Es la probabilidad de que las 7 cartas iniciales no traigan ningún Pokémon Básico. Cada mulligan le da al rival una carta extra: con tu lista le regalas " +
            num(mp, 2) + " cartas por partida, en promedio. <b>Lo cambia:</b> la cantidad de Básicos (mira el gráfico de abajo). Las cartas que buscan Básicos no lo bajan, porque se juegan después de la mano inicial.") + "</div>" +
        '<div class="dato"><small>Manos sin Energía</small><b>' + pct(en[0], 1) + "</b><span>con " + E + " Energías · " + pct(en.slice(3).reduce((a, b) => a + b, 0), 1) + " traen 3 o más.</span>" +
          ayuda("De las manos que se juegan, cuántas no traen ninguna Energía (no puedes unir el primer turno) y cuántas traen 3 o más (muchas Energías y pocas cartas que hagan algo). " +
            "<b>Lo cambia:</b> la cantidad de Energías y las cartas que buscan Energía.") + "</div>" +
        '<div class="dato"><small>Una carta de 1 copia en premios</small><b>' + pct(premios({ N, t: 1, b: B }).al1, 1) + "</b><span>en cada partida: la pierdes hasta tomar ese premio.</span>" +
          ayuda("Una carta de la que juegas una sola copia queda en los 6 premios más o menos 1 de cada 10 partidas, sea cual sea. Si es clave, juega 2 copias o ten cómo recuperarla. " +
            "En <b>Riesgos</b> está el cálculo para todas tus cartas de 1 copia juntas.") + "</div>" +
        '<div class="dato ancho grafico"><small>Básicos en la mano · ' + num(promedioBasicos(N, B)) + " en promedio</small>" +
          barras([["1 Básico", dist[1]], ["2", dist[2]], ["3", dist[3]], ["4 o más", dist.slice(4).reduce((a, b) => a + b, 0)]], 0) +
          ayuda("Cada barra es el porcentaje de manos (de las que se juegan) que trae esa cantidad de Pokémon Básicos. Con <b>1 Básico</b> empiezas sin Banca: si el rival lo deja Fuera de Combate " +
            "o te lo cambia con Boss's Orders, puedes perder sin jugar. <b>Ejemplo:</b> si «1 Básico» pasa de la mitad, sumar un Básico o cartas que pongan Básicos en la Banca el turno 1 ayuda.") + "</div>" +
        '<div class="dato grafico mitad"><small>Mulligan según cuántos Básicos juegas</small>' + columnas(rango.map(([b, p]) => [b, p]), B, "Mulligan según la cantidad de Básicos") +
          ayuda("Cada columna es el mulligan con esa cantidad de Básicos en un mazo de " + N + " cartas; la marcada es tu lista (" + B + "). " +
            "Cada Básico de más baja el mulligan, pero ocupa el lugar de otra carta: el salto grande está en los primeros.") + "</div>" +
        '<div class="dato grafico mitad"><small>Energías en la mano</small>' +
          columnas([["0", en[0]], ["1", en[1]], ["2", en[2]], ["3", en[3]], ["4+", en.slice(4).reduce((a, b) => a + b, 0)]], "", "Energías en la mano") +
          ayuda("Cada columna es el porcentaje de manos con esa cantidad de Energías. Lo ideal depende del mazo: uno que une una Energía por turno quiere casi siempre 1 o 2 en la mano inicial.") + "</div>" +
      "</div>" +
      '<div id="g-tabla"><p class="pista">Probabilidad de tener <b>al menos una copia</b>, ya contando el mulligan. Toca una carta para ver su curva por turno.</p>' +
      ayuda("<b>En la mano:</b> en las 7 cartas iniciales. <b>Al turno 2:</b> vista hasta tu segundo turno (la mano y 2 robos). <b>En premios:</b> al menos una copia queda entre los 6 premios. " +
        "<b>+1 copia:</b> cuántos puntos sube «En la mano» si juegas una más (reemplazando otra carta). <b>Ejemplo:</b> si una carta clave está en 30 % y con +1 copia sube 8 puntos, " +
        "pasar de 3 a 4 copias se nota en 1 de cada 12 partidas.") +
      '<table class="tabla"><thead><tr><th>Carta</th><th>En la mano</th><th class="colT">Al turno 2</th><th class="colP">En premios</th><th>+1 copia</th></tr></thead><tbody>' + filas + "</tbody></table></div>";
    const abrirCurva = f => { if (f){ sel.value = f.dataset.i; ver("turnos"); } };
    P("numeros").onclick = e => abrirCurva(e.target.closest(".fila"));
    P("numeros").onkeydown = e => { if (e.key === "Enter") abrirCurva(e.target.closest(".fila")); };
  }

  /* ▌BLOQUE 3 · Metas ═════════════════════════════════════════════════════════════
     Cada meta: requisitos (cada uno, una o varias cartas: «cualquiera de»), un turno y si es la principal.
     simularEn corre una meta sobre otra lista (para «Probar un cambio»). */
  const LS = "probar-metas:" + clave;
  let METAS = leerLS(LS, []).filter(m => m && Array.isArray(m.reqs) && m.reqs.every(x => Array.isArray(x) && x.some(porNombre)));
  const guardarMetas = () => guardarLS(LS, METAS.map(({ tit, reqs, turno, principal }) => ({ tit, reqs, turno, ...(principal ? { principal: true } : {}) })));
  const opciones = vacia => (vacia ? '<option value="">' + vacia + "</option>" : "") + CARTAS.map(c => '<option value="' + esc(c.nombre) + '">' + esc(c.nombre) + "</option>").join("");
  const simularEn = (cartas, m) => {
    const mazo = cartas.flatMap((c, i) => Array(Math.max(0, c.cant)).fill(i)), esB = cartas.map(c => c.basico);
    return simular({ mazo, esBasico: esB, reqs: m.reqs.map(x => x.map(n => cartas.findIndex(c => c.nombre === n && c.cant > 0)).filter(i => i >= 0)), turno: m.turno });
  };
  const resultado = m => m.res ??= simular({ mazo: MAZO, esBasico: ES_B, reqs: m.reqs.map(x => x.map(porNombre).filter(Boolean).map(c => c.i)), turno: m.turno });
  const color = p => p >= .8 ? "verde" : p >= .6 ? "amarilla" : "roja";
  const agregarMeta = (reqs, turno, tit) => {
    METAS.push({ tit, reqs, turno, ...(METAS.some(m => m.principal) ? {} : { principal: true }) });
    guardarMetas(); pintarMetas();
  };
  /* Ejemplos con la lista: el Básico con más copias, con o sin las cartas que lo buscan; un Partidario de
     robo; y la Fase 2 con Rare Candy (cuando TCGdex dice cuál es la Fase 2). */
  const EJEMPLOS = () => {
    const cant = (n, k) => CARTAS.filter(c => n.includes(c.en)).map(c => c.nombre).slice(0, k);
    const b1 = CARTAS.filter(c => c.basico).sort((a, b) => b.cant - a.cant)[0], busca = cant(BUSCAN_BASICOS, 3), part = cant(PARTIDARIOS_ROBO, 5);
    const ej = [{ tit: b1.nombre + " en la mano", reqs: [[b1.nombre]], turno: 0, por: "Tu Básico con más copias: ¿cuántas veces empiezas con él?" }];
    if (busca.length) ej.push({ tit: b1.nombre + " o algo que lo busque, en la mano", reqs: [[b1.nombre, ...busca]], turno: 0, por: "Contando las cartas que lo buscan (" + busca.join(", ") + ")." });
    if (part.length) ej.push({ tit: "Un Partidario de robo al turno 2", reqs: [part], turno: 2, por: "Cualquiera de: " + part.join(", ") + "." });
    const candy = CARTAS.find(c => c.en === "Rare Candy");
    (LINEAS && LINEAS !== "error" ? LINEAS : []).forEach(({ basico, miembros }) => {
      const f2 = miembros.find(c => c.fase === "Stage2");
      if (candy && f2) ej.push({ tit: candy.nombre + " + " + f2.nombre + " al turno 2", reqs: [[candy.nombre], [f2.nombre], [basico.nombre]], turno: 2,
        por: "Para evolucionar de " + basico.nombre + " a " + f2.nombre + " el turno 2 necesitas las tres: el Básico, la Fase 2 y el Caramelo." });
    });
    return ej.filter(e => !METAS.some(m => m.tit === e.tit));
  };
  function pintarPrincipal(){
    const m = METAS.find(x => x.principal), d = caja.querySelector("[data-principal]");
    if (!m){ d.className = "principal oculto"; return; }
    const res = resultado(m);
    d.className = "principal " + color(res.p);
    d.innerHTML = "<small>Tu meta principal</small><b>" + pct(res.p, 1) + '</b><span class="t">' + esc(m.tit) + "</span>" +
      '<span class="q">Es lo que tu mazo necesita para funcionar: los demás números explican por qué está así. Cámbiala con la estrella en Metas.</span>';
  }
  function pintarMetas(){
    const cuenta = { verde: 0, amarilla: 0, roja: 0 };
    METAS.forEach(m => cuenta[color(resultado(m).p)]++);
    const resumen = [cuenta.verde && cuenta.verde + " bien", cuenta.amarilla && cuenta.amarilla + (cuenta.amarilla > 1 ? " justas" : " justa"),
                     cuenta.roja && cuenta.roja + (cuenta.roja > 1 ? " bajas" : " baja")].filter(Boolean).join(" · ");
    const ej = EJEMPLOS();
    P("metas").innerHTML =
      '<p class="pista">Una meta es algo que tu mazo necesita, en un turno: por ejemplo «Rare Candy y una Fase 2 al turno 2». Cada meta se prueba en 100.000 partidas simuladas, con mulligan y premios.</p>' +
      ayuda("<b>Cómo se arma:</b> en «Necesito» eliges la carta; si otra te sirve igual, ponla en «O en su lugar»; si necesitas dos cosas a la vez, la segunda va en «Y además». " +
        "<b>El turno:</b> «en la mano» son las 7 iniciales; «al turno 2» suma los robos de tus dos primeros turnos. <b>El número:</b> en cuántas partidas de 100 lo tienes; " +
        "el «±» es el margen de la simulación (diferencias menores a eso pueden ser azar). <b>El color:</b> verde desde 80 %, amarillo de 60 a 80 % y rojo bajo 60 %. " +
        "La <b>estrella</b> marca tu meta principal, que va arriba de todo.", "¿Cómo funcionan las metas?") +
      '<div class="leyenda"><span><i style="background:var(--ok)"></i>80 % o más: bien</span><span><i style="background:var(--amarillo)"></i>60 a 80 %: justo</span>' +
        '<span><i style="background:var(--negativo)"></i>menos de 60 %: bajo</span>' + (resumen ? "<b>" + resumen + "</b>" : "") + "</div>" +
      (ej.length ? '<div class="ejemplos" id="g-ejemplos"><b>Ejemplos con tu lista</b> <span class="pista">· tócalo para probarlo</span><div class="ejs">' +
        ej.map((e, k) => '<button type="button" class="ej" data-ej="' + k + '"><span class="et">' + esc(e.tit) + '</span><span class="pista">' + esc(e.por) + "</span></button>").join("") + "</div></div>" : "") +
      '<div class="metas">' + METAS.map((m, k) => {
        const res = resultado(m), col = color(res.p);
        return '<div class="meta-c ' + col + '"><div class="botonesMeta">' +
          '<button type="button" class="x" data-estrella="' + k + '" aria-pressed="' + !!m.principal + '" aria-label="' + (m.principal ? "Quitar como meta principal" : "Marcar como meta principal") + '">' + (m.principal ? "★" : "☆") + "</button>" +
          '<button type="button" class="x" data-q="' + k + '" aria-label="Quitar la meta ' + esc(m.tit) + '">×</button></div><span class="estado">' +
          { verde: "Bien", amarilla: "Justo", roja: "Bajo" }[col] + (m.principal ? " · principal" : "") + '</span><span class="t">' + esc(m.tit) + '</span><span class="p">' + pct(res.p, 1) +
          "<small>±" + (res.mas * 100).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '</small></span><span class="q">' +
          m.reqs.map(x => x.map(esc).join(" o ")).join(" <b>y</b> ") + ", " + TURNO(m.turno) + "</span></div>";
      }).join("") +
      '<form class="nueva" data-f="meta"><b>Nueva meta</b>' +
        '<label class="campo"><span>Necesito</span><select data-n="1">' + opciones() + "</select></label>" +
        '<label class="campo"><span>O en su lugar (opcional)</span><select data-n="1o">' + opciones("—") + "</select></label>" +
        '<label class="campo"><span>Y además (opcional)</span><select data-n="2">' + opciones("—") + "</select></label>" +
        '<label class="campo"><span>¿Cuándo?</span><select data-n="t"><option value="0">en la mano</option><option value="1">al turno 1</option><option value="2" selected>al turno 2</option><option value="3">al turno 3</option></select></label>' +
        '<button class="btn primario chico">Agregar meta</button></form></div>' +
      /* Probar un cambio: sale una copia de una carta y entra otra (de la lista o de la base de Estándar) */
      '<form class="cambio" data-f="cambio" id="g-cambio"><h3>Probar un cambio</h3><p class="pista">Sale una copia de una carta y entra otra: se vuelven a simular el mulligan y todas tus metas con la lista nueva.</p>' +
        ayuda("<b>Ejemplo:</b> dudas entre una Hilda y un Buddy-Buddy Poffin. Pon «Sale: Hilda» y «Entra: Buddy-Buddy Poffin». Verás, para cada meta, el porcentaje de ahora → con el cambio, " +
          "y cuánto sube (verde) o baja (rojo). Si una meta importante baja y otra sube, decide por tu meta principal. Puedes meter cualquier carta de Estándar, aunque no esté en tu lista.", "¿Cómo se usa?") +
        '<div class="filaCambio"><label class="campo"><span>Sale</span><select data-c="sale">' + opciones() + "</select></label>" +
        '<label class="campo"><span>Entra</span><input data-c="entra" list="probarCartas" placeholder="Una carta de tu lista u otra" autocomplete="off"></label>' +
        '<button class="btn chico">Probar</button></div><datalist id="probarCartas">' + nombresBase() + '</datalist><div data-c="res" aria-live="polite"></div></form>';
    P("metas").querySelectorAll("[data-ej]").forEach(b => b.onclick = () => { const e = ej[+b.dataset.ej]; agregarMeta(e.reqs, e.turno, e.tit); });
    pintarPrincipal();
  }
  /* Nombres para «Entra»: los de la lista primero y después los de la base de Estándar (sin repetir). */
  let NOMBRES_BASE = null;
  function nombresBase(){
    if (NOMBRES_BASE === null){
      const vistos = new Set(CARTAS.map(c => norm(c.nombre)));
      NOMBRES_BASE = CARTAS.map(c => c.nombre).concat(((base && base.cartas) || []).map(c => c[2]).filter(n => !vistos.has(norm(n)) && vistos.add(norm(n))));
    }
    return NOMBRES_BASE.map(n => '<option value="' + esc(n) + '">').join("");
  }
  function probarCambio(form){
    const sale = form.querySelector('[data-c="sale"]').value, entra = form.querySelector('[data-c="entra"]').value.trim().replace(/\s+/g, " "), out = form.querySelector('[data-c="res"]');
    if (!entra){ out.innerHTML = '<p class="err">Escribe qué carta entra.</p>'; return; }
    if (norm(entra) === norm(sale)){ out.innerHTML = '<p class="err">La que entra es la misma que sale.</p>'; return; }
    const cartas = CARTAS.map(c => ({ nombre: c.nombre, cant: c.cant, basico: c.basico, sec: c.sec }));
    cartas.find(c => c.nombre === sale).cant--;
    let nueva = cartas.find(c => norm(c.nombre) === norm(entra));
    if (nueva) nueva.cant++;
    else {
      const x = (base && base.nombres && base.nombres.get(norm(entra))) || "";
      nueva = { nombre: entra, cant: 1, basico: x.includes("B"), sec: "" };
      cartas.push(nueva);
    }
    const b2 = cartas.filter(c => c.basico).reduce((s, c) => s + c.cant, 0);
    const aviso = nueva.cant > 4 && !esEnergiaBasica(nueva) ? '<p class="err">Ojo: quedarían ' + nueva.cant + " copias de " + esc(nueva.nombre) + " (máximo 4).</p>" : "";
    const fila = (t, a, b) => '<div class="r"><span>' + t + "</span><span>" + pct(a, 1) + " → " + pct(b, 1) + ' <span class="' + (b - a > 0.001 ? "sube" : b - a < -0.001 ? "baja" : "igual") + '">' +
      (Math.abs(b - a) <= 0.001 ? "=" : dif(b - a)) + "</span></span></div>";
    /* el mulligan es «malo» si sube: se muestra con el color al revés */
    const filaMull = (a, b) => fila("Mulligan (menos es mejor)", a, b).replace('class="sube"', 'class="TMP"').replace('class="baja"', 'class="sube"').replace('class="TMP"', 'class="baja"');
    out.innerHTML = aviso + '<div class="resCambio"><b>Sale 1 ' + esc(sale) + ", entra 1 " + esc(nueva.nombre) + "</b>" +
      (b2 ? filaMull(mulligan(N, B), mulligan(N, b2)) + METAS.map(m => fila(esc(m.tit), resultado(m).p, simularEn(cartas, m).p)).join("")
          : '<p class="err">Sin Básicos, todas las manos serían mulligan.</p>') +
      (METAS.length ? '<p class="pista">Las metas son simulaciones: diferencias de menos de 1 punto pueden ser azar.</p>' : '<p class="pista">Agrega metas arriba para ver cómo las mueve el cambio.</p>') + "</div>";
  }
  P("metas").addEventListener("click", e => {
    const q = e.target.closest("[data-q]"), st = e.target.closest("[data-estrella]");
    if (q){ METAS.splice(+q.dataset.q, 1); guardarMetas(); pintarMetas(); }
    if (st){ const m = METAS[+st.dataset.estrella], era = m.principal; METAS.forEach(x => delete x.principal); if (!era) m.principal = true; guardarMetas(); pintarMetas(); }
  });
  P("metas").addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.dataset.f === "cambio"){ probarCambio(e.target); return; }
    const v = k => P("metas").querySelector('[data-n="' + k + '"]').value, a = [...new Set([v("1"), v("1o")].filter(Boolean))], b = v("2"), t = +v("t");
    agregarMeta([a, ...(b ? [[b]] : [])], t, a.join(" o ") + (b ? " + " + b : "") + " " + TURNO(t));
  });
  pintarPrincipal();

  /* ▌BLOQUE 3b · Riesgos ══════════════════════════════════════════════════════════
     Abrir con un Básico malo (los marca el jugador), premios del mazo entero (las cartas de 1 copia), líneas de
     evolución (si cuadran y si se pueden cortar) y rotación. Las líneas salen del texto de TCGdex. */
  const LSM = "probar-malos:" + clave, BASICOS = CARTAS.filter(c => c.basico);
  const MALOS = new Set(leerLS(LSM, []).filter(n => BASICOS.some(c => c.nombre === n)));
  let LINEAS = null;   // null: sin pedir todavía; "error"; o [{ basico, miembros }]

  /* El texto de cada carta (TCGdex), por nombre en la lista: lo usan Motores, Atacantes y las líneas de evolución. Las Energías
     básicas no se piden: se leen por su nombre. */
  const TEXTOS = new Map();
  let ESTADO_TEXTOS = "pendiente", enIngles = new Map();
  /* De qué evoluciona una carta, de la raíz a ella: [Dreepy, Drakloak, Dragapult ex]. Sin datos, solo ella. */
  function cadena(c){
    const out = [c]; let x = c;
    for (let paso = 0; paso < 3 && !x.basico; paso++){
      const d = TEXTOS.get(x.nombre), prev = d && d.evolveFrom && enIngles.get(norm(d.evolveFrom));
      if (!prev || out.includes(prev)) break;
      out.unshift(prev); x = prev;
    }
    return out;
  }
  function armarLineas(){
    const poke = CARTAS.filter(c => c.sec === "Pokémon");
    if (poke.some(c => !c.basico && idTcgdex(c.foto) && !TEXTOS.get(c.nombre))){ LINEAS = "error"; return; }
    poke.forEach(c => { const d = TEXTOS.get(c.nombre); c.fase = (d && d.stage) || ""; });
    /* el nombre en inglés de cada Pokémon de la lista (la lista puede estar en castellano) */
    enIngles = new Map(poke.map(c => [norm((TEXTOS.get(c.nombre) || {}).name || c.en), c]));
    const por = new Map();
    poke.filter(c => !c.basico).forEach(c => { const raiz = cadena(c)[0]; if (raiz.basico && raiz !== c){ if (!por.has(raiz)) por.set(raiz, []); por.get(raiz).push(c); } });
    LINEAS = [...por].map(([basico, miembros]) => ({ basico, miembros }));
  }
  const PINTAR = { motores: () => motores.pintar(), atacantes: () => atacantes.pintar(), metas: () => pintarMetas(), riesgos: () => pintarRiesgos(), turnos: () => curva() };
  async function cargarTextos(){
    if (ESTADO_TEXTOS !== "pendiente") return;
    ESTADO_TEXTOS = "cargando";
    await Promise.all(CARTAS.filter(c => !esEnergiaBasica(c)).map(async c => { TEXTOS.set(c.nombre, await datoCarta(idTcgdex(c.foto))); }));
    ESTADO_TEXTOS = "listo"; armarLineas();
    for (const v of ["motores", "atacantes", "riesgos", "metas"]) if (!P(v).classList.contains("oculto")) PINTAR[v]();   // se rehacen con el texto ya leído
  }
  const ctx = { a, textos: TEXTOS, listo: () => ESTADO_TEXTOS === "listo", clave, cadena, over: null };
  const motores = montarMotores(P("motores"), ctx);
  ctx.over = motores.over;
  const atacantes = montarAtacantes(P("atacantes"), ctx);
  cargarTextos();   // de entrada: los ejemplos de Metas, Motores y Atacantes usan este texto

  function pintarRiesgos(){
    const m = BASICOS.filter(c => MALOS.has(c.nombre)).reduce((s, c) => s + c.cant, 0);
    P("riesgos").innerHTML =
      '<div class="bloqueR"><h3>Abrir con un Básico malo</h3><p class="pista">Toca los Básicos con los que no quieres empezar solo: los que no atacan bien, se caen rápido o le dan premios fáciles al rival.</p>' +
        '<div class="chips">' + BASICOS.map(c => '<button type="button" class="chipM" data-malo="' + esc(c.nombre) + '" aria-pressed="' + MALOS.has(c.nombre) + '">' + esc(c.nombre) + " ×" + c.cant + "</button>").join("") + "</div>" +
        (m ? '<p class="grande">' + pct(soloMalos(N, B, m), 1) + '</p><p class="pista">de las manos que se juegan tienen solo Básicos de los marcados: el Activo inicial sale sí o sí de ahí.</p>'
           : '<p class="pista">Todavía no marcas ninguno.</p>') +
        ayuda("Si en tu mano inicial los únicos Básicos son de los que marcaste, uno de ellos empieza en el Puesto Activo. <b>Ejemplo:</b> marcas Fezandipiti ex y Munkidori " +
          "(en una lista de 10 Básicos con una copia de cada uno) y sale cerca de 12 %: más o menos 1 de cada 8 partidas empiezas con uno de ellos adelante. <b>Lo baja:</b> más Básicos " +
          "buenos para empezar, o menos copias de los malos.") + "</div>" +
      '<div class="bloqueR" id="g-premios"><h3>Premios: el mazo entero</h3>' +
        (premUnas ? '<p class="grande">' + pct(premUnas.al1, 1) + '</p><p class="pista">de las partidas pierden en premios al menos una de tus ' + unas.length + (unas.length === 1 ? " carta" : " cartas") +
          " de 1 copia: " + unas.map(c => esc(c.nombre)).join(", ") + ".</p>" +
          barras(premUnas.dist.slice(0, 3).map((p, k) => [k === 0 ? "Ninguna" : k + (k === 1 ? " carta" : " cartas"), p]).concat([["3 o más", premUnas.dist.slice(3).reduce((a, b) => a + b, 0)]])) +
          ayuda("Cada barra es el porcentaje de partidas en que esa cantidad de tus cartas de 1 copia queda en premios. Cada una por separado está ~10 %, pero juntas suman: con " + unas.length +
            " cartas de 1 copia, lo normal es perder alguna. Esa carta vuelve recién cuando tomas ese premio. <b>Lo baja:</b> jugar 2 copias de las importantes o cartas que recuperen de la pila de descartes.")
          : '<p class="pista">No tienes cartas de 1 copia.</p>') + "</div>" +
      '<div class="bloqueR" id="g-lineas"><h3>Líneas de evolución</h3><div data-lineas>' + htmlLineas() + "</div>" +
        ayuda("Una línea es un Básico con lo que evoluciona de él (por ejemplo Dreepy → Drakloak → Dragapult ex). <b>Las proporciones</b> se escriben Básicos-Fase 1-Fase 2 (4-3-3): lo normal es que bajen de a poco. " +
          "Avisa si hay más Fase 1 que Básicos, si sobran Básicos sin Fase 1 que los evolucione, si hay más Fase 2 que Fase 1 (sin Rare Candy que las salte) o una Fase 2 sin cómo llegar a ella. " +
          "<b>Premios:</b> si todas las copias del Básico quedan en premios, la línea no se puede jugar hasta tomar esos premios; «alguna» es que al menos una copia quede ahí (la línea sigue, pero más lenta). " +
          "De qué evoluciona cada carta lo dice TCGdex.") + "</div>" +
      '<div class="bloqueR" id="g-rotacion"><h3>Rotación</h3>' + htmlRotacion() + "</div>";
  }
  /* Las líneas: proporción, avisos y qué tan seguido se corta por los premios. */
  function proporcion({ basico, miembros }){
    const suma = f => miembros.filter(c => c.fase === f).reduce((s, c) => s + c.cant, 0);
    const b = CARTAS.filter(c => c.nombre === basico.nombre).reduce((s, c) => s + c.cant, 0), s1 = suma("Stage1"), s2 = suma("Stage2");
    const candy = CARTAS.filter(c => c.en === "Rare Candy").reduce((s, c) => s + c.cant, 0), av = [];
    if (s1 > b) av.push("Llevas más Fase 1 (" + s1 + ") que Básicos (" + b + "): algunas no tendrán a quién evolucionar.");
    if (s1 && b - s1 >= 3) av.push("Hay " + b + " " + basico.nombre + " pero solo " + s1 + " de Fase 1: los Básicos de sobra se quedarán sin evolucionar.");
    if (s2 && s1 && s2 > s1 + candy) av.push("Hay más Fase 2 (" + s2 + ") que Fase 1 (" + s1 + ")" + (candy ? " aun contando tus " + candy + " Rare Candy" : " y no llevas Rare Candy que las salte") + ".");
    if (s2 && s1 && s1 - s2 >= 3) av.push("Hay " + s1 + " de Fase 1 y solo " + s2 + " de Fase 2: la línea se queda sin su final.");
    if (s2 && !s1 && !candy) av.push("Tienes Fase 2 pero ninguna Fase 1 ni Rare Candy: no hay cómo llegar a ella.");
    return { b, s1, s2, av, ratio: [b, s1, ...(s2 || miembros.some(c => c.fase === "Stage2") ? [s2] : [])].join("-") };
  }
  function htmlLineas(){
    if (LINEAS === null) return '<p class="pista">Buscando de qué evoluciona cada Pokémon…</p>';
    if (LINEAS === "error") return '<p class="pista">No pudimos saber las líneas de evolución (TCGdex no respondió). Prueba más tarde.</p>';
    if (!LINEAS.length) return '<p class="pista">No hay Pokémon que evolucionen de un Básico de tu lista.</p>';
    return LINEAS.map(l => {
      const { basico, miembros } = l, pr = proporcion(l), p = premios({ N, t: pr.b, tb: pr.b, b: B });
      return '<div class="linea1"><div class="r"><span><b>' + esc(basico.nombre) + " ×" + pr.b + "</b> → " + miembros.map(c => esc(c.nombre) + " ×" + c.cant).join(" → ") + '</span><span class="proporcion ' + (pr.av.length ? "mal" : "bien") + '">' + pr.ratio + (pr.av.length ? " · revisar" : " · cuadra") + "</span></div>" +
        pr.av.map(t => '<p class="aviso-linea">' + esc(t) + "</p>").join("") +
        '<div class="r mini"><span>Si todas las copias de ' + esc(basico.nombre) + " quedan en premios</span><span>todas <b>" + pct(p.todas, 2) + "</b> · alguna " + pct(p.al1, 0) + "</span></div></div>";
    }).join("");
  }
  /* Rotación: cuántas cartas hay de cada marca de regulación. Las Energías básicas no rotan, no se cuentan. */
  function htmlRotacion(){
    const por = new Map(), cuentan = CARTAS.filter(c => !esEnergiaBasica(c));
    for (const c of cuentan) if (c.reg){ const m = por.get(c.reg) || { n: 0, cartas: [] }; m.n += c.cant; m.cartas.push(c); por.set(c.reg, m); }
    const sin = cuentan.filter(c => !c.reg).reduce((s, c) => s + c.cant, 0), marcas = [...por.keys()].sort();
    if (!marcas.length) return '<p class="pista">No encontramos la marca de regulación de tus cartas (revisa que tengan expansión y número).</p>';
    const vieja = por.get(marcas[0]);
    return '<p class="pista">Cuántas cartas de tu lista son de cada marca de regulación (la letra de la esquina inferior izquierda de la carta).</p>' +
      barras(marcas.map(k => ["Marca " + k, por.get(k).n / N])) +
      '<p class="nota">La marca más vieja de tu lista es la <b>' + marcas[0] + "</b>: " + vieja.n + (vieja.n === 1 ? " carta" : " cartas") + " (" + pct(vieja.n / N, 0) + " del mazo): " +
        vieja.cartas.map(c => esc(c.nombre) + " ×" + c.cant).join(", ") + ". Cuando una marca sale de Estándar, esas cartas dejan de ser legales." +
        (sin ? " Otras " + sin + " cartas no tienen marca en nuestra base (reimpresiones o cartas nuevas)." : "") + "</p>" +
      ayuda("La marca de regulación decide hasta cuándo se puede jugar una carta en Estándar: cuando la organización anuncia una rotación, las marcas más viejas se van. " +
        "Aquí ves cuánto de tu lista depende de ellas, para saber qué vas a tener que reemplazar. La fecha la anuncia la organización (no la sabemos desde aquí). " +
        "Las Energías básicas no se cuentan porque no rotan. <b>Ejemplo:</b> si la marca más vieja es la H y tienes 14 cartas de ella, casi un cuarto del mazo cambia con la rotación.", "¿Qué es la rotación?");
  }
  P("riesgos").addEventListener("click", e => {
    const b = e.target.closest("[data-malo]");
    if (!b) return;
    if (MALOS.has(b.dataset.malo)) MALOS.delete(b.dataset.malo); else MALOS.add(b.dataset.malo);
    guardarLS(LSM, [...MALOS]); pintarRiesgos();
  });

  /* ▌BLOQUE 4 · Por turno ═════════════════════════════════════════════════════════ */
  P("turnos").innerHTML = '<div class="curvaSel"><select aria-label="Carta">' + CARTAS.map(c => '<option value="' + c.i + '">' + esc(c.nombre) + " ×" + c.cant + "</option>").join("") +
    '</select><div class="seg" role="group" aria-label="Comparar con"><button type="button" class="btn chico" data-cmp="1" aria-pressed="true">+1 copia</button>' +
    '<button type="button" class="btn chico" data-cmp="-1" aria-pressed="false">−1 copia</button></div></div>' +
    '<svg class="curva" viewBox="0 0 640 280" role="img"></svg>' +
    ayuda("La línea de color es la probabilidad de haber visto al menos una copia de la carta hasta ese momento: «Mano» son las 7 iniciales, «T1» suma el robo de tu primer turno, y así. " +
      "La línea punteada es lo mismo con una copia más (o una menos, según el botón). Mientras más separadas, más se nota el cambio. <b>Ejemplo:</b> si tu atacante tiene que estar en juego " +
      "el turno 2, mira el punto T2. En Pokémon los dos jugadores roban en su primer turno; ir primero solo cambia que ese turno no juegas Partidario ni atacas.");
  const sel = P("turnos").querySelector("select"), svg = P("turnos").querySelector("svg");
  let CMP = 1;
  P("turnos").querySelectorAll("[data-cmp]").forEach(b => b.onclick = () => {
    CMP = +b.dataset.cmp; P("turnos").querySelectorAll("[data-cmp]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); curva();
  });
  sel.onchange = curva;
  function curva(){
    const W = Math.max(300, Math.round(svg.getBoundingClientRect().width) || 640), c = CARTAS[+sel.value], T = [0, 1, 2, 3, 4, 5, 6];
    const X = t => 52 + t * (W - 80) / 6, Y = p => 240 - p * 200, css = getComputedStyle(document.documentElement), col = v => css.getPropertyValue(v).trim();
    const otra = c.cant + CMP, a = T.map(t => prob(c, 0, 7 + t)), b = T.map(t => otra < 1 ? 0 : prob(c, CMP, 7 + t));
    const linea = (s, color, dash) => '<polyline fill="none" stroke="' + color + '" stroke-width="3" ' + (dash ? 'stroke-dasharray="6 5" ' : "") + 'stroke-linejoin="round" points="' +
      s.map((p, t) => X(t) + "," + Y(p)).join(" ") + '"/>' + s.map((p, t) => '<circle cx="' + X(t) + '" cy="' + Y(p) + '" r="' + (dash ? 3 : 4.5) + '" fill="' + color + '"/>').join("");
    svg.setAttribute("viewBox", "0 0 " + W + " 280");
    svg.setAttribute("aria-label", "Probabilidad de tener " + c.nombre + " por turno: " + a.map((p, t) => (t ? "turno " + t : "mano") + " " + Math.round(p * 100) + " %").join(", "));
    svg.innerHTML = [0, .25, .5, .75, 1].map(p => '<line x1="46" x2="' + (W - 16) + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="' + col("--divider") + '"/><text x="40" y="' + (Y(p) + 4) +
        '" text-anchor="end" font-size="12" fill="' + col("--apagado") + '">' + p * 100 + " %</text>").join("") +
      T.map(t => '<text x="' + X(t) + '" y="264" text-anchor="middle" font-size="13" fill="' + col("--apagado") + '">' + (t ? "T" + t : "Mano") + "</text>").join("") +
      (otra >= 1 ? linea(b, col("--rotulo"), true) : "") + linea(a, col("--accion")) +
      a.map((p, t) => '<text x="' + X(t) + '" y="' + (Y(p) + (b[t] > p ? 22 : -12)) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + col("--texto") + '">' + Math.round(p * 100) + "</text>").join("") +
      '<g font-size="13" fill="' + col("--texto") + '"><rect x="52" y="14" width="14" height="4" fill="' + col("--accion") + '"/><text x="72" y="20">' + esc(c.nombre) + " ×" + c.cant + "</text>" +
      (otra >= 1 ? '<rect x="' + Math.round(W / 2 + 10) + '" y="14" width="14" height="4" fill="' + col("--rotulo") + '"/><text x="' + Math.round(W / 2 + 30) + '" y="20">con ×' + otra + "</text>" : "") + "</g>";
  }

  /* ▌BLOQUE 5 · Mesa ══════════════════════════════════════════════════════════════ */
  P("mesa").innerHTML = '<div class="fila-mesa"><p class="rotulo">Mano <span data-m="mull"></span></p><div class="acc">' +
    '<button class="btn primario chico" type="button" data-m="robar">Robar</button><button class="btn chico" type="button" data-m="otra">Otra mano</button></div></div>' +
    '<div class="mesa" data-m="mano"></div><div class="fila-mesa"><div><p class="rotulo">Premios · toca para darlos vuelta</p><div class="premios" data-m="premios"></div></div>' +
    '<p class="pista" data-m="queda"></p></div>' +
    ayuda("Se baraja tu lista y salen 7 cartas; si no hay Básico, se vuelve a repartir (arriba dice cuántos mulligans hubo). Después se apartan los 6 premios boca abajo. " +
      "<b>Robar</b> saca la carta de arriba del mazo, como al empezar un turno (la nueva queda marcada). Sirve para sentir el mazo: ¿qué harías con esta mano? " +
      "Para decidir copias, los números de las otras pestañas valen más que unas pocas manos.", "¿Para qué sirve?");
  const M = k => P("mesa").querySelector('[data-m="' + k + '"]');
  let mesa = null;
  const naipe = i => { const c = CARTAS[i]; return c.foto ? '<img src="' + esc(c.foto.replace("/low.", "/high.")) + '" alt="' + esc(c.nombre) + '">' : '<span>' + esc(c.nombre) + "</span>"; };
  function otraMano(){
    const r = repartir(MAZO, ES_B);
    mesa = { mano: r.mano.map(i => ({ i })), premios: r.premios.map(i => ({ i, ver: false })), pila: r.pila, mulligans: r.mulligans };
    pintarMesa();
  }
  function pintarMesa(){
    M("mull").textContent = mesa.mulligans ? "· tras " + mesa.mulligans + (mesa.mulligans > 1 ? " mulligans" : " mulligan") : "";
    M("mano").innerHTML = mesa.mano.map(m => '<div class="naipe' + (m.nueva ? " nueva-c" : "") + '">' + naipe(m.i) + "</div>").join("");
    M("premios").innerHTML = mesa.premios.map((p, k) => '<button type="button" class="naipe' + (p.ver ? "" : " dorso") + '" data-p="' + k + '" aria-label="' +
      (p.ver ? esc(CARTAS[p.i].nombre) : "Premio " + (k + 1) + ", boca abajo") + '">' + (p.ver ? naipe(p.i) : "") + "</button>").join("");
    M("queda").textContent = mesa.pila.length + (mesa.pila.length === 1 ? " carta" : " cartas") + " en el mazo";
    M("robar").disabled = !mesa.pila.length;
  }
  M("premios").onclick = e => { const b = e.target.closest("[data-p]"); if (b){ mesa.premios[+b.dataset.p].ver = true; pintarMesa(); } };
  M("robar").onclick = () => { mesa.mano.forEach(m => m.nueva = false); if (mesa.pila.length) mesa.mano.push({ i: mesa.pila.shift(), nueva: true }); pintarMesa(); };
  M("otra").onclick = otraMano;
}
