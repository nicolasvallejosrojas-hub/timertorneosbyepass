/* Comportamientos visuales compartidos. Sin lecturas ni escrituras en Firebase. */
(() => {
  const header = document.querySelector('header.sup, header.barra .dentro, .bp-app-header, .bp-editor-header');
  if (header && typeof window.cambiarTema === 'function' && !header.querySelector('#tema, #themeToggle, [data-bp-theme]')) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'bp-theme'; button.dataset.bpTheme = '';
    const refresh = () => {
      button.innerHTML = window.temaNoche() ? window.ICONO_SOL : window.ICONO_LUNA;
      const label = window.temaNoche() ? 'Activar tema claro' : 'Activar tema oscuro';
      button.setAttribute('aria-label', label); button.title = label;
    };
    button.addEventListener('click', () => { window.cambiarTema(); refresh(); });
    window.addEventListener('tema', refresh); refresh(); header.appendChild(button);
  }
  document.querySelectorAll('header a[href]').forEach(link => {
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && !url.hash)
      link.setAttribute('aria-current', 'page');
  });
  const main = document.querySelector('main');
  if (main && !document.querySelector('.skip,.bp-skip')) {
    if (!main.id) main.id = 'contenido';
    const skip = document.createElement('a'); skip.className = 'bp-skip';
    skip.href = '#' + main.id; skip.textContent = 'Saltar al contenido';
    skip.addEventListener('click', event => {
      // Cuenta y muro usan el hash como ruta: saltar no debe cambiar esa ruta.
      event.preventDefault(); main.tabIndex = -1;
      main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    document.body.prepend(skip);
  }
})();
