/* ▌ÍNDICE de motores.js
    1. Qué motores tiene la lista (se calcula con el texto de cada carta)
    2. La pestaña «Motores» de Probar mazo
*/
/* ============================================================
   motores.js — los motores de la lista: robo, búsqueda, Energía, recuperación y cambio, leídos del texto de cada carta
   ------------------------------------------------------------
   El texto sale de TCGdex (tcgdex.js) y se lee con efectos.js. Lo que el jugador corrige a mano queda por mazo en
   localStorage «probar-roles:<mazo>» y manda sobre la lectura. esc() es la global de config.js.
   ============================================================ */
import { leerEfectos, rolesDe, etiquetas, manoDespues, ROLES } from "./efectos.js?v=7aff7e675b0a";
import { alMenosUna } from "./probabilidad.js?v=7aff7e675b0a";
import { pct, num, leerLS, guardarLS, ayuda, chips } from "./probar-ui.js?v=7aff7e675b0a";
import { esEnergiaBasica } from "./listamazo.js?v=7aff7e675b0a";

/* ▌BLOQUE 1 · Qué motores tiene la lista ════════════════════════════════════════ */
export const GRUPOS = [
  { id: "robo", titulo: "Robo directo", roles: ["robo", "mira"], nota: "Entrenadores que roban cartas o miran el mazo" },
  { id: "buscaPokemon", titulo: "Buscan Pokémon", roles: ["buscaPokemon"], nota: "Traen un Pokémon al instante" },
  { id: "energia", titulo: "Buscan o unen Energía", roles: ["buscaEnergia", "une"], nota: "Aceleran la Energía" },
  { id: "buscaOtras", titulo: "Buscan Entrenadores u otras cartas", roles: ["buscaEntrenador", "buscaCarta"], nota: "Traen Partidarios, Objetos y más" },
  { id: "recupera", titulo: "Recuperan del descarte", roles: ["recupera"], nota: "Devuelven cartas de la pila de descartes" },
  { id: "cambia", titulo: "Cambian o atraen Pokémon", roles: ["cambia"], nota: "Boss's Orders, Switch y parecidos" },
];
/* Los roles que el jugador puede marcar a mano (sin «mira», que es solo de habilidades). */
const ROLES_MARCABLES = [["robo", "Roba"], ["buscaPokemon", "Pokémon"], ["buscaEnergia", "Energía"], ["buscaEntrenador", "Entrenador"], ["buscaCarta", "Otra"], ["une", "Une"], ["recupera", "Recupera"], ["cambia", "Cambia"]];

/* Lo que se sabe de una carta de Entrenador: sus efectos y sus roles (los corregidos a mano mandan). */
export function perfilDe(c, dato, over){
  const ef = dato ? leerEfectos(dato.effect) : [], detectados = rolesDe(ef), o = over && over[c.nombre];
  return { ef, detectados, roles: Array.isArray(o) ? o : detectados, corregido: Array.isArray(o), sinTexto: !dato };
}
/* Los Pokémon de la lista con una habilidad que roba, mira o busca (en juego, no en la mano). */
export function habilidadesDe(a, textos){
  const out = [];
  for (const c of a.CARTAS) if (c.sec === "Pokémon"){
    const d = textos.get(c.nombre);
    for (const h of (d && d.abilities) || []){ const ef = leerEfectos(h.effect), roles = rolesDe(ef); if (roles.length) out.push({ c, nombre: h.name, ef, roles }); }
  }
  return out;
}
/* Los grupos con cuántas copias hay y qué tan seguido llega al menos una a la mano (7 cartas) y al turno 2 (9 cartas). */
export function calcularGrupos(a, textos, over){
  const trainers = a.CARTAS.filter(c => c.sec === "Entrenador").map(c => ({ c, p: perfilDe(c, textos.get(c.nombre), over) }));
  const prob = (t, vistas) => t ? alMenosUna({ N: a.N, t, tb: 0, b: a.B, vistas }) : 0;
  const grupos = GRUPOS.map(g => {
    const items = trainers.filter(x => x.p.roles.some(r => g.roles.includes(r))), t = items.reduce((s, x) => s + x.c.cant, 0);
    return { ...g, items, t, p7: prob(t, 7), p9: prob(t, 9) };
  });
  const ens = a.CARTAS.filter(c => c.sec === "Energía").map(c => ({ c, p: { ef: [], roles: [] } })), te = ens.reduce((s, x) => s + x.c.cant, 0);
  grupos.push({ id: "cartasEnergia", titulo: "Cartas de Energía", roles: [], nota: "Básicas y especiales", items: ens, t: te, p7: prob(te, 7), p9: prob(te, 9) });
  return grupos;
}

/* ▌BLOQUE 2 · La pestaña «Motores» ═══════════════════════════════════════════════ */
const TIPO_ENTRENADOR = { Supporter: "Partidarios", Item: "Objetos", Stadium: "Estadios", Tool: "Herramientas" };
export function montarMotores(caja, ctx){
  const LSO = "probar-roles:" + ctx.clave;
  const over = leerLS(LSO, {});
  const lista = (items, nombre = c => c.nombre) => items.map(x => esc(nombre(x.c)) + " ×" + x.c.cant).join(", ");

  /* La lista por tipo, en una barra: Pokémon (Básicos y Evoluciones), Entrenadores (por tipo) y Energías. */
  function porTipo(a, textos, listo){
    const cuenta = new Map(), suma = (k, n) => cuenta.set(k, (cuenta.get(k) || 0) + n);
    for (const c of a.CARTAS){
      if (c.sec === "Pokémon") suma(c.basico ? "Pokémon Básicos" : "Pokémon de Evolución", c.cant);
      else if (c.sec === "Energía") suma(esEnergiaBasica(c.nombre) ? "Energías básicas" : "Energías especiales", c.cant);
      else { const d = textos.get(c.nombre); suma(d && TIPO_ENTRENADOR[d.trainerType] || (listo ? "Otros Entrenadores" : "Entrenadores"), c.cant); }
    }
    const orden = ["Pokémon Básicos", "Pokémon de Evolución", "Partidarios", "Objetos", "Estadios", "Herramientas", "Entrenadores", "Otros Entrenadores", "Energías básicas", "Energías especiales"];
    const filas = orden.filter(k => cuenta.get(k)).map((k, i) => ({ k, n: cuenta.get(k), i }));
    return '<div class="apilada" role="img" aria-label="' + filas.map(f => f.n + " " + f.k).join(", ") + '">' + filas.map(f => '<i class="seg s' + f.i + '" style="flex:' + f.n + '" title="' + f.n + " " + f.k + '"></i>').join("") + "</div>" +
      '<div class="leyendaT">' + filas.map(f => '<span><i class="seg s' + f.i + '"></i>' + f.k + " <b>" + f.n + "</b></span>").join("") + "</div>";
  }

  function pintar(){
    const a = ctx.a, textos = ctx.textos, listo = ctx.listo(), grupos = calcularGrupos(a, textos, over);
    const trainers = a.CARTAS.filter(c => c.sec === "Entrenador").map(c => ({ c, p: perfilDe(c, textos.get(c.nombre), over) }));
    const habs = habilidadesDe(a, textos);
    /* tabla «¿cuándo conviene cada robo?» */
    const ms = [1, 3, 5, 7];
    const robos = trainers.filter(x => x.p.roles.includes("robo") && ms.some(m => manoDespues(x.p.ef, m) !== null));
    const celda = (h, m) => h === null ? '<td class="igual">—</td>' : '<td><span class="' + (h > m ? "mas" : h < m ? "menos" : "igual") + '">' + h + '</span><span class="d ' + (h > m ? "mas" : h < m ? "menos" : "igual") +
      '">' + (h > m ? "+" : h < m ? "−" : "") + Math.abs(h - m) + "</span></td>";
    const otros = trainers.filter(x => x.p.roles.includes("robo") && !robos.includes(x));

    caja.innerHTML =
      (listo ? "" : '<p class="pista" role="status">Leyendo el texto de las cartas en TCGdex… Los grupos se completan solos en unos segundos.</p>') +
      '<div class="bloqueR"><h3>Tu lista por tipo</h3>' + porTipo(a, textos, listo) +
        ayuda("Cada color es un tipo de carta y su ancho es cuántas copias llevas. Los Entrenadores se separan por su tipo oficial (Partidario, Objeto, Estadio, Herramienta), que sale del texto de TCGdex. " +
          "<b>Ejemplo:</b> pocos Partidarios con muchos Objetos de búsqueda es un mazo que arma su jugada sin depender de un solo turno de Partidario (solo puedes jugar uno por turno).") + "</div>" +
      '<div class="bloqueR" id="g-motores"><h3>Motores de tu lista</h3><p class="pista">Cuántas cartas hacen cada cosa y qué tan seguido llega al menos una a tu mano.</p>' +
        '<div class="mot cab"><span>Motor</span><span class="relleno"></span><span class="n">Mano</span><span class="n">Turno 2</span></div>' +
        grupos.map(g => g.t ? '<div class="mot"><span><b>' + g.titulo + "</b> · " + g.t + (g.t === 1 ? " carta" : " cartas") + '<br><span class="mini">' + lista(g.items) + '</span></span>' +
          '<div class="pbar"><i style="width:' + (g.p7 * 100).toFixed(1) + '%"></i></div><span class="n">' + pct(g.p7, 1) + '</span><span class="n">' + pct(g.p9, 1) + "</span></div>"
          : '<div class="mot sin"><span><b>' + g.titulo + '</b> · ninguna<br><span class="mini">' + g.nota + '</span></span><div class="relleno"></div><span class="n">—</span><span class="n">—</span></div>').join("") +
        (habs.length ? '<p class="nota"><b>Habilidades que roban o buscan</b> (tienen que estar en juego, por eso no cuentan en la mano): ' +
          habs.map(h => esc(h.c.nombre) + " ×" + h.c.cant + " (" + esc(h.nombre) + ")").join(", ") + ".</p>" : "") +
        ayuda("<b>Mano:</b> probabilidad de tener al menos una carta del grupo entre las 7 iniciales (ya contando el mulligan). <b>Turno 2:</b> hasta tu segundo turno (la mano y 2 robos). " +
          "Una carta puede estar en más de un grupo (Hilda busca un Pokémon y una Energía, y cuenta en los dos). <b>Ejemplo:</b> si «Robo directo» está en 40 %, en 6 de cada 10 manos no tienes con qué robar el primer turno. " +
          "Los números suponen que cada carta se juega: no cuentan el límite de un Partidario por turno.", "¿Cómo se leen los motores?") + "</div>" +
      (robos.length || otros.length ? '<div class="bloqueR"><h3>¿Cuándo conviene cada robo?</h3><p class="pista">Cartas que te quedan en la mano después de jugarlo, según cuántas tenías al soltarlo (sin contar la carta misma).</p>' +
        (robos.length ? '<table class="tabla cuando"><thead><tr><th>Carta</th>' + ms.map(m => "<th>" + m + (m === 1 ? " carta" : " cartas") + "</th>").join("") + "</tr></thead><tbody>" +
          robos.map(x => '<tr><td><b>' + esc(x.c.nombre) + "</b> ×" + x.c.cant + '<div class="chipsF">' + chips(etiquetas(x.p.ef)) + "</div></td>" + ms.map(m => celda(manoDespues(x.p.ef, m), m)).join("") + "</tr>").join("") + "</tbody></table>" : "") +
        (otros.length ? '<p class="nota">Roban, pero depende de la partida (premios, o de lo que descartes), así que no tienen número fijo: ' +
          otros.map(x => "<b>" + esc(x.c.nombre) + "</b> (" + etiquetas(x.p.ef).map(e => esc(e.t)).join(" · ") + ")").join("; ") + ".</p>" : "") +
        ayuda("En cada celda, el número grande es cuántas cartas tienes después y el chico cuánto cambió respecto a antes. Verde: ganas cartas. Rojo: pierdes. " +
          "<b>Ejemplo:</b> un Partidario que baraja tu mano y roba 6 te deja con 6 siempre: con 2 cartas en la mano ganas 4, con 7 pierdes 1 (y lo que tenías vuelve al mazo, incluso un Rare Candy). " +
          "Uno que roba 3 suma 3 con cualquier mano. Los de «hasta tener N» solo ayudan si tienes menos de N.", "¿Cómo se lee?") + "</div>" : "") +
      '<div class="bloqueR"><h3>Cómo leí cada carta</h3><p class="pista">Si algo está mal, márcalo tú: tu corrección manda y queda guardada para este mazo.</p>' +
        '<div class="revisar">' + trainers.map(x => {
          const d = textos.get(x.c.nombre);
          return '<div class="rev"><div><b>' + esc(x.c.nombre) + "</b> ×" + x.c.cant + (x.p.corregido ? ' <span class="e amar">corregida a mano</span> <button type="button" class="btn chico" data-quitar-rol="' + esc(x.c.nombre) + '">Volver a la lectura</button>' : "") +
            '<div class="chipsF">' + (x.p.sinTexto ? (listo ? '<span class="e amar">Sin texto en TCGdex: márcala tú</span>' : '<span class="e">leyendo…</span>') : chips(etiquetas(x.p.ef)) || '<span class="e">Sin motor</span>') + "</div>" +
            (d && d.effect ? '<details class="textoC"><summary>Ver el texto de la carta</summary><p>' + esc(d.effect) + "</p></details>" : "") + "</div>" +
            '<div class="roles" role="group" aria-label="Qué hace ' + esc(x.c.nombre) + '">' + ROLES_MARCABLES.map(([r, t]) =>
              '<label title="' + ROLES[r] + '"><input type="checkbox" data-rol="' + r + '" data-carta="' + esc(x.c.nombre) + '"' + (x.p.roles.includes(r) ? " checked" : "") + "> " + t + "</label>").join("") + "</div></div>";
        }).join("") + "</div>" +
        ayuda("Se lee el texto de cada Entrenador (en inglés, de TCGdex) y se buscan sus efectos: cuántas cartas roba, si baraja o descarta la mano, qué busca, si une Energía. " +
          "Es una lectura por palabras: una carta rara puede quedar mal. Marca o desmarca las casillas y los grupos de arriba se rehacen al tiro.", "¿Cómo se leen las cartas?") + "</div>";
  }

  caja.addEventListener("change", e => {
    const k = e.target.closest("[data-rol]"); if (!k) return;
    const nombre = k.dataset.carta, marcados = [...caja.querySelectorAll('[data-carta="' + CSS.escape(nombre) + '"]')].filter(x => x.checked).map(x => x.dataset.rol);
    over[nombre] = marcados; guardarLS(LSO, over); pintar();
  });
  caja.addEventListener("click", e => {
    const q = e.target.closest("[data-quitar-rol]"); if (!q) return;
    delete over[q.dataset.quitarRol]; guardarLS(LSO, over); pintar();
  });
  return { pintar, over };
}
