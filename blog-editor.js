/* blog-editor.js — el editor de artículos del blog (solo administración; lo carga blog.html con ?nuevo o ?editar=<id>).
   Se escribe como en un procesador de texto (contenteditable): texto, título, subtítulo, cita, negrita, cursiva, listas,
   enlaces, línea, imágenes y cartas (cualquier carta, buscada por nombre en TCGdex). Lo que se pega desde Word o Docs pasa por
   limpiarHtml (blog-html.js), igual que lo que se guarda.
   Imágenes: el navegador las achica antes de subirlas (1600 px de ancho, WebP; JPG si el navegador no sabe WebP; la de
   portada además con una miniatura de 640 px para la lista) y van al Storage en blog/<carpeta del artículo>/. Al guardar se
   borran las que ya no se usan; al borrar el artículo, todas.
   Guardado: una copia en este navegador a cada cambio (por si se cierra la pestaña); el borrador se guarda solo en la base
   a los pocos segundos; un artículo publicado se cambia con «Guardar cambios» (así no se publica algo a medio escribir). */
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage, connectStorageEmulator, ref as sref, uploadBytes, getDownloadURL, listAll, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app, db, auth } from "./sesion.js?v=a5b75f75abc3";
import { limpiarHtml } from "./blog-html.js?v=a5b75f75abc3";
import { norm } from "./listamazo.js?v=a5b75f75abc3";

const st = getStorage(app);
if (typeof EMULADOR !== "undefined" && EMULADOR) connectStorageEmulator(st, EMULADOR.host, EMULADOR.storage);

const MARCADO = `
<div class="edBarra">
  <a class="volver" id="edVolver" href="blog.html">← Blog</a>
  <span class="edEstado" id="edEstado"></span>
  <span class="edGuardado" id="edGuardado" role="status" aria-live="polite"></span>
  <span class="edAcc"><button type="button" class="btn" id="edGuardar">Guardar borrador</button><button type="button" class="btn primario" id="edPublicar">Publicar</button></span>
</div>
<div class="edHoja">
  <div class="edPortada" id="edPortada">
    <img id="edPortadaImg" alt="" hidden>
    <span class="edPortadaAcc"><button type="button" class="btn chico" id="edPortadaBtn">Agregar imagen de portada</button><button type="button" class="btn chico" id="edPortadaQuitar" hidden>Quitar portada</button></span>
  </div>
  <textarea id="edTitulo" class="edTitulo" rows="1" maxlength="140" placeholder="Título del artículo" aria-label="Título"></textarea>
  <textarea id="edResumen" class="edResumen" rows="2" maxlength="300" placeholder="Resumen: una o dos frases que se ven en la lista y al compartir el enlace" aria-label="Resumen"></textarea>
  <div class="edHerr" role="toolbar" aria-label="Formato del texto">
    <select id="edBloque" aria-label="Tipo de texto"><option value="p">Texto</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="blockquote">Cita</option></select>
    <button type="button" data-cmd="bold" aria-label="Negrita" title="Negrita (Ctrl+B)"><b>N</b></button>
    <button type="button" data-cmd="italic" aria-label="Cursiva" title="Cursiva (Ctrl+I)"><i>C</i></button>
    <button type="button" data-cmd="insertUnorderedList" title="Lista">• Lista</button>
    <button type="button" data-cmd="insertOrderedList" title="Lista numerada">1. Lista</button>
    <button type="button" data-cmd="enlace" title="Enlace (selecciona el texto primero)">Enlace</button>
    <button type="button" data-cmd="imagen" title="Imagen (también puedes pegarla o arrastrarla)">Imagen</button>
    <button type="button" data-cmd="carta" title="Una carta, buscándola por su nombre">Carta</button>
    <button type="button" data-cmd="insertHorizontalRule" title="Línea separadora">Línea</button>
    <button type="button" data-cmd="tabla" title="Una cuadrícula de celdas, como en Excel, para ordenar texto, imágenes y cartas">Cuadrícula</button>
    <span class="edCtx" id="edTablaAcc" hidden><span class="edCtxT">Cuadrícula</span><button type="button" data-tab="fila">+ Fila</button><button type="button" data-tab="col">+ Columna</button><button type="button" data-tab="-fila">− Fila</button><button type="button" data-tab="-col">− Columna</button><button type="button" data-tab="quitar">Quitar cuadrícula</button></span>
    <span class="edCtx" id="edTamAcc" hidden><span class="edCtxT">Tamaño</span><button type="button" data-tam="chica">Chica</button><button type="button" data-tam="mediana">Mediana</button><button type="button" data-tam="grande">Grande</button><button type="button" data-tam="completa">Completa</button><button type="button" data-tam="quitar">Quitar</button></span>
  </div>
  <div class="cuerpo edCuerpo" id="edCuerpo" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto del artículo"></div>
  <div class="edPie"><button type="button" class="btn chico" id="edDespublicar" hidden>Volver a borrador</button><button type="button" class="btn chico peligro" id="edBorrar" hidden>Borrar artículo</button></div>
</div>
<input type="file" id="edArchivo" accept="image/*" hidden>
<dialog id="edTablaDlg" class="edDialog" aria-labelledby="edTablaTit">
  <h2 id="edTablaTit">Insertar una cuadrícula</h2>
  <div class="edTablaCampos"><label>Filas <input id="edFilas" type="number" min="1" max="30" value="2"></label><label>Columnas <input id="edCols" type="number" min="1" max="6" value="3"></label></div>
  <p class="edAyuda">Cada celda es como un pedacito de texto: escribe, o pon una imagen o una carta. Con Tab pasas a la celda siguiente (en la última, Tab agrega una fila).</p>
  <form method="dialog" class="edDlgAcc"><button class="btn" value="no">Cancelar</button><button class="btn primario" value="si">Insertar</button></form>
</dialog>
<dialog id="edCartas" class="edDialog" aria-labelledby="edCartasTit">
  <h2 id="edCartasTit">Insertar una carta</h2>
  <input id="edCartaQ" type="search" autocomplete="off" placeholder="Cualquier carta, en español o inglés: «Charizard ex», «Caramelo raro»" aria-label="Buscar una carta">
  <ul id="edCartaRes" class="edCartaRes"></ul>
  <form method="dialog"><button class="btn">Cerrar</button></form>
</dialog>`;

const $ = id => document.getElementById(id);
const azar = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const slug = t => norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "articulo";
const hora = ms => new Date(ms).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

export async function abrirEditor({ caja, id }){
  caja.innerHTML = MARCADO;
  const cuerpo = $("edCuerpo"), titulo = $("edTitulo"), resumen = $("edResumen");
  let ID = id, A = { carpeta: azar(10), estado: "borrador" }, sucio = false, guardando = false, auto = null, NOMBRE = "";
  const LOCAL = () => "blog-ed-" + (ID || "nuevo");
  const estado = t => $("edGuardado").textContent = t;
  try { NOMBRE = (await get(ref(db, "usuarios/" + auth.currentUser.uid + "/nombre"))).val() || ""; } catch(e){ /* sin nombre: el artículo va sin autor */ }

  if (ID){
    try { A = (await get(ref(db, "blog/articulos/" + ID))).val(); } catch(e){ A = null; }
    if (!A){ caja.innerHTML = '<p class="bajada">No encontramos ese artículo. <a href="blog.html">Volver al blog</a></p>'; return; }
  }
  titulo.value = A.titulo || ""; resumen.value = A.resumen || ""; cuerpo.innerHTML = limpiarHtml(A.cuerpo || "");
  /* la copia de este navegador, si es más nueva que lo guardado */
  try {
    const l = JSON.parse(localStorage.getItem(LOCAL()) || "null");
    if (l && l.t > (A.actualizado || 0) && (l.titulo !== titulo.value || l.cuerpo !== cuerpo.innerHTML || l.resumen !== resumen.value) &&
        confirm("Hay cambios de este artículo que no alcanzaron a guardarse (" + new Date(l.t).toLocaleString("es-CL") + "). ¿Recuperarlos?")){
      titulo.value = l.titulo || ""; resumen.value = l.resumen || ""; cuerpo.innerHTML = limpiarHtml(l.cuerpo || "");
      if (!ID && l.carpeta) A.carpeta = l.carpeta;
      if (l.portada !== undefined) A.portada = l.portada;
      sucio = true;
    }
  } catch(e){ /* sin almacenamiento */ }
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch(e){ /* navegador viejo: usa div, y limpiarHtml lo pasa a p */ }
  if (!cuerpo.innerHTML.trim()) cuerpo.innerHTML = "<p><br></p>";

  function pintar(){
    const pub = A.estado === "publicado";
    $("edEstado").textContent = pub ? "Publicado" : "Borrador";
    $("edEstado").classList.toggle("pub", pub);
    $("edGuardar").hidden = pub;
    $("edPublicar").textContent = pub ? "Guardar cambios" : "Publicar";
    $("edDespublicar").hidden = !pub;
    $("edBorrar").hidden = !ID;
    $("edVolver").href = ID && pub ? "blog.html?a=" + ID : "blog.html";
    $("edPortadaImg").hidden = !A.portada; if (A.portada) $("edPortadaImg").src = A.portada.img;
    $("edPortadaQuitar").hidden = !A.portada;
    $("edPortadaBtn").textContent = A.portada ? "Cambiar portada" : "Agregar imagen de portada";
    alto(titulo); alto(resumen);
  }
  const alto = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };

  /* --- cambios: copia local al tiro; el borrador se guarda solo en la base a los 4 s sin escribir */
  let copia = null;
  function cambio(){
    sucio = true; estado("Cambios sin guardar");
    clearTimeout(copia); copia = setTimeout(() => {
      try { localStorage.setItem(LOCAL(), JSON.stringify({ titulo: titulo.value, resumen: resumen.value, cuerpo: cuerpo.innerHTML, portada: A.portada ?? null, carpeta: A.carpeta, t: Date.now() })); }
      catch(e){ /* sin almacenamiento */ }
    }, 400);
    clearTimeout(auto);
    if (A.estado !== "publicado") auto = setTimeout(() => { if (titulo.value.trim()) guardar("borrador", true); }, 4000);
  }
  titulo.addEventListener("input", () => { alto(titulo); cambio(); });
  resumen.addEventListener("input", () => { alto(resumen); cambio(); });
  cuerpo.addEventListener("input", cambio);
  addEventListener("beforeunload", e => { if (sucio) e.preventDefault(); });

  /* --- guardar */
  async function idLibre(base){
    for (let i = 1; i < 50; i++){
      const c = i === 1 ? base : base + "-" + i;
      if (!(await get(ref(db, "blog/articulos/" + c))).exists()) return c;
    }
    return base + "-" + azar(4);
  }
  async function guardar(nuevoEstado = A.estado, solo = false){
    if (guardando) return false;
    const t = titulo.value.trim();
    if (!t){ if (!solo){ estado("Ponle un título antes de guardar."); titulo.focus(); } return false; }
    guardando = true; clearTimeout(auto);
    if (!solo) estado("Guardando…");
    try {
      const html = limpiarHtml(cuerpo.innerHTML), ahora = Date.now(), r = resumen.value.trim();
      const viejoLocal = LOCAL();
      if (!ID) ID = await idLibre(slug(t));
      const datos = { titulo: t, cuerpo: html, estado: nuevoEstado, carpeta: A.carpeta, creado: A.creado || ahora, actualizado: ahora,
        ...(r ? { resumen: r } : {}), ...(A.portada ? { portada: A.portada } : {}), ...(A.autor || NOMBRE ? { autor: (A.autor || NOMBRE).slice(0, 80) } : {}),
        ...(nuevoEstado === "publicado" || A.publicado ? { publicado: A.publicado || ahora } : {}) };
      await update(ref(db), {
        ["blog/articulos/" + ID]: datos,
        ["blog/lista/" + ID]: nuevoEstado === "publicado" ? { titulo: t, publicado: datos.publicado, ...(r ? { resumen: r } : {}), ...(A.portada ? { min: A.portada.min } : {}) } : null,
      });
      A = datos; sucio = false;
      try { localStorage.removeItem(viejoLocal); localStorage.removeItem(LOCAL()); } catch(e){ /* sin almacenamiento */ }
      history.replaceState(null, "", "blog.html?editar=" + ID);
      estado("Guardado a las " + hora(ahora));
      pintar();
      limpiarHuerfanas();
      return true;
    } catch(e){
      console.warn("Blog: no se pudo guardar", e);
      estado(/permission/i.test(e.code || e.message || "") ? "No se pudo guardar: tu cuenta no tiene permiso." : "No se pudo guardar. Revisa la conexión y vuelve a intentar.");
      return false;
    } finally { guardando = false; }
  }
  /* las fotos de la carpeta que ya no están en el texto ni en la portada */
  async function limpiarHuerfanas(){
    try {
      const usado = A.cuerpo + JSON.stringify(A.portada || {}), l = await listAll(sref(st, "blog/" + A.carpeta));
      await Promise.all(l.items.filter(it => !usado.includes(A.carpeta + "%2F" + it.name)).map(it => deleteObject(it)));
    } catch(e){ console.warn("Blog: no se pudieron revisar las fotos sin usar", e); }
  }
  $("edGuardar").onclick = () => guardar("borrador");
  $("edPublicar").onclick = async () => {
    const era = A.estado === "publicado";
    if (!era && !confirm("¿Publicar «" + (titulo.value.trim() || "sin título") + "»? Lo va a ver cualquiera que entre al blog.")) return;
    if (await guardar("publicado") && !era) location.href = "blog.html?a=" + ID;
  };
  $("edDespublicar").onclick = async () => {
    if (confirm("¿Volver a borrador? El artículo deja de verse en el blog hasta que lo publiques de nuevo.")) await guardar("borrador");
  };
  $("edBorrar").onclick = async () => {
    if (!confirm("¿Borrar «" + (A.titulo || "este artículo") + "» y sus imágenes? No se puede deshacer.")) return;
    try {
      await update(ref(db), { ["blog/articulos/" + ID]: null, ["blog/lista/" + ID]: null });
      try { const l = await listAll(sref(st, "blog/" + A.carpeta)); await Promise.all(l.items.map(it => deleteObject(it))); } catch(e){ console.warn("Blog: quedaron fotos sin borrar", e); }
      try { localStorage.removeItem(LOCAL()); } catch(e){ /* sin almacenamiento */ }
      sucio = false; location.href = "blog.html";
    } catch(e){ estado("No se pudo borrar. Revisa la conexión."); }
  };

  /* --- imágenes: achicar en el navegador y subir */
  async function achicar(file, ancho, calidad){
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, ancho / bmp.width), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext("2d"); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    let b = await new Promise(r => c.toBlob(r, "image/webp", calidad));
    if (!b || b.type !== "image/webp"){   // Safari no sabe hacer WebP: JPG con fondo blanco
      g.globalCompositeOperation = "destination-over"; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      b = await new Promise(r => c.toBlob(r, "image/jpeg", calidad));
    }
    return { b, w: c.width, h: c.height };
  }
  async function subir(file, conMin){
    if (!file || !/^image\//.test(file.type)) throw Error("Ese archivo no es una imagen.");
    if (file.size > 30e6) throw Error("La imagen pesa más de 30 MB: elige una más liviana.");
    let g; try { g = await achicar(file, 1600, .82); } catch(e){ throw Error("No se pudo abrir esa imagen (¿formato HEIC del iPhone? Compártela como JPG)."); }
    if (g.b.size > 450e3) g = await achicar(file, 1200, .7);
    if (g.b.size > 590e3) throw Error("No se pudo achicar lo suficiente.");
    const n = Date.now().toString(36) + azar(4);
    const poner = async (nombre, x) => {
      const r = sref(st, "blog/" + A.carpeta + "/" + nombre + (x.b.type === "image/webp" ? ".webp" : ".jpg"));
      await uploadBytes(r, x.b, { contentType: x.b.type, cacheControl: "public,max-age=31536000,immutable" });
      return getDownloadURL(r);
    };
    const img = await poner(n, g), min = conMin ? await poner(n + "-min", await achicar(file, 640, .75)) : null;
    return { img, min, w: g.w, h: g.h, kb: Math.round(g.b.size / 1024) };
  }

  /* --- la selección: los botones y los diálogos la pierden, así que se guarda y se repone */
  let rango = null;
  document.addEventListener("selectionchange", () => {
    const s = getSelection();
    if (s.rangeCount && cuerpo.contains(s.anchorNode)){ rango = s.getRangeAt(0).cloneRange(); marcarBloque(); $("edTablaAcc").hidden = !celda(); }
  });
  const reponer = () => { cuerpo.focus(); if (rango){ const s = getSelection(); s.removeAllRanges(); s.addRange(rango); } };
  const insertar = html => { reponer(); document.execCommand("insertHTML", false, html); cambio(); };
  function marcarBloque(){
    let n = getSelection().anchorNode; while (n && n !== cuerpo && !/^(P|H2|H3|BLOCKQUOTE)$/.test(n.nodeName)) n = n.parentNode;
    $("edBloque").value = n && n !== cuerpo ? n.nodeName.toLowerCase() : "p";
  }

  async function ponerImagen(file){
    estado("Achicando y subiendo la imagen…");
    try {
      const f = await subir(file, false);
      const pie = (prompt("Describe la imagen en pocas palabras (va como pie de foto y para quien no puede verla). Puedes dejarlo vacío:", "") || "").trim().slice(0, 200);
      insertar('<figure><img src="' + esc(f.img) + '" alt="' + esc(pie) + '" width="' + f.w + '" height="' + f.h + '">' + (pie ? "<figcaption>" + esc(pie) + "</figcaption>" : "") + "</figure><p><br></p>");
      estado("Imagen subida (" + f.kb + " KB)");
    } catch(e){ console.warn("Blog: imagen", e); estado(e.message && !/storage\//.test(e.code || "") ? e.message : "No se pudo subir la imagen. Revisa la conexión."); }
  }
  let paraPortada = false;
  $("edArchivo").onchange = async () => {
    const file = $("edArchivo").files[0]; $("edArchivo").value = "";
    if (!file) return;
    if (!paraPortada) return ponerImagen(file);
    estado("Achicando y subiendo la portada…");
    try { const f = await subir(file, true); A.portada = { img: f.img, min: f.min }; pintar(); cambio(); estado("Portada lista (" + f.kb + " KB)"); }
    catch(e){ console.warn("Blog: portada", e); estado(e.message || "No se pudo subir la portada."); }
  };
  $("edPortadaBtn").onclick = () => { paraPortada = true; $("edArchivo").click(); };
  $("edPortadaQuitar").onclick = () => { delete A.portada; pintar(); cambio(); };
  /* pegar: lo de Word/Docs, limpio; una imagen copiada, se sube */
  cuerpo.addEventListener("paste", e => {
    const d = e.clipboardData; if (!d) return;
    const img = [...d.files].find(f => /^image\//.test(f.type));
    e.preventDefault();
    if (img) return ponerImagen(img);
    const h = d.getData("text/html");
    if (h) document.execCommand("insertHTML", false, limpiarHtml(h)); else document.execCommand("insertText", false, d.getData("text/plain"));
    cambio();
  });
  cuerpo.addEventListener("drop", e => {
    const img = [...(e.dataTransfer?.files || [])].find(f => /^image\//.test(f.type));
    if (!img) return;
    e.preventDefault();
    const p = document.caretRangeFromPoint?.(e.clientX, e.clientY); if (p) rango = p;
    ponerImagen(img);
  });

  /* --- cuadrículas (tablas): cada celda acepta texto, imágenes y cartas. La barra «Cuadrícula» aparece con el cursor en una celda. */
  function celda(){
    const s = getSelection();
    let n = s.rangeCount && cuerpo.contains(s.anchorNode) ? s.anchorNode : rango && rango.startContainer;
    while (n && n !== cuerpo && !/^T[DH]$/.test(n.nodeName)) n = n.parentNode;
    return n && n !== cuerpo && cuerpo.contains(n) ? n : null;
  }
  const celdaNueva = () => { const td = document.createElement("td"); td.innerHTML = "<br>"; return td; };
  const irA = c => { const r = document.createRange(); r.selectNodeContents(c); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); rango = r.cloneRange(); };
  function opTabla(v){
    const c = celda(); if (!c) return;
    const tr = c.parentNode, t = c.closest("table"), i = c.cellIndex;
    if (v === "fila"){ const n = document.createElement("tr"); for (let k = 0; k < tr.cells.length; k++) n.append(celdaNueva()); tr.after(n); irA(n.cells[Math.min(i, n.cells.length - 1)]); }
    if (v === "col"){ if (tr.cells.length >= 6){ estado("Una cuadrícula tiene como máximo 6 columnas."); return; } [...t.rows].forEach(r => r.insertBefore(celdaNueva(), r.cells[i + 1] || null)); }
    if (v === "-fila"){ if (t.rows.length > 1) tr.remove(); else t.remove(); }
    if (v === "-col"){ if (tr.cells.length > 1) [...t.rows].forEach(r => r.cells[i] && r.cells[i].remove()); else t.remove(); }
    if (v === "quitar"){ if (!confirm("¿Quitar la cuadrícula completa, con todo lo que tiene adentro?")) return; t.remove(); }
    $("edTablaAcc").hidden = !celda(); cambio();
  }
  $("edTablaDlg").addEventListener("close", () => {
    if ($("edTablaDlg").returnValue !== "si") return;
    const f = Math.min(30, Math.max(1, Math.round(+$("edFilas").value) || 2)), k = Math.min(6, Math.max(1, Math.round(+$("edCols").value) || 3));
    insertar("<table><tbody>" + ("<tr>" + "<td><br></td>".repeat(k) + "</tr>").repeat(f) + "</tbody></table><p><br></p>");
  });
  cuerpo.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const c = celda(); if (!c) return;
    e.preventDefault();
    const cs = [...c.closest("table").querySelectorAll("td,th")], i = cs.indexOf(c);
    const sig = cs[i + (e.shiftKey ? -1 : 1)];
    if (!sig && !e.shiftKey){ opTabla("fila"); return; }
    if (sig) irA(sig);
  });

  /* --- tamaño de imágenes y cartas: se toca la imagen y aparece la barra «Tamaño» (va como clase de la figura, que limpiarHtml deja pasar) */
  const TAMS = ["chica", "mediana", "grande", "completa"];
  let FIG = null;
  const tamDe = f => TAMS.find(t => f.classList.contains(t)) || (f.classList.contains("carta") ? "mediana" : "completa");
  function elegirFig(f){
    if (FIG) FIG.classList.remove("sel");
    FIG = f; if (FIG) FIG.classList.add("sel");
    $("edTamAcc").hidden = !FIG;
    if (FIG) $("edTamAcc").querySelectorAll("[data-tam]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tam === tamDe(FIG))));
  }
  cuerpo.addEventListener("click", e => { const f = e.target.nodeName === "IMG" && e.target.closest("figure"); elegirFig(f && cuerpo.contains(f) ? f : null); });
  function opTam(v){
    if (!FIG || !cuerpo.contains(FIG)){ elegirFig(null); return; }
    if (v === "quitar"){ FIG.remove(); elegirFig(null); cambio(); return; }
    TAMS.forEach(t => FIG.classList.remove(t));
    if (v !== (FIG.classList.contains("carta") ? "mediana" : "completa")) FIG.classList.add(v);   // el tamaño de siempre no lleva clase
    elegirFig(FIG); cambio();
  }

  /* --- la barra */
  const barra = caja.querySelector(".edHerr");
  barra.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });   // que el botón no le quite la selección al texto
  barra.addEventListener("click", e => {
    /* el cursor de ahora (no el del último selectionchange, que llega tarde): ahí va lo que se inserte desde un diálogo */
    const s = getSelection(); if (s.rangeCount && cuerpo.contains(s.anchorNode)) rango = s.getRangeAt(0).cloneRange();
    const t = e.target.closest("[data-tab],[data-tam]");
    if (t){ if (t.dataset.tab) opTabla(t.dataset.tab); else opTam(t.dataset.tam); return; }
    const b = e.target.closest("[data-cmd]"); if (!b) return;
    const c = b.dataset.cmd;
    if (c === "tabla"){ if (celda()){ estado("No se puede poner una cuadrícula dentro de otra."); return; } $("edTablaDlg").showModal(); return; }
    if (c === "imagen"){ paraPortada = false; $("edArchivo").click(); return; }
    if (c === "carta"){ abrirCartas(); return; }
    if (c === "enlace"){
      const u = (prompt("Dirección del enlace (https://…):", "https://") || "").trim();
      if (!/^https?:\/\/\S+$/i.test(u)) return;
      reponer();
      if (getSelection().isCollapsed) document.execCommand("insertHTML", false, '<a href="' + esc(u) + '">' + esc(u) + "</a>");
      else document.execCommand("createLink", false, u);
      cambio(); return;
    }
    reponer(); document.execCommand(c); cambio();
  });
  $("edBloque").onchange = () => { reponer(); document.execCommand("formatBlock", false, "<" + $("edBloque").value + ">"); cambio(); };

  /* --- cartas: cualquier carta de cualquier época, buscada en TCGdex (api.tcgdex.net) en español y en inglés a la vez.
     Se muestran las más nuevas primero (el orden de las expansiones de TCGdex es cronológico) con su expansión y número; la
     imagen va en español si TCGdex la tiene y si no en inglés (no se guarda nada nuestro: el navegador la pide a TCGdex). */
  const API = "https://api.tcgdex.net/v2/";
  const pedir = (ruta, senal) => fetch(API + ruta, { signal: senal }).then(r => r.ok ? r.json() : []);
  let SETS = null, busca = null, pausa = null, RES = [];
  const cargarSets = () => SETS ??= Promise.all(["es", "en"].map(l => pedir(l + "/sets").catch(() => []))).then(([es, en]) => {
    const m = new Map();
    en.forEach((s, i) => m.set(s.id, { orden: i, nombre: s.name }));
    es.forEach(s => { const x = m.get(s.id); if (x) x.nombre = s.name; else m.set(s.id, { orden: -1, nombre: s.name }); });
    return m;
  });
  const setDe = id => id.slice(0, id.lastIndexOf("-"));
  /* ¿Existe la foto en español? Se prueba cargándola (la imagen no necesita permisos de otro sitio para eso). */
  const existe = url => new Promise(ok => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = url; });
  async function abrirCartas(){
    $("edCartas").showModal(); $("edCartaQ").value = ""; $("edCartaRes").innerHTML = ""; $("edCartaQ").focus();
    cargarSets();
  }
  async function buscarCartas(q){
    busca?.abort(); busca = new AbortController();
    const s = busca.signal, nombre = encodeURIComponent(q);
    $("edCartaRes").innerHTML = "<li>Buscando…</li>";
    let es, en, sets;
    try { [es, en, sets] = await Promise.all([pedir("es/cards?name=" + nombre, s), pedir("en/cards?name=" + nombre, s), cargarSets()]); }
    catch(e){ if (e.name !== "AbortError") $("edCartaRes").innerHTML = "<li>No se pudo buscar en TCGdex. Revisa la conexión.</li>"; return; }
    const porId = new Map();
    for (const c of en) if (c.image) porId.set(c.id, { id: c.id, num: c.localId, nombre: c.name, en: c.image });
    for (const c of es){ const x = porId.get(c.id) || { id: c.id, num: c.localId, en: null }; x.nombre = c.name; if (c.image) x.es = c.image; if (x.es || x.en) porId.set(c.id, x); }
    const orden = c => (sets.get(setDe(c.id)) || { orden: -1 }).orden;
    RES = [...porId.values()].sort((a, b) => orden(b) - orden(a) || String(a.num).localeCompare(String(b.num), "es", { numeric: true }));
    const total = RES.length; RES = RES.slice(0, 48);
    $("edCartaRes").innerHTML = RES.map((c, i) => '<li><button type="button" data-i="' + i + '"><img src="' + esc((c.es || c.en) + "/low.webp") + '" alt="" loading="lazy">' +
      "<span>" + esc(c.nombre) + "<small>" + esc(((sets.get(setDe(c.id)) || {}).nombre || setDe(c.id)) + " · " + c.num) + "</small></span></button></li>").join("") ||
      "<li>No encontramos esa carta. Prueba con el nombre en inglés, o solo una parte («charizard»).</li>";
    if (total > RES.length) $("edCartaRes").insertAdjacentHTML("beforeend", '<li class="mas">Hay ' + total + " resultados: escribe más para afinar (por ejemplo «charizard ex»).</li>");
  }
  $("edCartaQ").oninput = () => {
    clearTimeout(pausa);
    const q = $("edCartaQ").value.trim();
    if (q.length < 2){ busca?.abort(); $("edCartaRes").innerHTML = ""; return; }
    pausa = setTimeout(() => buscarCartas(q), 350);
  };
  $("edCartaRes").onclick = async e => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    const c = RES[+b.dataset.i], sets = await cargarSets();
    /* en español si la foto existe (una carta buscada en inglés puede tenerla igual) */
    const esUrl = (c.es || (c.en || "").replace("/en/", "/es/")) + "/high.webp";
    const img = (await existe(esUrl)) ? esUrl : (c.en || c.es) + "/high.webp";
    const cap = c.nombre + " · " + ((sets.get(setDe(c.id)) || {}).nombre || setDe(c.id)) + " " + c.num;
    $("edCartas").close();
    insertar('<figure class="carta"><img src="' + esc(img) + '" alt="' + esc(c.nombre) + '" width="600" height="825"><figcaption>' + esc(cap) + "</figcaption></figure><p><br></p>");
  };

  pintar();
  if (sucio) estado("Cambios recuperados, sin guardar");
  else if (A.actualizado) estado("Guardado el " + new Date(A.actualizado).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
  (titulo.value ? cuerpo : titulo).focus();
}
