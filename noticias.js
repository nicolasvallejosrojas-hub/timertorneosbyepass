/* Noticias de Pokémon TCG en la portada y en el muro. Las lee de la base (las deja functions/noticias.mjs cada hora desde el
   RSS de PokéBeach) y muestra las últimas, en español o en el original en inglés, a elección de cada persona.
   Si el archivo no está o viene vacío, la sección no aparece. */
(() => {
  const caja = document.getElementById('noticias');
  if (!caja) return;
  const lista = document.getElementById('noticiasLista');
  const mas = document.getElementById('noticiasMas');
  const nota = document.getElementById('noticiasNota');
  const botones = [...caja.querySelectorAll('[data-lengua]')];
  const CLAVE = 'bp-noticias-lengua', POCAS = +caja.dataset.pocas || (matchMedia('(max-width:560px)').matches ? 3 : 6);   // el muro muestra 3
  let lengua = 'es', todas = false, datos = null;
  try { lengua = localStorage.getItem(CLAVE) === 'en' ? 'en' : 'es'; } catch { /* sin almacenamiento */ }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtDia = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });
  function cuando(iso){
    const t = Date.parse(iso); if (!t) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 60) return min <= 1 ? 'Recién' : `Hace ${min} min`;
    if (min < 24 * 60) return `Hace ${Math.round(min / 60)} h`;
    if (min < 48 * 60) return 'Ayer';
    return fmtDia.format(t);
  }

  /* Un hilo viejo que PokéBeach volvió a subir (lo marca functions/noticias.mjs): «Actualizada hace 2 h», no «Hace 2 h». */
  const actualizada = c => 'Actualizada ' + (/^\d/.test(c) ? 'el ' + c : c.charAt(0).toLowerCase() + c.slice(1));

  function pintar(){
    const ns = datos.noticias.slice(0, todas ? datos.noticias.length : POCAS);
    const hayEs = datos.noticias.some(n => n.es);
    botones.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lengua === lengua)));
    caja.querySelector('.noticias-lengua').hidden = !hayEs;
    lista.innerHTML = ns.map(n => {
      const en = lengua === 'en' || !n.es, t = en ? n.en : n.es;
      return '<li><a class="noticia" href="' + esc(n.url) + '" target="_blank" rel="noopener">' +
        '<span class="noticia-meta"><time datetime="' + esc(n.fecha) + '">' + esc(n.actualizada ? actualizada(cuando(n.fecha)) : cuando(n.fecha)) + '</time>' +
        (lengua === 'es' && !n.es ? '<span class="noticia-sin">Solo en inglés</span>' : '') + '</span>' +
        '<b' + (en ? ' lang="en"' : '') + '>' + esc(t.titulo) + '</b>' +
        (t.resumen ? '<span class="noticia-resumen"' + (en ? ' lang="en"' : '') + '>' + esc(t.resumen) + '</span>' : '') +
        '<span class="noticia-ir">Leer en PokéBeach <span aria-hidden="true">↗</span><span class="sr">(se abre en otra pestaña)</span></span></a></li>';
    }).join('');
    mas.hidden = todas || datos.noticias.length <= POCAS;
    nota.textContent = lengua === 'es' && hayEs
      ? 'Traducción automática hecha por ByePass, no oficial. Ante cualquier duda, vale el texto original.'
      : 'Noticias en su idioma original.';
  }

  botones.forEach(b => b.addEventListener('click', () => {
    lengua = b.dataset.lengua;
    try { localStorage.setItem(CLAVE, lengua); } catch { /* sin almacenamiento */ }
    pintar();
  }));
  mas.addEventListener('click', () => { todas = true; pintar(); lista.querySelectorAll('a')[POCAS]?.focus(); });

  /* Las deja la función programada «noticias» en la base (noticias/, de lectura pública): se leen por REST, sin el SDK. */
  const emu = typeof EMULADOR !== 'undefined' && EMULADOR;
  const url = emu ? 'http://' + emu.host + ':' + emu.db + '/noticias.json?ns=' + new URL(FIREBASE_CONFIG.databaseURL).hostname.split('.')[0]
                  : FIREBASE_CONFIG.databaseURL + '/noticias.json';
  fetch(url, { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d && d.noticias && !Array.isArray(d.noticias)) d.noticias = Object.values(d.noticias);
      if (!d || !Array.isArray(d.noticias) || !d.noticias.length) return;
      datos = d; pintar(); caja.classList.remove('oculto');
    })
    .catch(e => console.warn('Noticias no disponibles', e));
})();
