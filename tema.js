/* ▌ÍNDICE de tema.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Modo noche
*/
/* ▌BLOQUE 1 · Modo noche ════════════════════════════════════════════════════════
   Pone data-tema="noche" antes de pintar (lo elegido o el modo del sistema), cambiarTema(),
   temaNoche() y los íconos del botón. */
(function(){
  var raiz = document.documentElement, sistema = matchMedia("(prefers-color-scheme: dark)");
  var elegido = function(){ try { return localStorage.getItem("tema"); } catch(e){ return null; } };
  var poner = function(noche){
    if (noche) raiz.dataset.tema = "noche"; else delete raiz.dataset.tema;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m){ if (!m.dataset.dia) m.dataset.dia = m.content; m.content = noche ? "#0E1A18" : m.dataset.dia; }
    dispatchEvent(new Event("tema"));
  };
  poner((elegido() || (sistema.matches ? "noche" : "dia")) === "noche");
  if (sistema.addEventListener) sistema.addEventListener("change", function(e){ if (!elegido()) poner(e.matches); });
  window.temaNoche = function(){ return raiz.dataset.tema === "noche"; };
  /* íconos del botón (dibujados, del mismo trazo; no glifos de texto) */
  window.ICONO_SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  window.ICONO_LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  window.cambiarTema = function(){
    var noche = !window.temaNoche();
    try { localStorage.setItem("tema", noche ? "noche" : "dia"); } catch(e){}
    poner(noche);
    return noche;
  };
})();
