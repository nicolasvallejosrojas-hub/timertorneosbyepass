/* Registro recuperable. Auth y el perfil son servicios distintos: una respuesta
   perdida no demuestra que una escritura haya fallado. Las consultas de
   confirmación que recibe este módulo deben ir al servidor, sin caché. */
export const perfilCompleto = p => !!(p && typeof p.nombre === "string" && p.nombre.trim().length >= 3
  && (/^\d{4}-\d{2}-\d{2}$/.test(p.nacimiento || "") || Number.isInteger(p.anio)));

const errorRegistro = (code, cause) => Object.assign(new Error(code), { code, cause });
const rechazoConfirmado = e => /permission[-_]denied|validation[-_]failed/i.test(e?.code || "");

export function crearRegistro(api, { espera = 15000 } = {}) {
  const memoria = new Map(), escrituras = new Map();
  let ocupado = false;
  const limitar = promesa => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(errorRegistro("registro/tiempo-agotado")), espera);
    Promise.resolve(promesa).then(resolve, reject).finally(() => clearTimeout(timer));
  });
  const recordar = (uid, dato) => {
    // Lista explícita: nunca serializar el formulario completo ni la contraseña.
    const seguro = { nombre: dato.nombre, nacimiento: dato.nacimiento, playerId: dato.playerId || "",
      publico: !!dato.publico, creado: dato.creado, invitacion: dato.invitacion || "" };
    memoria.set(uid, seguro);
    try { api.pendientes?.guardar(uid, seguro); } catch { /* Sigue disponible en memoria. */ }
    return seguro;
  };
  function pendiente(uid) {
    if (!uid) return null;
    if (memoria.has(uid)) return memoria.get(uid);
    try { return api.pendientes?.leer(uid) || null; } catch { return null; }
  }
  function olvidar(uid) {
    memoria.delete(uid); escrituras.delete(uid);
    try { api.pendientes?.quitar(uid); } catch { /* La consulta al servidor evita repetir un alta guardada. */ }
  }
  async function exclusivo(fn) {
    if (ocupado) throw errorRegistro("registro/en-curso");
    ocupado = true;
    try { return await fn(); } finally { ocupado = false; }
  }
  async function terminar(user) {
    olvidar(user.uid);
    try { await limitar(api.verificarCorreo(user)); }
    catch { api.avisar?.("verificacion-pendiente"); }
    return user;
  }
  async function guardar(user, dato, nueva) {
    let escribiendo = false;
    try {
      await limitar(api.cambiarNombre(user, dato.nombre));
      escribiendo = true;
      let operacion = escrituras.get(user.uid);
      if (!operacion) {
        operacion = Promise.resolve().then(() => api.guardarPerfil(user, dato));
        escrituras.set(user.uid, operacion);
        // Un timeout no cancela las escrituras del SDK. Mientras siga pendiente,
        // un reintento espera la misma operación y no vuelve a sumar la invitación.
        operacion.catch(() => { if (escrituras.get(user.uid) === operacion) escrituras.delete(user.uid); });
      }
      await limitar(operacion);
      return terminar(user);
    } catch (cause) {
      let confirmado = false, perfil;
      try { perfil = await limitar(api.leerPerfil(user)); confirmado = true; } catch {}
      // La escritura pudo confirmarse y perderse solo su respuesta.
      if (confirmado && perfilCompleto(perfil)) return terminar(user);
      // Solo se elimina la identidad recién creada y cuando hay certeza de que
      // no existe perfil y no queda una escritura ambigua que pueda llegar tarde.
      if (nueva && confirmado && perfil === null && (!escribiendo || rechazoConfirmado(cause))) {
        try { await limitar(api.borrarCuenta(user)); }
        catch { throw errorRegistro("registro/pendiente", cause); }
        olvidar(user.uid);
        throw errorRegistro(dato.invitacion && escribiendo ? "beta/codigo" : "registro/no-guardado", cause);
      }
      throw errorRegistro("registro/pendiente", cause);
    }
  }
  function registrar(datos) {
    return exclusivo(async () => {
      if (api.usuarioActual()) throw errorRegistro("registro/sesion-activa");
      let beta;
      try { beta = await limitar(api.leerBeta()); }
      catch (cause) { throw errorRegistro("registro/no-disponible", cause); }
      const invitacion = beta ? api.normalizarCodigo(datos.invitacion) : "";
      if (beta && !invitacion) throw errorRegistro("beta/falta");
      if (invitacion) {
        const mal = await limitar(api.validarInvitacion(invitacion));
        if (mal) throw errorRegistro(mal);
      }
      const user = await api.crearCuenta(datos.correo, datos.clave);
      const dato = recordar(user.uid, { ...datos, invitacion, creado: Date.now() });
      return guardar(user, dato, true);
    });
  }
  function reanudar(datos) {
    return exclusivo(async () => {
      const user = api.usuarioActual();
      if (!user) throw errorRegistro("registro/sin-sesion");
      let actual;
      try { actual = await limitar(api.leerPerfil(user)); }
      catch (cause) { throw errorRegistro("registro/pendiente", cause); }
      if (perfilCompleto(actual)) { olvidar(user.uid); return user; }
      const anterior = pendiente(user.uid);
      const dato = { ...anterior, ...datos, creado: anterior?.creado ?? actual?.creado ?? Date.now() };
      let beta;
      try { beta = await limitar(api.leerBeta()); }
      catch (cause) { throw errorRegistro("registro/no-disponible", cause); }
      dato.invitacion = beta ? api.normalizarCodigo(dato.invitacion) : "";
      if (beta && !dato.invitacion) throw errorRegistro("beta/falta");
      // Una operación ya enviada conserva su validación original y se espera.
      if (dato.invitacion && !escrituras.has(user.uid)) {
        const mal = await limitar(api.validarInvitacion(dato.invitacion));
        if (mal) throw errorRegistro(mal);
      }
      return guardar(user, recordar(user.uid, dato), false);
    });
  }
  return { registrar, reanudar, pendiente };
}
