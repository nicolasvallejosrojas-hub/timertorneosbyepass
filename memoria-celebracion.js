// La celebración aparece después de recibir la confirmación de guardado del servidor.
export function montarCelebracion({ dialogo, tablero, estado, otra, ranking }) {
  const caja = document.createElement('section');
  caja.className = 'memoriaVictoria'; caja.hidden = true; caja.tabIndex = -1;
  caja.setAttribute('aria-label', 'Partida completada y guardada');
  caja.innerHTML = `<div class="memoriaConfeti" aria-hidden="true"></div><div class="memoriaMedalla" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M29 61 19 95l30-14 30 14-9-34" fill="#a78bfa"/><circle cx="50" cy="42" r="33" fill="#f9c95b"/><circle cx="50" cy="42" r="25" fill="none" stroke="#a86b16" stroke-width="2"/><path d="m50 22 6 13 15 2-11 10 3 15-13-7-13 7 3-15-11-10 15-2Z" fill="#704817"/></svg></div><p class="memoriaVictoriaEtiqueta"></p><p class="memoriaVictoriaTexto">¡Las seis parejas están contigo!</p><div class="memoriaPuntaje"><span class="memoriaPuntajeAccesible"></span><strong aria-hidden="true">0</strong><span aria-hidden="true">puntos</span></div><div class="memoriaMetricas"><p><strong data-intentos></strong><span>intentos</span></p><p><strong data-tiempo></strong><span>segundos</span></p><p><strong>6 / 6</strong><span>parejas</span></p></div><p class="memoriaGuardado">✓ Resultado guardado en tu cuenta</p><div class="memoriaVictoriaAcciones"><button type="button" data-otra>Jugar otra vez</button><button type="button" data-ranking>Ver mi ranking</button></div><button type="button" class="memoriaVerCartas" aria-expanded="false">Ver mis parejas</button>`;
  tablero.before(caja);
  const contador = caja.querySelector('.memoriaPuntaje strong'), ver = caja.querySelector('.memoriaVerCartas');
  const titulo = dialogo.querySelector('#esperaTitulo'), instrucciones = dialogo.querySelector('.esperaCab + p'), pie = dialogo.querySelector('.esperaPie');
  let frame = null, ultima = null;
  caja.querySelector('[data-otra]').onclick = otra;
  caja.querySelector('[data-ranking]').onclick = ranking;
  ver.onclick = () => { tablero.hidden = !tablero.hidden; ver.setAttribute('aria-expanded', String(!tablero.hidden)); ver.textContent = tablero.hidden ? 'Ver mis parejas' : 'Ocultar mis parejas'; };
  function limpiar() {
    cancelAnimationFrame(frame); frame = null; ultima = null; caja.hidden = true; caja.querySelector('.memoriaConfeti').replaceChildren();
    tablero.hidden = false; pie.hidden = false; instrucciones.hidden = false; estado.classList.remove('memoriaEstadoFinal'); titulo.textContent = 'Atrapa las parejas';
  }
  function mostrar(p) {
    if (ultima === p.id) return;
    ultima = p.id;
    titulo.textContent = '¡Parejas completas!'; instrucciones.hidden = true; pie.hidden = true; tablero.hidden = true; caja.hidden = false;
    estado.classList.add('memoriaEstadoFinal'); ver.setAttribute('aria-expanded', 'false'); ver.textContent = 'Ver mis parejas';
    const mejor = p.resumen?.mejor?.id === p.id;
    const puesto = (p.resumen?.ranking || []).findIndex(v => v.tu) + 1;
    caja.querySelector('.memoriaVictoriaEtiqueta').textContent = mejor ? (p.resumen.partidas === 1 ? 'TU PRIMERA MARCA' : 'NUEVA MEJOR MARCA') : puesto ? `TOP ${puesto} DEL RANKING` : 'PARTIDA COMPLETADA';
    caja.querySelector('[data-intentos]').textContent = p.intento;
    caja.querySelector('[data-tiempo]').textContent = p.duracion;
    caja.querySelector('.memoriaPuntajeAccesible').textContent = `${p.puntos} puntos`;
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    contador.textContent = p.puntos;
    if (!reducido) {
      const inicio = performance.now();
      const contar = ahora => { const t = Math.min(1, (ahora - inicio) / 650); contador.textContent = Math.round(p.puntos * (1 - (1-t)**3)); if (t < 1) frame = requestAnimationFrame(contar); };
      frame = requestAnimationFrame(contar);
      const confeti = caja.querySelector('.memoriaConfeti');
      for (let i=0; i<24; i++) { const pieza=document.createElement('i'); pieza.style.setProperty('--x', `${(i*37)%100}%`); pieza.style.setProperty('--giro', `${i*43}deg`); pieza.style.setProperty('--demora', `${(i%6)*65}ms`); pieza.style.setProperty('--color', ['#f9c95b','#ef836b','#89c7b2','#a78bfa'][i%4]); confeti.append(pieza); }
    }
    dialogo.scrollTop = 0; caja.focus({preventScroll:true});
  }
  return {mostrar, limpiar};
}
