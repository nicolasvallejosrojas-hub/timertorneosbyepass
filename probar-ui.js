/* ============================================================
   probar-ui.js — piezas de interfaz que comparten Probar mazo y Comparar (formato de números, ayuda plegable,
   barras y columnas, lo que se recuerda en el navegador). esc() es la global de config.js.
   ============================================================ */
export const pct = (p, d = 0) => (p * 100).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
export const dif = (p, d = 1) => (p >= 0 ? "+" : "−") + Math.abs(p * 100).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
export const num = (x, d = 1) => x.toLocaleString("es-CL", { maximumFractionDigits: d });
export const TURNO = t => t === 0 ? "en la mano" : "al turno " + t;
export const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? def; } catch(e){ return def; } };
export const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ /* sin almacenamiento: no pasa nada */ } };
/* «¿Cómo se lee?»: explicación plegable bajo cada número o gráfico. */
export const ayuda = (html, titulo = "¿Cómo se lee?") => '<details class="ayuda"><summary>' + titulo + "</summary><div>" + html + "</div></details>";
/* Barras horizontales (etiqueta, barra, valor) y columnas (para comparar varias cantidades). */
export const barras = (filas, fuerte = -1) => '<div class="dist" role="list">' + filas.map(([t, p], k) =>
  '<div class="fd' + (k === fuerte ? " fuerte" : "") + '" role="listitem"><span>' + t + '</span><span class="bar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></span><span class="val">' + pct(p, 1) + "</span></div>").join("") + "</div>";
export const columnas = (cols, marcada, etiqueta) => '<div class="cols" role="list" aria-label="' + etiqueta + '">' + cols.map(([t, p]) =>
  '<div class="col' + (t === marcada ? " marcada" : "") + '" role="listitem"><span class="cv">' + pct(p, 0) + '</span><span class="cb"><i style="height:' + Math.max(2, p * 100).toFixed(1) + '%"></i></span><span class="ct">' + t + "</span></div>").join("") + "</div>";
/* Las etiquetas de efectos de una carta (efectos.js etiquetas()) como chips de colores. */
export const chips = et => et.map(x => '<span class="e ' + x.c + '">' + esc(x.t) + "</span>").join("");
