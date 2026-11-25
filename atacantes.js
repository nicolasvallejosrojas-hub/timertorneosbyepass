/* ============================================================
   atacantes.js — la pestaña «Atacantes» de Probar mazo
   ------------------------------------------------------------
   El jugador elige quiénes atacan. Para cada uno se arma su línea de evolución (de qué evoluciona, por TCGdex) y se
   calcula, al turno elegido, la probabilidad de tener a la vez: una carta que trae cada pieza de la línea (la pieza
   misma o un buscador que la alcanza, leído con efectos.js) y las Energías que paga el ataque (cantidad y tipo).
   Es una simulación de 30.000 partidas con mulligan y premios. Supone que cada buscador se puede jugar (no cuenta el
   límite de un Partidario por turno ni el costo de descartar) y que se une toda la Energía vista: es un techo optimista,
   bueno para comparar atacantes entre sí. El ranking sale de «daño por Energía × acceso × importancia»; si el jugador
   fija un orden, ese orden manda. Se recuerda por mazo en localStorage «probar-atacantes:<mazo>».
   esc() es la global de config.js.
   ============================================================ */
import { traePokemon, proveeEnergia, costoDe, danoDe } from "./efectos.js?v=11231c1e2ccf";
import { alMenosUna, simular } from "./probabilidad.js?v=11231c1e2ccf";
import { perfilDe } from "./motores.js?v=11231c1e2ccf";
import { pct, num, leerLS, guardarLS, ayuda } from "./probar-ui.js?v=11231c1e2ccf";

const TIPO_ES = { Fire: "Fuego", Psychic: "Psíquica", Water: "Agua", Grass: "Planta", Lightning: "Rayo", Fighting: "Lucha", Darkness: "Oscura", Metal: "Metálica", Fairy: "Hada", Dragon: "Dragón", Colorless: "Incolora" };
const textoCosto = c => Object.entries(c.porTipo).map(([t, n]) => (n > 1 ? n + " " : "") + (TIPO_ES[t] || t)).join(" + ") || "gratis";
const mejorAtaque = ats => ats.map((a, k) => ({ k, d: danoDe(a), c: costoDe(a).total })).sort((x, y) => y.d - x.d || x.c - y.c)[0].k;

export function montarAtacantes(caja, ctx){
  const LS = "probar-atacantes:" + ctx.clave;
  const est = leerLS(LS, {});            // { sel, orden, peso, ataque, T }
  est.peso ??= {}; est.ataque ??= {}; est.T ??= 3;
  const guardar = () => guardarLS(LS, est);
  const CACHE = new Map();
  const poke = () => { const vistos = new Set(); return ctx.a.CARTAS.filter(c => c.sec === "Pokémon" && !vistos.has(c.nombre) && vistos.add(c.nombre)); };
  const dato = c => ctx.textos.get(c.nombre);
  const danoMax = c => { const d = dato(c); return d && d.attacks && d.attacks.length ? Math.max(...d.attacks.map(danoDe)) : 0; };
  /* Sin elegir nada todavía: los dos que más daño hacen (se ve y se cambia tocando los nombres). */
  const sugeridos = () => poke().filter(c => danoMax(c) > 0).sort((x, y) => danoMax(y) - danoMax(x)).slice(0, 2).map(c => c.nombre);
  const seleccion = () => est.sel || sugeridos();

  /* Las cartas que traen a un Pokémon: sus copias y los buscadores de Entrenador que lo alcanzan. */
  function acceso(p, T){
    const a = ctx.a, d = dato(p) || {}, pk = { name: d.name || p.en, stage: d.stage || (p.basico ? "Basic" : ""), hp: d.hp, types: d.types };
    const propias = a.CARTAS.filter(x => x.nombre === p.nombre);
    const tutores = a.CARTAS.filter(x => x.sec === "Entrenador" && x.cant > 0 && (() => {
      const pf = perfilDe(x, dato(x), ctx.over);
      return pf.corregido ? pf.roles.includes("buscaPokemon") : traePokemon(pf.ef, pk);
    })());
    const grupo = [...new Map([...propias, ...tutores].map(x => [x.i, x])).values()];
    const t = grupo.reduce((s, x) => s + x.cant, 0), tb = p.basico ? propias.reduce((s, x) => s + x.cant, 0) : 0;
    return { ids: grupo.map(x => x.i), t, p: t ? alMenosUna({ N: a.N, t, tb, b: a.B, vistas: 7 + T }) : 0, tutores: tutores.map(x => x.nombre) };
  }

  function calcular(c, T){
    const d = dato(c);
    if (!d || !d.attacks || !d.attacks.length) return { c, sinDatos: true, score: 0 };
    const a = ctx.a, ats = d.attacks;
    let k = ats.findIndex(x => x.name === est.ataque[c.nombre]); if (k < 0) k = mejorAtaque(ats);
    const at = ats[k], costo = costoDe(at), dano = danoDe(at), cadena = ctx.cadena(c);
    const piezas = cadena.map(p => ({ carta: p, ...acceso(p, T) }));   // p: probabilidad de tener algo que la traiga
    const candy = a.CARTAS.filter(x => x.en === "Rare Candy" && x.cant > 0);
    const usaCandy = cadena.length === 3 && candy.length > 0;
    if (usaCandy) piezas[1] = { ...piezas[1], ids: [...new Set([...piezas[1].ids, ...candy.map(x => x.i)])] };   // la Fase 1 o el Rare Candy
    const minT = usaCandy ? 2 : cadena.length;
    const prov = a.CARTAS.filter(x => x.sec === "Energía" && x.cant > 0).map(x => ({ x, tipos: proveeEnergia(x.nombre, ctx.textos.get(x.nombre)) }));
    const reqs = piezas.map(z => z.ids), faltaTipo = [];
    for (const [tipo, n] of Object.entries(costo.porTipo)){
      if (tipo === "Colorless") continue;
      const ids = prov.filter(q => q.tipos.includes(tipo) || q.tipos.includes("*")).map(q => q.x.i);
      if (!ids.length) faltaTipo.push(tipo); else reqs.push({ cartas: ids, min: n });
    }
    if (costo.total) reqs.push({ cartas: prov.map(q => q.x.i), min: costo.total });
    const clave = [c.nombre, at.name, T, JSON.stringify(ctx.over || {})].join("|");   // las correcciones de roles cambian qué buscadores cuentan
    let res;
    if (T < minT || faltaTipo.length) res = { p: 0, mas: 0 };
    else res = CACHE.get(clave) || CACHE.set(clave, simular({ mazo: a.MAZO, esBasico: a.ES_B, reqs, turno: T, veces: 30000 })).get(clave);
    const dpe = dano / Math.max(1, costo.total), peso = est.peso[c.nombre] || 3;
    return { c, d, ats, k, at, costo, dano, dpe, piezas, res, minT, faltaTipo, peso, score: dpe * res.p * (peso / 3) };
  }

  function pintar(){
    const T = est.T, sel = seleccion(), todos = poke();
    if (!ctx.listo()){ caja.innerHTML = '<p class="pista" role="status">Leyendo el texto de las cartas en TCGdex… En unos segundos aparecen los ataques.</p>'; return; }
    const filas = sel.map(n => todos.find(c => c.nombre === n)).filter(Boolean).map(c => calcular(c, T));
    /* orden: el que fijó el jugador primero; el resto, por puntaje */
    const manual = (est.orden || []).filter(n => filas.some(f => f.c.nombre === n));
    const resto = filas.filter(f => !manual.includes(f.c.nombre)).sort((x, y) => y.score - x.score);
    const orden = [...manual.map(n => filas.find(f => f.c.nombre === n)), ...resto];
    caja.innerHTML =
      '<div class="bloqueR"><h3>¿Quiénes atacan en tu mazo?</h3><p class="pista">Toca los Pokémon que quieres comparar. ' + (est.sel ? "" : "Para empezar elegí los dos que más daño hacen: cámbialos cuando quieras. ") + "</p>" +
        '<div class="chips">' + todos.map(c => '<button type="button" class="chipM" data-sel="' + esc(c.nombre) + '" aria-pressed="' + sel.includes(c.nombre) + '">' + esc(c.nombre) + " ×" + c.cant + "</button>").join("") + "</div>" +
        '<div class="turnos" role="group" aria-label="Turno"><span class="mini">Contar hasta el</span>' + [1, 2, 3, 4].map(t => '<button type="button" class="btn chico" data-turno="' + t + '" aria-pressed="' + (t === T) + '">turno ' + t + "</button>").join("") + "</div></div>" +
      (orden.length ? '<div class="bloqueR" id="g-atacantes"><h3>Ranking de atacantes</h3><p class="pista">' + (est.orden && est.orden.length ? "Con el orden que tú fijaste." : "Ordenados por daño por Energía, qué tan seguido llegan y la importancia que les des.") +
        ((est.orden && est.orden.length) || Object.keys(est.peso).length ? ' <button type="button" class="btn chico" data-reset>Volver al orden automático</button>' : "") + "</p>" +
        '<div class="atks">' + orden.map((f, i) => f.sinDatos
          ? '<div class="atk"><div class="atkCab"><span class="pos">' + (i + 1) + "</span><b>" + esc(f.c.nombre) + '</b></div><p class="pista">Sin datos de ataques en TCGdex para esta carta.</p></div>'
          : '<div class="atk"><div class="atkCab"><span class="pos">' + (i + 1) + "</span><b>" + esc(f.c.nombre) + "</b> ×" + f.c.cant +
            '<span class="mover"><button type="button" data-sube="' + esc(f.c.nombre) + '" aria-label="Subir ' + esc(f.c.nombre) + '"' + (i ? "" : " disabled") + '>↑</button>' +
            '<button type="button" data-baja="' + esc(f.c.nombre) + '" aria-label="Bajar ' + esc(f.c.nombre) + '"' + (i < orden.length - 1 ? "" : " disabled") + ">↓</button></span></div>" +
            '<div class="atkCuerpo"><label class="campo"><span>Ataque</span><select data-ataque="' + esc(f.c.nombre) + '">' + f.ats.map((x, k) => '<option value="' + esc(x.name) + '"' + (k === f.k ? " selected" : "") + ">" +
              esc(x.name) + " · " + danoDe(x) + "</option>").join("") + "</select></label>" +
            '<div class="atkDato"><b>' + f.dano + '</b> de daño · cuesta ' + textoCosto(f.costo) + ' · <b>' + num(f.dpe, 0) + "</b> por Energía</div>" +
            '<div class="atkP ' + (f.res.p >= .5 ? "alto" : f.res.p >= .25 ? "medio" : "bajo") + '"><span>Acceso al turno ' + T + '</span><b>' + (T < f.minT ? "—" : pct(f.res.p, 1)) + "</b>" +
              (T < f.minT ? "<small>necesita al menos el turno " + f.minT + "</small>" : f.faltaTipo.length ? "<small>no tienes Energía " + f.faltaTipo.map(t => TIPO_ES[t] || t).join(", ") + "</small>" : "<small>±" + num(f.res.mas * 100, 1) + "</small>") + "</div>" +
            '<div class="linea">' + f.piezas.map(z => esc(z.carta.nombre) + " <b>" + pct(z.p, 0) + "</b> <span class=\"mini\">(" + z.t + " cartas)</span>").join(" → ") + "</div>" +
            '<div class="estrellas" role="group" aria-label="Importancia de ' + esc(f.c.nombre) + '"><span class="mini">Importancia</span>' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-peso="' + n + '" data-carta="' + esc(f.c.nombre) + '" aria-pressed="' + (n === f.peso) + '" aria-label="' + n + ' de 5">' + (n <= f.peso ? "★" : "☆") + "</button>").join("") + "</div></div></div>").join("") + "</div>" +
        ayuda("<b>Acceso al turno " + T + ":</b> la probabilidad de tener, en tus primeras " + (7 + T) + " cartas, algo que traiga <i>cada pieza</i> de su línea (la carta o un buscador que la alcanza) <i>y</i> las Energías que pide el ataque, con su tipo. " +
          "<b>La línea</b> muestra cada pieza con su propio acceso: la más baja es el cuello de botella. Si hay Rare Candy, la Fase 2 puede saltarse la Fase 1. " +
          "<b>Es un techo:</b> supone que juegas todos los buscadores que veas y que unes toda la Energía, sin el límite de un Partidario por turno, así que sirve para comparar atacantes, no para prometer un porcentaje. " +
          "<b>Ranking:</b> daño por Energía × acceso × (importancia ÷ 3). La importancia es tuya (3 = normal); con las flechas fijas el orden y esa decisión manda sobre el cálculo. " +
          "<b>Ejemplo:</b> un ataque de 200 con 2 Energías vale 100 por Energía; si llega el 40 % de las veces, su puntaje es 40; uno de 70 con 1 Energía que llega el 80 % vale 56.", "¿Cómo se calcula?") + "</div>"
        : '<p class="pista">Elige al menos un Pokémon de arriba para ver su ranking.</p>');
  }

  caja.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.sel){ const s = new Set(seleccion()); s.has(d.sel) ? s.delete(d.sel) : s.add(d.sel); est.sel = [...s]; est.orden = (est.orden || []).filter(n => s.has(n)); guardar(); pintar(); }
    else if (d.turno){ est.T = +d.turno; guardar(); pintar(); }
    else if (d.peso){ est.peso[d.carta] = +d.peso; guardar(); pintar(); }
    else if (d.sube || d.baja){
      const nombre = d.sube || d.baja, vis = [...caja.querySelectorAll("[data-sube]")].map(x => x.dataset.sube), i = vis.indexOf(nombre), j = d.sube ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= vis.length) return;
      [vis[i], vis[j]] = [vis[j], vis[i]]; est.orden = vis; guardar(); pintar();
    }
    else if ("reset" in d){ est.orden = null; est.peso = {}; guardar(); pintar(); }
  });
  caja.addEventListener("change", e => { const s = e.target.closest("[data-ataque]"); if (s){ est.ataque[s.dataset.ataque] = s.value; guardar(); pintar(); } });
  return { pintar };
}
