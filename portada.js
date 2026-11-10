/* Interacciones de presentación; la autenticación permanece en portada-auth.js. */
(() => {
  const dialog = document.getElementById('authDialog');
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  let opener;
  function select(mode, focus = false) {
    const register = mode === 'registro';
    document.getElementById('authTitle').textContent = register ? 'Tu comunidad te espera.' : 'Qué bueno verte de nuevo.';
    document.getElementById('authIntro').textContent = register ? 'Crea tu cuenta gratis y empieza a guardar tus partidas.' : 'Entra para seguir tus torneos y conectar con tu tienda.';
    tabs.forEach(tab => {
      const selected = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('panelIngreso').hidden = register;
    document.getElementById('panelRegistro').hidden = !register;
    dialog.scrollTop = 0;
    if (focus) document.getElementById(register ? 'rgNombre' : 'enCorreo').focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-auth-open]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); opener = button;
    select(button.dataset.authOpen || 'ingreso');
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-abierto');
    document.getElementById(button.dataset.authOpen === 'registro' ? 'rgNombre' : 'enCorreo').focus({ preventScroll: true });
  }));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.authTab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + 1) % tabs.length];
      select(target.dataset.authTab); target.focus();
    });
  });
  document.getElementById('closeAuth').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-abierto');
    document.querySelectorAll('.password-toggle').forEach(button => {
      document.getElementById(button.dataset.password).type = 'password';
      button.textContent = 'Mostrar'; button.setAttribute('aria-pressed', 'false');
    });
    // No guardar contraseñas en una ventana cerrada.
    document.getElementById('enClave').value = ''; document.getElementById('rgClave').value = '';
    document.getElementById('rgClave').dispatchEvent(new Event('input', { bubbles: true }));
    opener?.focus({ preventScroll: true });
  });
  document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.password);
    const show = input.type === 'password'; input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ocultar' : 'Mostrar'; button.setAttribute('aria-pressed', String(show));
  }));
  const theme = document.getElementById('themeToggle');
  function syncTheme() {
    theme.innerHTML = temaNoche() ? ICONO_SOL : ICONO_LUNA;
    theme.querySelector('svg').classList.add('icon');
    theme.setAttribute('aria-label', temaNoche() ? 'Activar tema claro' : 'Activar tema oscuro');
    theme.title = theme.getAttribute('aria-label');
  }
  theme.addEventListener('click', () => { cambiarTema(); syncTheme(); });
  addEventListener('tema', syncTheme); syncTheme();
  let ready = false;
  document.getElementById('authStatus').textContent = 'Preparando acceso…';
  setTimeout(() => {
    if (ready) return;
    const status = document.getElementById('authStatus');
    status.textContent = 'No se pudo preparar el acceso. Revisa tu conexión y vuelve a cargar la página.';
    status.classList.add('error');
  }, 12000);
  addEventListener('portada-auth-ready', () => {
    ready = true;
    document.getElementById('authStatus').textContent = '';
    document.getElementById('authStatus').classList.remove('error');
    document.querySelectorAll('.auth-submit').forEach(button => button.disabled = false);
  });
  document.querySelectorAll('#formEntrar, #formRegistro').forEach(form => form.addEventListener('submit', event => {
    if (ready) return;
    event.preventDefault(); event.stopImmediatePropagation();
    document.getElementById('authStatus').textContent = 'El acceso aún no está disponible. Revisa tu conexión e inténtalo de nuevo.';
  }, true));
  // Este reloj es una demostración explícita, no representa un torneo activo.
  let remaining = 23 * 60 + 41;
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(); remaining -= Math.floor((now - last) / 1000); last = now;
    if (remaining < 0) remaining = 23 * 60 + 41;
    document.getElementById('demoClock').textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
  }, 1000);
})();
