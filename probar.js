/* ▌ÍNDICE de probar.js
    1. Montar: las cartas de la lista, la meta principal y las pestañas
    2. Números
    3. Metas (y «Probar un cambio»)
    3b. Riesgos
    4. Por turno
    5. Mesa
*/
/* ============================================================
   probar.js — «Probar mazo» en Mis mazos (mazos.html, vista #vistaProbar)
   ------------------------------------------------------------
   Vistas sobre la misma lista: Números (exacto: resumen y una fila por carta), Metas (simulación de
   100.000 partidas, con semáforo, la meta principal y «Probar un cambio»), Riesgos (abrir con un Básico
   malo, premios del mazo entero y líneas de evolución cortadas), Por turno (curva de una carta, con una
   copia más o menos) y Mesa (una mano de prueba). La matemática está en probabilidad.js. En este
   navegador, por mazo: las metas (localStorage «probar-metas:<mazo>») y los Básicos malos
   («probar-malos:<mazo>»). Las líneas de evolución se piden a TCGdex (evolveFrom de cada carta).
   esc() es la global de config.js.
   ============================================================ */
import { leerLista, imagenCarta, norm } from "./listamazo.js?v=e94fb7a63908";
import { mulligan, alMenosUna, premios, distBasicos, promedioBasicos, soloMalos, energias, mulligansPromedio, simular, repartir } from "./probabilidad.js?v=e94fb7a63908";

const pct = (p, d = 0) => (p * 100).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
const dif = (p, d = 1) => (p >= 0 ? "+" : "−") + Math.abs(p * 100).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const TURNO = t => t === 0 ? "en la mano" : "al turno " + t;
const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? def; } catch(e){ return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ /* sin almacenamiento: no pasa nada */ } };
const esEnergiaBasica = c => /b[aá]sic/i.test(c.nombre) && c.sec === "Energía";
/* Lo que TCGdex dice de cada carta (nombre en inglés, fase, de qué evoluciona), por su id: lo pide la
   pestaña Riesgos una vez por carta y por visita. */
const TCGDEX = new Map();
const datoTcgdex = id => {
  if (!TCGDEX.has(id)) TCGDEX.set(id, fetch("https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(id)).then(r => r.ok ? r.json() : null).catch(() => null));
  return TCGDEX.get(id);
};

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
  const E = CARTAS.filter(c => c.sec === "Energía").reduce((s, c) => s + c.cant, 0);
  const MAZO = CARTAS.flatMap(c => Array(c.cant).fill(c.i)), ES_B = CARTAS.map(c => c.basico);
  /* La probabilidad de una carta (o con «extra» copias más: esas reemplazan cartas de las otras). */
  const prob = (c, extra = 0, vistas = 7) => alMenosUna({ N, t: c.cant + extra, tb: c.basico ? c.cant + extra : 0, b: B + (c.basico ? extra : 0), vistas });
  const foto = c => c.foto ? '<img src="' + esc(c.foto) + '" alt="" loading="lazy">' : '<span class="sinF"></span>';
  const porNombre = n => CARTAS.find(c => c.nombre === n);

  caja.innerHTML =
    '<p class="meta pr-res">' + N + " cartas · " + B + " Pokémon Básicos" + (N !== 60 ? " · <b>no son 60</b>: los números son para esta lista tal como está" : "") + "</p>" +
    '<div class="principal oculto" data-principal></div>' +
    '<div class="seg vistas" role="tablist" aria-label="Vistas de la prueba">' +
      [["numeros", "Números"], ["metas", "Metas"], ["riesgos", "Riesgos"], ["turnos", "Por turno"], ["mesa", "Mesa"]].map(([v, t], k) =>
        '<button type="button" role="tab" data-v="' + v + '" aria-selected="' + (k === 0) + '">' + t + "</button>").join("") + "</div>" +
    ["numeros", "metas", "riesgos", "turnos", "mesa"].map((v, k) => '<section class="caja' + (k ? " oculto" : "") + '" data-p="' + v + '"></section>').join("");
  const P = v => caja.querySelector('[data-p="' + v + '"]');
  const ver = v => {
    caja.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.v === v)));
    caja.querySelectorAll("[data-p]").forEach(s => s.classList.toggle("oculto", s.dataset.p !== v));
    ({ metas: pintarMetas, riesgos: pintarRiesgos, turnos: curva, mesa: () => { if (!mesa) otraMano(); } })[v]?.();
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
        "<td>" + pct(m) + '</td><td class="colT"><div class="tb"><div class="pbar"><i style="width:' + (t2 * 100).toFixed(1) + '%"></i></div><small>' + pct(t2) + "</small></div></td>" +
        '<td class="colP">' + pct(pr.al1) + "</td><td>" + (c.x === "A" ? '<small class="pista">máx. 1</small>' : c.cant >= 4 && !esEnergiaBasica(c) ? '<small class="pista">máx. 4</small>'
          : '<span class="sube">' + dif(prob(c, 1) - m) + "</span>") + "</td></tr>";
    }
    const dist = distBasicos(N, B), en = energias(N, B, E), mp = mulligansPromedio(N, B);
    const barra = (t, p, fuerte) => '<div class="fd' + (fuerte ? " fuerte" : "") + '"><span>' + t + '</span><span class="bar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></span><span class="val">' + pct(p, 1) + "</span></div>";
    P("numeros").innerHTML =
      '<div class="resumen">' +
        '<div class="dato"><small>Mulligan</small><b>' + pct(mulligan(N, B), 1) + "</b><span>con " + B + " Básicos · " + pct(mulligan(N, B + 1), 1) + " con uno más. " +
          "Le regalas al rival " + mp.toLocaleString("es-CL", { maximumFractionDigits: 2 }) + " cartas por partida, en promedio.</span></div>" +
        '<div class="dato"><small>Manos sin Energía</small><b>' + pct(en.sin, 1) + "</b><span>con " + E + " Energías · " + pct(en.muchas, 1) + " traen 3 o más (mano lenta)</span></div>" +
        '<div class="dato"><small>Una carta de 1 copia en premios</small><b>' + pct(premios({ N, t: 1, b: B }).al1, 1) + "</b><span>en cada partida</span></div>" +
        '<div class="dato ancho"><small>Básicos en la mano · ' + promedioBasicos(N, B).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " en promedio</small>" +
          '<div class="dist">' + barra("1 Básico", dist[1], true) + barra("2", dist[2]) + barra("3", dist[3]) + barra("4 o más", dist.slice(4).reduce((a, b) => a + b, 0)) + "</div>" +
          "<span>Con un solo Básico empiezas sin Banca: un Boss's Orders temprano te puede ganar la partida.</span></div>" +
      "</div>" +
      '<p class="pista">Probabilidad de tener <b>al menos una copia</b>, ya contando el mulligan. Toca una carta para ver su curva por turno.</p>' +
      '<table class="tabla"><thead><tr><th>Carta</th><th>En la mano</th><th class="colT">Al turno 2</th><th class="colP">En premios</th><th>+1 copia</th></tr></thead><tbody>' + filas + "</tbody></table>";
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
  function pintarPrincipal(){
    const m = METAS.find(x => x.principal), d = caja.querySelector("[data-principal]");
    if (!m){ d.className = "principal oculto"; return; }
    const res = resultado(m);
    d.className = "principal " + color(res.p);
    d.innerHTML = "<small>Tu meta principal</small><b>" + pct(res.p, 1) + '</b><span class="t">' + esc(m.tit) + "</span>" +
      '<span class="q">Es lo que tu mazo necesita: los demás números explican por qué está así.</span>';
  }
  function pintarMetas(){
    const cuenta = { verde: 0, amarilla: 0, roja: 0 };
    METAS.forEach(m => cuenta[color(resultado(m).p)]++);
    const resumen = [cuenta.verde && cuenta.verde + " bien", cuenta.amarilla && cuenta.amarilla + (cuenta.amarilla > 1 ? " justas" : " justa"),
                     cuenta.roja && cuenta.roja + (cuenta.roja > 1 ? " bajas" : " baja")].filter(Boolean).join(" · ");
    P("metas").innerHTML =
      '<p class="pista">Escribe lo que tu mazo necesita y en qué turno. Cada meta se prueba en 100.000 partidas simuladas, con mulligan y premios. ' +
      "La estrella marca tu meta principal: va arriba de todo.</p>" +
      '<div class="leyenda"><span><i style="background:var(--ok)"></i>80 % o más: bien</span><span><i style="background:var(--amarillo)"></i>60 a 80 %: justo</span>' +
        '<span><i style="background:var(--negativo)"></i>menos de 60 %: bajo</span>' + (resumen ? "<b>" + resumen + "</b>" : "") + "</div>" +
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
      (METAS.length ? "" : '<p class="pista">Por ejemplo: «Rare Candy y una Fase 2 al turno 2», o «un Partidario que robe, en la mano».</p>') +
      /* Probar un cambio: sale una copia de una carta y entra otra (de la lista o de la base de Estándar) */
      '<form class="cambio" data-f="cambio"><h3>Probar un cambio</h3><p class="pista">Sale una copia de una carta y entra otra: se vuelven a simular tus metas con la lista nueva.</p>' +
        '<div class="filaCambio"><label class="campo"><span>Sale</span><select data-c="sale">' + opciones() + "</select></label>" +
        '<label class="campo"><span>Entra</span><input data-c="entra" list="probarCartas" placeholder="Una carta de tu lista u otra" autocomplete="off"></label>' +
        '<button class="btn chico">Probar</button></div><datalist id="probarCartas">' + nombresBase() + '</datalist><div data-c="res" aria-live="polite"></div></form>';
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
    out.innerHTML = aviso + '<div class="resCambio"><b>Sale 1 ' + esc(sale) + ", entra 1 " + esc(nueva.nombre) + "</b>" +
      (b2 ? fila("Mulligan", mulligan(N, B), mulligan(N, b2)) + METAS.map(m => fila(esc(m.tit), resultado(m).p, simularEn(cartas, m).p)).join("")
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
    METAS.push({ tit: a.join(" o ") + (b ? " + " + b : "") + " " + TURNO(t), reqs: [a, ...(b ? [[b]] : [])], turno: t, ...(METAS.some(m => m.principal) ? {} : { principal: true }) });
    guardarMetas(); pintarMetas();
  });
  pintarPrincipal();

  /* ▌BLOQUE 3b · Riesgos ══════════════════════════════════════════════════════════
     Abrir con un Básico malo (los marca el jugador), premios del mazo entero (las cartas de 1 copia) y
     líneas de evolución cortadas (todas las copias de su Básico en premios; la línea sale de TCGdex). */
  const LSM = "probar-malos:" + clave, BASICOS = CARTAS.filter(c => c.basico);
  const MALOS = new Set(leerLS(LSM, []).filter(n => BASICOS.some(c => c.nombre === n)));
  let LINEAS = null;   // null: sin pedir todavía; "error"; o [{ basico, miembros }]
  function pintarRiesgos(){
    const m = BASICOS.filter(c => MALOS.has(c.nombre)).reduce((s, c) => s + c.cant, 0);
    const unas = CARTAS.filter(c => c.cant === 1 && !esEnergiaBasica(c)), tb1 = unas.filter(c => c.basico).length;
    const pr1 = unas.length ? premios({ N, t: unas.length, tb: tb1, b: B }).al1 : 0;
    P("riesgos").innerHTML =
      '<div class="bloqueR"><h3>Abrir con un Básico malo</h3><p class="pista">Marca los Básicos con los que no quieres empezar solo (los que no atacan bien o regalan premios).</p>' +
        '<div class="chips">' + BASICOS.map(c => '<button type="button" class="chipM" data-malo="' + esc(c.nombre) + '" aria-pressed="' + MALOS.has(c.nombre) + '">' + esc(c.nombre) + " ×" + c.cant + "</button>").join("") + "</div>" +
        (m ? '<p class="grande">' + pct(soloMalos(N, B, m), 1) + '</p><p class="pista">de las manos que se juegan tienen solo Básicos de los marcados: el Activo inicial sale de ahí.</p>'
           : '<p class="pista">Todavía no marcas ninguno.</p>') + "</div>" +
      '<div class="bloqueR"><h3>Premios: el mazo entero</h3>' +
        (unas.length ? '<p class="grande">' + pct(pr1, 1) + '</p><p class="pista">de las partidas pierden en premios al menos una de tus ' + unas.length + (unas.length === 1 ? " carta" : " cartas") +
          " de 1 copia: " + unas.map(c => esc(c.nombre)).join(", ") + ".</p>" : '<p class="pista">No tienes cartas de 1 copia.</p>') + "</div>" +
      '<div class="bloqueR"><h3>Líneas de evolución cortadas</h3><div data-lineas>' + htmlLineas() + "</div></div>";
    if (LINEAS === null) buscarLineas();
  }
  function htmlLineas(){
    if (LINEAS === null) return '<p class="pista">Buscando de qué evoluciona cada Pokémon…</p>';
    if (LINEAS === "error") return '<p class="pista">No pudimos saber las líneas de evolución (TCGdex no respondió). Prueba más tarde.</p>';
    if (!LINEAS.length) return '<p class="pista">No hay Pokémon que evolucionen de un Básico de tu lista.</p>';
    return '<p class="pista">Si todas las copias del Básico de una línea quedan en premios, esa línea no se puede jugar en la partida.</p>' +
      LINEAS.map(({ basico, miembros }) => {
        const p = premios({ N, t: basico.cant, tb: basico.cant, b: B });
        return '<div class="r"><span><b>' + esc(basico.nombre) + " ×" + basico.cant + "</b> → " + miembros.map(c => esc(c.nombre)).join(", ") + "</span><span>" +
          "todas en premios <b>" + pct(p.todas, 2) + "</b> · alguna " + pct(p.al1, 0) + "</span></div>";
      }).join("");
  }
  let buscando = false;
  async function buscarLineas(){
    if (buscando) return;
    buscando = true;
    const poke = CARTAS.filter(c => c.sec === "Pokémon");
    const id = c => { const m = /\/en\/[^/]+\/([^/]+)\/([^/]+)\/low\.webp$/.exec(c.foto || ""); return m ? m[1] + "-" + m[2] : ""; };
    const datos = await Promise.all(poke.map(c => id(c) ? datoTcgdex(id(c)) : null));
    if (poke.some((c, k) => id(c) && !c.basico && !datos[k])) LINEAS = "error";
    else {
      /* el nombre en inglés de cada Pokémon de la lista (la lista puede estar en castellano) */
      const enIngles = new Map(poke.map((c, k) => [norm((datos[k] && datos[k].name) || c.nombre), c]));
      const raiz = c => {
        let x = c;
        for (let paso = 0; paso < 4; paso++){
          if (x.basico) return x;
          const d = datos[poke.indexOf(x)], prev = d && d.evolveFrom && enIngles.get(norm(d.evolveFrom));
          if (!prev) return null;
          x = prev;
        }
        return null;
      };
      const por = new Map();
      poke.filter(c => !c.basico).forEach(c => { const b = raiz(c); if (b){ if (!por.has(b)) por.set(b, []); por.get(b).push(c); } });
      LINEAS = [...por].map(([basico, miembros]) => ({ basico, miembros }));
    }
    buscando = false;
    const d = P("riesgos").querySelector("[data-lineas]");
    if (d) d.innerHTML = htmlLineas();
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
