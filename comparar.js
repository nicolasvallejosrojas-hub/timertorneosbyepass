/* ▌ÍNDICE de comparar.js
    1. Qué cambió entre las dos listas (carta por carta)
    2. Los números de cada lista, lado a lado
    3. Montar la vista
*/
/* ============================================================
   comparar.js — «Comparar dos listas» en Mis mazos (mazos.html, vista #vistaComparar)
   ------------------------------------------------------------
   Pone dos listas frente a frente: qué cartas entran, salen o cambian de copias o de impresión (se comparan por su nombre en
   inglés, así una lista en castellano y otra en inglés calzan), los mismos números del resumen de Probar mazo con la diferencia
   de B contra A, los motores (con el texto de TCGdex) y las metas guardadas de cualquiera de las dos, simuladas en las dos.
   Las diferencias van en verde si B queda mejor y en rojo si queda peor (en mulligan y en cosas «malas», bajar es mejor).
   esc() es la global de config.js.
   ============================================================ */
import { armarCartas, motivoNoSePuede, simularMetaEn, metaAEn } from "./analisis.js?v=f52f3d121cc0";
import { mulligan, alMenosUna, premios, distBasicos, energiasDist, mulligansPromedio } from "./probabilidad.js?v=f52f3d121cc0";
import { idTcgdex, datoCarta } from "./tcgdex.js?v=f52f3d121cc0";
import { calcularGrupos } from "./motores.js?v=f52f3d121cc0";
import { pct, dif, num, TURNO, leerLS, ayuda } from "./probar-ui.js?v=f52f3d121cc0";
import { esEnergiaBasica } from "./listamazo.js?v=f52f3d121cc0";

/* ▌BLOQUE 1 · Qué cambió ═════════════════════════════════════════════════════════ */
const SECS = ["Pokémon", "Entrenador", "Energía"];
function agrupar(X){
  const m = new Map();
  for (const c of X.CARTAS){
    const e = m.get(c.en) || { en: c.en, nombre: c.nombre, sec: c.sec, cant: 0, imps: [], basico: c.basico };
    e.cant += c.cant; e.imps.push(c.set ? c.set + " " + c.num : "sin expansión"); m.set(c.en, e);
  }
  return m;
}
/* entran: solo en B · salen: solo en A · copias: en las dos con otra cantidad · impresion: misma cantidad pero otra expansión o número */
export function diferencias(A, B){
  const ma = agrupar(A), mb = agrupar(B), d = { entran: [], salen: [], copias: [], impresion: [], igual: 0 };
  for (const [k, b] of mb){
    const a = ma.get(k);
    if (!a) d.entran.push({ ...b, antes: 0, ahora: b.cant });
    else if (a.cant !== b.cant) d.copias.push({ ...b, antes: a.cant, ahora: b.cant });
    else if ([...a.imps].sort().join() !== [...b.imps].sort().join()) d.impresion.push({ ...b, antes: a.imps.join(", "), ahora: b.imps.join(", ") });
    else d.igual += b.cant;
  }
  for (const [k, a] of ma) if (!mb.has(k)) d.salen.push({ ...a, antes: a.cant, ahora: 0 });
  const orden = (x, y) => SECS.indexOf(x.sec) - SECS.indexOf(y.sec) || x.nombre.localeCompare(y.nombre);
  for (const k of ["entran", "salen", "copias", "impresion"]) d[k].sort(orden);
  return d;
}

/* ▌BLOQUE 2 · Los números ═════════════════════════════════════════════════════════ */
/* Lo que se compara de cada lista: { id, titulo, valor, fmt, menosEsMejor }. Los valores son fracciones (0–1) o cantidades. */
export function metricas(X){
  const { N, B, E } = X, dist = distBasicos(N, B), en = energiasDist(N, B, E), unas = X.CARTAS.filter(c => c.cant === 1 && !esEnergiaBasica(c.nombre));
  const prem = unas.length ? premios({ N, t: unas.length, tb: unas.filter(c => c.basico).length, b: B }).al1 : 0;
  return [
    { id: "mull", titulo: "Mulligan", v: mulligan(N, B), fmt: "pct", menos: true },
    { id: "uno", titulo: "Manos con un solo Básico", v: dist[1], fmt: "pct", menos: true },
    { id: "basicos", titulo: "Pokémon Básicos", v: B, fmt: "n", menos: null },
    { id: "regalo", titulo: "Cartas que le regalas al rival por partida (mulligans)", v: mulligansPromedio(N, B), fmt: "n2", menos: true },
    { id: "sinEn", titulo: "Manos sin Energía", v: en[0], fmt: "pct", menos: true },
    { id: "muchasEn", titulo: "Manos con 3 o más Energías", v: en.slice(3).reduce((a, b) => a + b, 0), fmt: "pct", menos: true },
    { id: "unasPrem", titulo: "Partidas en que pierdes una carta de 1 copia en premios", v: prem, fmt: "pct", menos: true },
  ];
}
const mostrar = (m, v) => m.fmt === "pct" ? pct(v, 1) : m.fmt === "n2" ? num(v, 2) : String(Math.round(v));
function difHtml(m, a, b){
  const d = b - a, chico = m.fmt === "pct" ? Math.abs(d) < 0.0005 : Math.abs(d) < 0.005;
  if (chico) return '<td class="d igual">igual</td>';
  const mejor = m.menos === null ? null : m.menos ? d < 0 : d > 0;
  const txt = m.fmt === "pct" ? dif(d) + " pts" : (d > 0 ? "+" : "−") + num(Math.abs(d), m.fmt === "n2" ? 2 : 0);
  return '<td class="d ' + (mejor === null ? "igual" : mejor ? "mas" : "menos") + '">' + txt + (mejor === null ? "" : mejor ? " (mejor)" : " (peor)") + "</td>";
}
/* La probabilidad de tener una carta (por nombre en inglés) en la mano de cada lista; 0 si no la lleva. */
const enMano = (X, en) => { const cs = X.CARTAS.filter(c => c.en === en), t = cs.reduce((s, c) => s + c.cant, 0); return t ? alMenosUna({ N: X.N, t, tb: cs[0].basico ? t : 0, b: X.B }) : 0; };

/* ▌BLOQUE 3 · Montar ═════════════════════════════════════════════════════════════ */
export function montarComparar(caja, { a, b, base }){
  const A = armarCartas(a.lista, base), B = armarCartas(b.lista, base), mA = motivoNoSePuede(A), mB = motivoNoSePuede(B);
  if (mA || mB){ caja.innerHTML = '<p class="vacio">' + (mA ? "Lista A: " + mA : "") + (mA && mB ? " " : "") + (mB ? "Lista B: " + mB : "") + "</p>"; return; }
  const metB = metricas(B), dif_ = diferencias(A, B), mets = metricas(A).map((m, i) => ({ ...m, a: m.v, b: metB[i].v }));
  const nA = esc(a.nombre || "Lista A"), nB = esc(b.nombre || "Lista B");
  const token = caja._cmp = (caja._cmp || 0) + 1;   // si se intercambian las listas mientras algo se calcula, lo viejo no pisa lo nuevo
  const TEXTOS_A = new Map(), TEXTOS_B = new Map();
  let metas = null, textosListos = false;

  /* las metas guardadas de cada mazo, juntas y sin repetir (por lo que piden y el turno), simuladas en las dos listas */
  function juntarMetas(){
    const por = new Map();
    for (const [X, quien] of [[A, a], [B, b]]){
      for (const m of leerLS("probar-metas:" + quien.clave, []).filter(x => x && Array.isArray(x.reqs))){
        const reqsEn = metaAEn(X, m), k = JSON.stringify([reqsEn.map(r => [...r].sort()), m.turno]), e = por.get(k);
        if (!e) por.set(k, { tit: m.tit, reqsEn, turno: m.turno, principal: !!m.principal && X === A });
        else if (m.principal && X === A) e.principal = true;
      }
    }
    return [...por.values()].sort((x, y) => (y.principal - x.principal));
  }
  function simularMetas(){
    if (caja._cmp !== token) return;
    metas = juntarMetas().map(m => ({ ...m, ra: simularMetaEn(A, m.reqsEn, m.turno), rb: simularMetaEn(B, m.reqsEn, m.turno) }));
    pintar();
  }
  const filaEntra = x => '<div class="mas">+' + x.cant + " " + esc(x.nombre) + "</div>";

  function filasCartas(){
    const vistos = [...dif_.entran, ...dif_.salen, ...dif_.copias].sort((x, y) => Math.abs(y.ahora - y.antes) - Math.abs(x.ahora - x.antes)).slice(0, 12);
    return vistos.map(x => {
      const pa = enMano(A, x.en), pb = enMano(B, x.en), d = pb - pa;
      return '<tr><td>' + esc(x.nombre) + ' <small class="mini">×' + x.antes + " → ×" + x.ahora + '</small></td><td class="n">' + (x.antes ? pct(pa, 1) : "—") + '</td><td class="n">' + (x.ahora ? pct(pb, 1) : "—") + "</td>" +
        (Math.abs(d) < 0.0005 ? '<td class="d igual">igual</td>' : '<td class="d ' + (d > 0 ? "mas" : "menos") + '">' + dif(d) + " pts</td>") + "</tr>";
    }).join("");
  }
  function filasMotores(){
    if (!textosListos) return '<tr><td colspan="4" class="pista">Leyendo el texto de las cartas en TCGdex…</td></tr>';
    const ga = calcularGrupos(A, TEXTOS_A, {}), gb = calcularGrupos(B, TEXTOS_B, {});
    return ga.map((g, i) => {
      const h = gb[i];
      if (!g.t && !h.t) return "";
      const d = h.p7 - g.p7, chico = Math.abs(d) < 0.0005;
      return '<tr><td>' + g.titulo + '<small class="mini"> cartas: ' + g.t + " → " + h.t + '</small></td><td class="n">' + (g.t ? pct(g.p7, 1) : "—") + '</td><td class="n">' + (h.t ? pct(h.p7, 1) : "—") + "</td>" +
        (chico ? '<td class="d igual">igual</td>' : '<td class="d ' + (d > 0 ? "mas" : "menos") + '">' + dif(d) + " pts</td>") + "</tr>";
    }).join("");
  }
  function filasMetas(){
    if (metas === null) return '<tr><td colspan="4" class="pista">Calculando las metas…</td></tr>';
    if (!metas.length) return '<tr><td colspan="4" class="pista">Ninguno de los dos mazos tiene metas guardadas. Crea una en Probar mazo → Metas y aparece aquí, probada en las dos listas.</td></tr>';
    return metas.map(m => {
      const d = m.rb.p - m.ra.p, chico = Math.abs(d) < Math.hypot(m.ra.mas, m.rb.mas) || Math.abs(d) < 0.005;
      return '<tr><td>' + (m.principal ? "★ " : "") + esc(m.tit) + '<small class="mini"> ' + TURNO(m.turno) + "</small></td><td class=\"n\">" + (m.ra.falta ? "sin la carta" : pct(m.ra.p, 1)) + '</td><td class="n">' + (m.rb.falta ? "sin la carta" : pct(m.rb.p, 1)) + "</td>" +
        (chico ? '<td class="d igual">igual (dentro del margen)</td>' : '<td class="d ' + (d > 0 ? "mas" : "menos") + '">' + dif(d) + " pts" + (d > 0 ? " (mejor)" : " (peor)") + "</td>") + "</tr>";
    }).join("");
  }
  /* una frase con lo más importante */
  function frase(){
    const piezas = [];
    const por = id => mets.find(m => m.id === id);
    const mull = por("mull"), uno = por("uno"), sinEn = por("sinEn");
    const pts = (m, mejorTxt, peorTxt) => { const d = m.b - m.a; if (Math.abs(d) < 0.005) return; piezas.push({ mejor: d < 0, mag: Math.abs(d), t: (d < 0 ? mejorTxt : peorTxt).replace("{n}", num(Math.abs(d) * 100, 1)) }); };
    pts(mull, "mulligan {n} puntos menor", "mulligan {n} puntos mayor");
    pts(uno, "{n} puntos menos de manos con un solo Básico", "{n} puntos más de manos con un solo Básico");
    pts(sinEn, "{n} puntos menos de manos sin Energía", "{n} puntos más de manos sin Energía");
    const pr = (metas || []).find(m => m.principal && !m.ra.falta && !m.rb.falta);
    if (pr){ const d = pr.rb.p - pr.ra.p; if (Math.abs(d) >= Math.hypot(pr.ra.mas, pr.rb.mas)) piezas.push({ mejor: d > 0, mag: Math.abs(d), t: "tu meta principal «" + pr.tit + "» " + (d > 0 ? "sube " : "baja ") + num(Math.abs(d) * 100, 1) + " puntos" }); }
    if (!piezas.length) return "Las dos listas se comportan casi igual en estos números: la diferencia está en las cartas, no en cuán seguido te salen.";
    const top = piezas.sort((x, y) => y.mag - x.mag).slice(0, 3), mejores = top.filter(x => x.mejor).map(x => x.t), peores = top.filter(x => !x.mejor).map(x => x.t);
    return "<b>La lista B frente a la A:</b> " + (mejores.length ? "mejor en " + mejores.join(", ") : "") + (mejores.length && peores.length ? "; " : "") + (peores.length ? "peor en " + peores.join(", ") : "") + ".";
  }

  function pintar(){
    const bloque = (t, id) => '<div class="bloqueR" id="' + id + '"><h3>' + t + "</h3>";
    const lista = (xs, f) => xs.length ? xs.map(f).join("") : '<div class="igual">—</div>';
    caja.innerHTML =
      '<div class="comp-cab"><div class="pill"><small>Lista A</small><b>' + nA + " · " + A.N + ' cartas</b></div><button type="button" class="btn chico" data-swap aria-label="Intercambiar las listas A y B">⇄</button><div class="pill"><small>Lista B</small><b>' + nB + " · " + B.N + " cartas</b></div></div>" +
      '<p class="frase" role="status">' + frase() + "</p>" +
      bloque("Qué cambió", "g-cambio-listas") + '<div class="cambios">' +
        "<div><b>Entran en B</b>" + lista(dif_.entran, filaEntra) + "</div>" +
        "<div><b>Salen de A</b>" + lista(dif_.salen, x => '<div class="menos">−' + x.cant + " " + esc(x.nombre) + "</div>") + "</div>" +
        "<div><b>Cambian de copias</b>" + lista(dif_.copias, x => "<div>" + esc(x.nombre) + ' <span class="' + (x.ahora > x.antes ? "mas" : "menos") + '">' + x.antes + " → " + x.ahora + "</span></div>") + "</div>" +
        "<div><b>Misma carta, otra impresión</b>" + lista(dif_.impresion, x => "<div>" + esc(x.nombre) + '<div class="mini">' + esc(x.antes) + " → " + esc(x.ahora) + "</div></div>") + "</div></div>" +
        '<p class="nota">' + dif_.igual + " cartas son iguales en las dos listas.</p>" +
        ayuda("Las cartas se comparan por su nombre en inglés, así que una lista en castellano y otra en inglés calzan. «Cambian de copias» es la misma carta con otra cantidad; «otra impresión», la misma cantidad pero de otra expansión o con otro número (una Ultra Ball de SVI contra una de ASC).", "¿Cómo se lee?") + "</div>" +
      bloque("Los números, lado a lado", "g-numeros-cmp") +
        '<table class="tabla cmp"><thead><tr><th>Qué</th><th>A</th><th>B</th><th>Diferencia</th></tr></thead><tbody>' +
        mets.map(m => '<tr><td>' + m.titulo + (m.menos ? ' <small class="mini">menos es mejor</small>' : "") + '</td><td class="n">' + mostrar(m, m.a) + '</td><td class="n">' + mostrar(m, m.b) + "</td>" + difHtml(m, m.a, m.b) + "</tr>").join("") + "</tbody></table>" +
        ayuda("Son los mismos números del resumen de Probar mazo, calculados con cada lista. La diferencia es «B menos A»: <span class=\"mas\">verde</span> si B queda mejor, <span class=\"menos\">rojo</span> si queda peor. " +
          "<b>Ejemplo:</b> si el mulligan baja de 25,9 % a 19,1 %, la diferencia es −6,8 puntos (mejor): en 7 de cada 100 partidas más empiezas a jugar sin que te toque repartir de nuevo.") + "</div>" +
      (filasCartas() ? bloque("Las cartas que cambian, en la mano", "g-cartas-cmp") + '<table class="tabla cmp"><thead><tr><th>Carta</th><th>A</th><th>B</th><th>Diferencia</th></tr></thead><tbody>' + filasCartas() + "</tbody></table>" +
        ayuda("Qué tan seguido tienes al menos una copia entre las 7 cartas iniciales, con cada lista (ya contando el mulligan). Una carta que solo está en una de las dos aparece con «—» en la otra.") + "</div>" : "") +
      bloque("Motores", "g-motores-cmp") + '<table class="tabla cmp"><thead><tr><th>Tipo</th><th>A (mano)</th><th>B (mano)</th><th>Diferencia</th></tr></thead><tbody>' + filasMotores() + "</tbody></table>" +
        ayuda("Cuántas cartas hay de cada motor (robo, búsqueda, Energía…) y qué tan seguido llega al menos una a la mano inicial. Sale del texto de cada carta; si alguna se leyó mal, corrígela en Probar mazo → Motores.") + "</div>" +
      bloque("Metas", "g-metas-cmp") + '<table class="tabla cmp"><thead><tr><th>Meta</th><th>A</th><th>B</th><th>Diferencia</th></tr></thead><tbody>' + filasMetas() + "</tbody></table>" +
        ayuda("Se juntan las metas guardadas de los dos mazos y cada una se prueba en 50.000 partidas con cada lista. «Dentro del margen» es una diferencia que puede ser puro azar de la simulación. La ★ es la meta principal de la lista A.") + "</div>";
  }
  caja.onclick = e => { if (e.target.closest("[data-swap]")) montarComparar(caja, { a: b, b: a, base }); };
  pintar();
  setTimeout(simularMetas, 30);   // las metas tardan un segundo: primero se ve todo lo demás
  /* el texto de las cartas, para los motores */
  const cargar = async (X, M) => { await Promise.all(X.CARTAS.filter(c => !esEnergiaBasica(c.nombre)).map(async c => { M.set(c.nombre, await datoCarta(idTcgdex(c.foto))); })); };
  Promise.all([cargar(A, TEXTOS_A), cargar(B, TEXTOS_B)]).then(() => { if (caja._cmp !== token) return; textosListos = true; pintar(); });
}
