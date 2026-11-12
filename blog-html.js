/* blog-html.js — el HTML de un artículo del blog, limpio.
   El editor (blog-editor.js) guarda HTML y blog.html lo muestra: las dos pasan por limpiarHtml, que deja SOLO las etiquetas
   de un artículo (párrafos, títulos, negrita, listas, citas, enlaces, imágenes con su pie) y bota todo lo demás: scripts,
   estilos, atributos on…, iframes, y cualquier imagen que no venga de nuestro Storage o de TCGdex. Lo que se pega desde
   Word o Google Docs queda en texto con su formato básico. Se parsea en un <template> (inerte: no corre nada ni pide imágenes).
   Lo prueba pruebas/probar-blog-ui.mjs. */

const PERMITIDAS = {
  P: [], H2: [], H3: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [],
  A: ["href"], IMG: ["src", "alt", "width", "height"], FIGURE: ["class"], FIGCAPTION: [], BR: [], HR: [],
};
const FUERA = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "FORM", "INPUT",
  "BUTTON", "TEXTAREA", "SELECT", "LINK", "META", "TITLE", "HEAD", "VIDEO", "AUDIO", "CANVAS"]);
const A_PARRAFO = new Set(["DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "ASIDE", "MAIN"]);
const A_TITULO = { H1: "H2", H4: "H3", H5: "H3", H6: "H3" };

/* De dónde pueden venir las imágenes: nuestro Storage (las fotos subidas) y TCGdex (las cartas). Con el emulador, también
   el Storage local. */
export function origenImagen(src){
  return /^https:\/\/(firebasestorage\.googleapis\.com\/v0\/b\/timer-y-qrs-pokemon\.firebasestorage\.app\/o\/blog%2F|assets\.tcgdex\.net\/)/.test(src) ||
    (typeof EMULADOR !== "undefined" && !!EMULADOR && src.startsWith("http://" + EMULADOR.host + ":" + EMULADOR.storage + "/"));
}

export function limpiarHtml(html){
  const t = document.createElement("template");
  t.innerHTML = String(html || "");
  limpiar(t.content);
  /* sin párrafos vacíos al final (los deja el editor) */
  while (t.content.lastChild && /^(P|BR)$/.test(t.content.lastChild.nodeName) && !t.content.lastChild.textContent.trim() && !t.content.lastChild.querySelector?.("img"))
    t.content.lastChild.remove();
  return t.innerHTML;
}

function limpiar(nodo){
  for (let n of [...nodo.childNodes]){
    if (n.nodeType === 3) continue;                       // texto: queda tal cual (innerHTML lo escapa al serializar)
    if (n.nodeType !== 1){ n.remove(); continue; }        // comentarios y demás
    let tag = n.nodeName.toUpperCase();
    if (FUERA.has(tag)){ n.remove(); continue; }
    limpiar(n);
    /* lo pegado de Word / Google Docs: la negrita y la cursiva vienen en el estilo; Docs envuelve TODO en <b style="font-weight:normal"> */
    const est = (n.getAttribute("style") || "").toLowerCase();
    if ((tag === "B" || tag === "STRONG") && /font-weight:\s*(normal|400)/.test(est)){ n.replaceWith(...n.childNodes); continue; }
    const como = tag === "SPAN" && (/font-weight:\s*(bold|[6-9]00)/.test(est) ? "strong" : /font-style:\s*italic/.test(est) ? "em" : "");
    if (como){ const e = document.createElement(como); e.append(...n.childNodes); n.replaceWith(e); n = e; tag = como.toUpperCase(); }
    if (A_PARRAFO.has(tag) || A_TITULO[tag]){              // div → p, h1 → h2, h4 → h3 (un artículo tiene un solo h1: su título)
      const nuevo = document.createElement(A_PARRAFO.has(tag) ? "p" : A_TITULO[tag]);
      nuevo.append(...n.childNodes); n.replaceWith(nuevo); continue;
    }
    if (!PERMITIDAS[tag]){ n.replaceWith(...n.childNodes); continue; }   // span, font, etc.: se queda el texto
    for (const a of [...n.attributes]) if (!PERMITIDAS[tag].includes(a.name.toLowerCase())) n.removeAttribute(a.name);
    if (tag === "A"){
      const h = (n.getAttribute("href") || "").trim();
      if (!/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(h)) n.removeAttribute("href");
      else { n.setAttribute("target", "_blank"); n.setAttribute("rel", "noopener noreferrer"); }
    }
    if (tag === "IMG"){
      if (!origenImagen(n.getAttribute("src") || "")){ n.remove(); continue; }
      n.setAttribute("loading", "lazy"); n.setAttribute("decoding", "async");
      if (!n.hasAttribute("alt")) n.setAttribute("alt", "");
    }
    if (tag === "FIGURE" && n.getAttribute("class") !== "carta") n.removeAttribute("class");
  }
}
