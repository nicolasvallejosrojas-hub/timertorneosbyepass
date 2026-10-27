/* ▌ÍNDICE de csv.js (detalle y números de línea en MAPA-CODIGO.md, en la raíz del proyecto)
    1. Celdas de CSV
*/
/* ============================================================
   csv.js — una celda de CSV que Excel no confunde con una fórmula
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   Lo que escribe un jugador (nick, nombre, lista) acaba en el CSV de inscritos que el
   organizador abre en Excel. Una celda que empieza por = + - @ (o tabulación o retorno)
   se toma por fórmula y puede ejecutar algo: se le antepone una comilla simple para que
   sea texto. Las comillas se duplican y la celda va entre comillas.
   ============================================================ */

/* ▌BLOQUE 1 · Celdas de CSV ═════════════════════════════════════════════════════
   Una celda de CSV entre comillas; si empieza por = + - @ se le antepone una comilla simple para
   que Excel no la ejecute como fórmula. */
export const celdaCsv = v => {
  const t = String(v ?? "");
  return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"';
};
