/* selpoke.js — elegir una baraja como en Training Court: dos botones («Pokémon…» y «Pokémon 2 (opcional)») que abren un
   buscador con el sprite de cada Pokémon. Lo usa partidas.html para «Tu baraja» y la baraja de cada rival.
   El valor sigue en el input de siempre («Dragapult ex + Dusknoir», el que lee canonica() al guardar): montar() lo deja oculto
   y pone los botones al lado; si el código cambia input.value, refrescar(input) repinta los botones.
     · opciones(voc, recientes): la lista (vocabulario() de partidas.js: nombre normalizado en inglés o castellano → el de la
       carta en inglés) y las barajas recientes del jugador, que salen primero al abrir el primer Pokémon (las elige enteras).
     · Se busca por cualquier parte del nombre, en inglés o en castellano; lo que empieza igual va primero. Si no está, se puede
       usar lo escrito tal cual (cartas que no están en la base de Estándar). Flechas, Enter y Esc. */
import { norm } from "./listamazo.js?v=e70802e24ce2";
import { spr } from "./metaimg.js?v=e70802e24ce2";

const MAX = 80;
let OPC = [], RECIENTES = [], POP = null;
const partes = v => String(v || "").split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean).slice(0, 2);

export function opciones(voc, recientes = []){
  const por = new Map();
  for (const [clave, en] of voc || []){ if (!por.has(en)) por.set(en, new Set([norm(en)])); por.get(en).add(clave); }
  OPC = [...por].map(([en, s]) => ({ en, claves: [...s] })).sort((a, b) => a.en.localeCompare(b.en));
  RECIENTES = recientes.filter(Boolean).slice(0, 6);
}

export function montar(input){
  if (input._sel) return input._sel;
  const caja = document.createElement("div");
  caja.className = "selp";
  caja.innerHTML = '<button type="button" class="selp-b" data-i="0" aria-haspopup="listbox"></button><button type="button" class="selp-b" data-i="1" aria-haspopup="listbox"></button>';
  input.type = "hidden";
  input.after(caja);
  const pintar = () => {
    const p = partes(input.value);
    caja.querySelectorAll(".selp-b").forEach((b, i) => {
      const n = p[i];
      b.classList.toggle("selp-vacio", !n);
      b.disabled = i === 1 && !p[0];
      b.setAttribute("aria-label", (i ? "Segundo Pokémon" : "Pokémon principal") + (n ? ": " + n : ""));
      b.innerHTML = n ? spr(n) + "<span>" + esc(n) + '</span><i class="selp-x" title="Quitar" aria-hidden="true">×</i>'
                      : "<span>" + (i ? "Pokémon 2 (opcional)" : "Pokémon…") + '</span><i class="selp-fl" aria-hidden="true">⌄</i>';
    });
  };
  const poner = (i, n) => {
    const p = partes(input.value);
    if (n == null) p.splice(i, 1); else p[i] = n;
    fijar(p.filter(Boolean).join(" + "));
  };
  const fijar = v => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); pintar(); };
  caja.addEventListener("click", e => {
    const b = e.target.closest(".selp-b");
    if (!b || b.disabled) return;
    const i = +b.dataset.i;
    if (e.target.closest(".selp-x")){ poner(i, null); return; }
    abrirBuscador(b, i, partes(input.value)[i], n => poner(i, n), fijar);
  });
  input._sel = { pintar, primero: () => caja.querySelector(".selp-b") };
  pintar();
  return input._sel;
}
export const refrescar = input => { if (input && input._sel) input._sel.pintar(); };
/* para llevar el foco al selector (los mensajes de «falta la baraja») */
export const enfocar = input => { const b = input && input._sel ? input._sel.primero() : input; if (b) b.focus(); };

function cerrar(volver){
  if (!POP) return;
  const { pop, boton, fuera } = POP;
  document.removeEventListener("pointerdown", fuera, true);
  removeEventListener("resize", POP.resize);
  pop.remove(); POP = null;
  boton.setAttribute("aria-expanded", "false");
  if (volver) boton.focus();
}
function abrirBuscador(boton, i, actual, elegir, fijarEntera){
  cerrar(false);
  const pop = document.createElement("div");
  pop.className = "selp-pop";
  pop.innerHTML = '<div class="selp-bus"><input type="search" placeholder="Buscar Pokémon (en inglés o castellano)" aria-label="Buscar Pokémon" autocomplete="off" spellcheck="false"></div>' +
    '<ul class="selp-lista" role="listbox" aria-label="Pokémon"></ul>';
  document.body.append(pop);
  const q = pop.querySelector("input"), ul = pop.querySelector("ul");
  const ubicar = () => {
    const r = boton.getBoundingClientRect(), w = Math.min(380, innerWidth - 16);
    pop.style.width = w + "px";
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + scrollX + "px";
    pop.style.top = r.bottom + scrollY + 6 + "px";
  };
  const fuera = e => { if (!pop.contains(e.target) && !boton.contains(e.target)) cerrar(false); };
  POP = { pop, boton, fuera, resize: ubicar };
  document.addEventListener("pointerdown", fuera, true);
  addEventListener("resize", ubicar);
  boton.setAttribute("aria-expanded", "true");
  ubicar();

  let items = [], act = 0;
  const pintarLista = () => {
    const texto = q.value.trim(), t = norm(texto);
    const rec = !t && i === 0 ? RECIENTES : [];
    let res = t ? OPC.filter(o => o.claves.some(k => k.includes(t))) : OPC;
    if (t) res = res.map(o => ({ o, pri: o.claves.some(k => k.startsWith(t)) ? 0 : 1 })).sort((a, b) => a.pri - b.pri || a.o.en.localeCompare(b.o.en)).map(x => x.o);
    res = res.slice(0, MAX);
    /* lo escrito tal cual va al final: Enter elige el primer Pokémon encontrado, no el texto a medias */
    items = [...rec.map(v => ({ tipo: "rec", v })),
      ...res.map(o => ({ tipo: "p", v: o.en })),
      ...(t && !res.some(o => norm(o.en) === t) ? [{ tipo: "libre", v: texto.charAt(0).toUpperCase() + texto.slice(1) }] : []),
      ...(actual ? [{ tipo: "quitar" }] : [])];
    const k0 = items.findIndex(x => x.tipo === "p" && x.v === actual), k1 = t ? items.findIndex(x => x.tipo === "p") : -1;
    act = k0 >= 0 ? k0 : k1 >= 0 ? k1 : 0;
    let html = "", grupo = "";
    items.forEach((it, k) => {
      const g = it.tipo === "rec" ? "Tus barajas recientes" : it.tipo === "p" && rec.length ? "Pokémon" : "";
      if (g && g !== grupo){ html += '<li class="selp-tit" role="presentation">' + g + "</li>"; grupo = g; }
      const cuerpo = it.tipo === "quitar" ? "<span>Quitar este Pokémon</span>"
        : it.tipo === "libre" ? "<span>Usar «" + esc(it.v) + "»</span>"
        : spr(it.v) + "<span>" + esc(it.v) + "</span>";
      html += '<li role="option" id="selp-o' + k + '" data-k="' + k + '" class="selp-o ' + it.tipo + '" aria-selected="' + (k === act) + '">' + cuerpo + "</li>";
    });
    ul.innerHTML = html || '<li class="selp-tit" role="presentation">No hay Pokémon con ese nombre.</li>';
    marcar(false);
  };
  const marcar = (mover = true) => {
    ul.querySelectorAll(".selp-o").forEach(li => li.setAttribute("aria-selected", +li.dataset.k === act));
    const li = ul.querySelector('[data-k="' + act + '"]');
    if (li){ q.setAttribute("aria-activedescendant", li.id); if (mover) li.scrollIntoView({ block: "nearest" }); }
  };
  const tomar = k => {
    const it = items[k];
    if (!it) return;
    if (it.tipo === "rec") fijarEntera(it.v);
    else if (it.tipo === "quitar") elegir(null);
    else elegir(it.v);
    cerrar(true);
  };
  q.addEventListener("input", pintarLista);
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); if (items.length){ act = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; marcar(); } }
    else if (e.key === "Enter"){ e.preventDefault(); tomar(act); }
    else if (e.key === "Escape"){ e.preventDefault(); cerrar(true); }
  });
  ul.addEventListener("click", e => { const li = e.target.closest(".selp-o"); if (li) tomar(+li.dataset.k); });
  ul.addEventListener("pointermove", e => { const li = e.target.closest(".selp-o"); if (li && +li.dataset.k !== act){ act = +li.dataset.k; marcar(false); } });
  pintarLista();
  q.focus();
}
