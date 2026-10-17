/* ============================================================
   reloj-worker.js — el latido del reloj del panel
   ------------------------------------------------------------
   Versión actual: v=1   (subir el ?v= al tocar este archivo)

   Con la pestaña del panel oculta, el navegador frena los temporizadores de la
   página: uno por segundo y, pasados 5 minutos, uno por minuto. Con el reloj
   así, la alarma del cero sonaba tarde o no sonaba hasta volver a la pestaña.
   Un Worker no sufre ese freno: late cada 250 ms aunque la pestaña esté oculta
   o tapada, y el panel hace con cada latido lo mismo que antes hacía con su
   setInterval (admin.html, renderClock). Solo avisa «ahora»: la cuenta y el
   sonido siguen siendo del panel.
   ============================================================ */
setInterval(function(){ postMessage(0); }, 250);
