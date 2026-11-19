/* ▌ÍNDICE de probar.js
    1. Montar: las cartas de la lista y las pestañas
    2. Números
    3. Metas
    4. Por turno
    5. Mesa
*/
/* ============================================================
   probar.js — «Probar mazo» en Mis mazos (mazos.html, vista #vistaProbar)
   ------------------------------------------------------------
   Cuatro vistas sobre la misma lista: Números (exacto, por carta), Metas (simulación de 100.000 partidas,
   con semáforo), Por turno (curva de una carta, con una copia más o menos) y Mesa (una mano de prueba con
   fotos y premios boca abajo). La matemática está en probabilidad.js; las metas se recuerdan en este
   navegador, por mazo (localStorage «probar-metas:<mazo>»).
   esc() es la global de config.js.
   ============================================================ */
import { leerLista, imagenCarta } from "./listamazo.js?v=30755b8315af";
import { valida, mulligan, alMenosUna, premios, promedioBasicos, simular, repartir } from "./probabilidad.js?v=30755b8315af";

const pct = (p, d = 0) => (p * 100).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
const dif = p => (p >= 0 ? "+" : "−") + Math.abs(p * 100).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TURNO = t => t === 0 ? "en la mano" : "al turno " + t;

/* ▌BLOQUE 1 · Montar ════════════════════════════════════════════════════════════ */
export function montarProbar(caja, { lista, base, clave = "sin-guardar" }){
  const r = leerLista(lista, base);
  const CARTAS = [...r.pokemon.map(c => ({ ...c, sec: "Pokémon" })), ...r.entrenador.map(c => ({ ...c, sec: "Entrenador" })), ...r.energia.map(c => ({ ...c, sec: "Energía" }))]
    .map((c, i) => ({ ...c, i, foto: c.set ? imagenCarta(base, c.set, c.num) : "", basico: c.x === "B" && c.sec === "Pokémon" }));
  const N = CARTAS.reduce((s, c) => s + c.cant, 0), B = CARTAS.filter(c => c.basico).reduce((s, c) => s + c.cant, 0);
  if (N < 13 || !B){
    caja.innerHTML = '<p class="vacio">' + (N < 13 ? "La lista tiene " + N + " cartas: para probarla hacen falta al menos 13 (la mano y los premios)."
      : "No encontramos ningún Pokémon Básico en la lista, así que toda mano sería mulligan. Revisa que los Pokémon tengan su expansión y número.") + "</p>";
    return;
  }
  const MAZO = CARTAS.flatMap(c => Array(c.cant).fill(c.i)), ES_B = CARTAS.map(c => c.basico);
  /* La probabilidad de una carta (o con «extra» copias más: esas reemplazan cartas de las otras). */
  const prob = (c, extra = 0, vistas = 7) => alMenosUna({ N, t: c.cant + extra, tb: c.basico ? c.cant + extra : 0, b: B + (c.basico ? extra : 0), vistas });
  const foto = c => c.foto ? '<img src="' + esc(c.foto) + '" alt="" loading="lazy">' : '<span class="sinF"></span>';

  caja.innerHTML =
    '<p class="meta pr-res">' + N + " cartas · " + B + " Pokémon Básicos" + (N !== 60 ? " · <b>no son 60</b>: los números son para esta lista tal como está" : "") + "</p>" +
    '<div class="seg vistas" role="tablist" aria-label="Vistas de la prueba">' +
      [["numeros", "Números"], ["metas", "Metas"], ["turnos", "Por turno"], ["mesa", "Mesa"]].map(([v, t], k) =>
        '<button type="button" role="tab" data-v="' + v + '" aria-selected="' + (k === 0) + '">' + t + "</button>").join("") + "</div>" +
    '<section class="caja" data-p="numeros"></section><section class="caja oculto" data-p="metas"></section>' +
    '<section class="caja oculto" data-p="turnos"></section><section class="caja oculto" data-p="mesa"></section>';
  const P = v => caja.querySelector('[data-p="' + v + '"]');
  const ver = v => {
    caja.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.v === v)));
    caja.querySelectorAll("[data-p]").forEach(s => s.classList.toggle("oculto", s.dataset.p !== v));
    ({ metas: pintarMetas, turnos: curva, mesa: () => { if (!mesa) otraMano(); } })[v]?.();
  };
  caja.querySelectorAll("[data-v]").forEach(b => b.onclick = () => ver(b.dataset.v));
  caja.addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.replaceWith(Object.assign(document.createElement("span"), { className: "sinF" })); }, true);

  /* ▌BLOQUE 2 · Números ═══════════════════════════════════════════════════════════ */
  {
    let filas = "", sec = "";
    for (const c of CARTAS){
      if (c.sec !== sec){ sec = c.sec; filas += '<tr class="sec"><td colspan="5">' + sec + "</td></tr>"; }
      const m = prob(c), t2 = prob(c, 0, 9), pr = premios({ N, t: c.cant, tb: c.basico ? c.cant : 0, b: B });
      filas += '<tr class="fila" data-i="' + c.i + '" tabindex="0"><td><div class="nomC">' + foto(c) + "<span><b>" + esc(c.nombre) + "</b> <em>×" + c.cant + "</em>" +
        (c.basico ? '<span class="marcaB" title="Pokémon Básico">B</span>' : "") + (c.x === "A" ? '<span class="marcaB">ACE</span>' : "") + "</span></div></td>" +
        "<td>" + pct(m) + '</td><td class="colT"><div class="tb"><div class="barra"><i style="width:' + (t2 * 100).toFixed(1) + '%"></i></div><small>' + pct(t2) + "</small></div></td>" +
        '<td class="colP">' + pct(pr.al1) + "</td><td>" + (c.x === "A" ? '<small class="pista">máx. 1</small>' : c.cant >= 4 && !/b[aá]sic/i.test(c.nombre) ? '<small class="pista">máx. 4</small>'
          : '<span class="sube">' + dif(prob(c, 1) - m) + "</span>") + "</td></tr>";
    }
    P("numeros").innerHTML =
      '<div class="resumen">' +
        '<div class="dato"><small>Mulligan</small><b>' + pct(mulligan(N, B), 1) + "</b><span>con " + B + " Básicos · " + pct(mulligan(N, B + 1), 1) + " con uno más</span></div>" +
        '<div class="dato"><small>Básicos en la mano</small><b>' + promedioBasicos(N, B).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "</b><span>en promedio, en una mano que se juega</span></div>" +
        '<div class="dato"><small>Una carta de 1 copia en premios</small><b>' + pct(premios({ N, t: 1, b: B }).al1, 1) + "</b><span>en cada partida</span></div>" +
      "</div>" +
      '<p class="pista">Probabilidad de tener <b>al menos una copia</b>, ya contando el mulligan. Toca una carta para ver su curva por turno.</p>' +
      '<table class="tabla"><thead><tr><th>Carta</th><th>En la mano</th><th class="colT">Al turno 2</th><th class="colP">En premios</th><th>+1 copia</th></tr></thead><tbody>' + filas + "</tbody></table>";
    const abrirCurva = f => { if (f){ sel.value = f.dataset.i; ver("turnos"); } };
    P("numeros").onclick = e => abrirCurva(e.target.closest(".fila"));
    P("numeros").onkeydown = e => { if (e.key === "Enter") abrirCurva(e.target.closest(".fila")); };
  }

  /* ▌BLOQUE 3 · Metas ═════════════════════════════════════════════════════════════
     Cada meta: requisitos (cada uno, una o varias cartas: «cualquiera de») y un turno. */
  const LS = "probar-metas:" + clave, porNombre = n => CARTAS.find(c => c.nombre === n);
  let METAS = [];
  try { METAS = JSON.parse(localStorage.getItem(LS) || "[]").filter(m => m && Array.isArray(m.reqs)); } catch(e){ /* sin almacenamiento: empieza vacío */ }
  const guardarMetas = () => { try { localStorage.setItem(LS, JSON.stringify(METAS.map(({ tit, reqs, turno }) => ({ tit, reqs, turno })))); } catch(e){ /* no pasa nada */ } };
  const opciones = () => CARTAS.map(c => '<option value="' + esc(c.nombre) + '">' + esc(c.nombre) + "</option>").join("");
  function pintarMetas(){
    METAS = METAS.filter(m => m.reqs.every(r => r.some(porNombre)));   // si la lista cambió, se van las metas de cartas que ya no están
    P("metas").innerHTML =
      '<p class="pista">Escribe lo que tu mazo necesita y en qué turno. Cada meta se prueba en 100.000 partidas simuladas, con mulligan y premios.</p>' +
      '<div class="leyenda"><span><i style="background:var(--ok)"></i>80 % o más: bien</span><span><i style="background:var(--amarillo)"></i>60 a 80 %: justo</span><span><i style="background:var(--negativo)"></i>menos de 60 %: bajo</span></div>' +
      '<div class="metas">' + METAS.map((m, k) => {
        m.res ??= simular({ mazo: MAZO, esBasico: ES_B, reqs: m.reqs.map(r => r.map(porNombre).filter(Boolean).map(c => c.i)), turno: m.turno });
        const col = m.res.p >= .8 ? "verde" : m.res.p >= .6 ? "amarilla" : "roja";
        return '<div class="meta-c ' + col + '"><button type="button" class="x" data-q="' + k + '" aria-label="Quitar la meta ' + esc(m.tit) + '">×</button><span class="estado">' +
          { verde: "Bien", amarilla: "Justo", roja: "Bajo" }[col] + '</span><span class="t">' + esc(m.tit) + '</span><span class="p">' + pct(m.res.p, 1) +
          "<small>±" + (m.res.mas * 100).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '</small></span><span class="q">' +
          m.reqs.map(r => r.map(esc).join(" o ")).join(" <b>y</b> ") + ", " + TURNO(m.turno) + "</span></div>";
      }).join("") +
      '<form class="nueva"><b>Nueva meta</b>' +
        '<label class="campo"><span>Necesito</span><select data-n="1">' + opciones() + "</select></label>" +
        '<label class="campo"><span>O en su lugar (opcional)</span><select data-n="1o"><option value="">—</option>' + opciones() + "</select></label>" +
        '<label class="campo"><span>Y además (opcional)</span><select data-n="2"><option value="">—</option>' + opciones() + "</select></label>" +
        '<label class="campo"><span>¿Cuándo?</span><select data-n="t"><option value="0">en la mano</option><option value="1">al turno 1</option><option value="2" selected>al turno 2</option><option value="3">al turno 3</option></select></label>' +
        '<button class="btn primario chico">Agregar meta</button></form></div>' +
      (METAS.length ? "" : '<p class="pista">Por ejemplo: «Rare Candy y una Fase 2 al turno 2», o «un Partidario que robe, en la mano».</p>');
  }
  P("metas").addEventListener("click", e => { const q = e.target.closest("[data-q]"); if (q){ METAS.splice(+q.dataset.q, 1); guardarMetas(); pintarMetas(); } });
  P("metas").addEventListener("submit", e => {
    e.preventDefault();
    const v = k => P("metas").querySelector('[data-n="' + k + '"]').value, a = [v("1"), v("1o")].filter(Boolean), b = v("2"), t = +v("t");
    const reqs = [[...new Set(a)], ...(b ? [[b]] : [])];
    METAS.push({ tit: a.join(" o ") + (b ? " + " + b : "") + " " + TURNO(t), reqs, turno: t });
    guardarMetas(); pintarMetas();
  });

  /* ▌BLOQUE 4 · Por turno ═════════════════════════════════════════════════════════ */
  P("turnos").innerHTML = '<div class="curvaSel"><select aria-label="Carta">' + CARTAS.map(c => '<option value="' + c.i + '">' + esc(c.nombre) + " ×" + c.cant + "</option>").join("") +
    '</select><div class="seg" role="group" aria-label="Comparar con"><button type="button" class="btn chico" data-cmp="1" aria-pressed="true">+1 copia</button>' +
    '<button type="button" class="btn chico" data-cmp="-1" aria-pressed="false">−1 copia</button></div></div>' +
    '<svg class="curva" viewBox="0 0 640 280" role="img"></svg>' +
    '<p class="pista">Cartas vistas: las 7 de la mano y una más por cada turno. En Pokémon los dos jugadores roban en su primer turno; ir primero solo cambia que ese turno no juegas Partidario ni atacas.</p>';
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
    '<p class="pista" data-m="queda"></p></div>';
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
