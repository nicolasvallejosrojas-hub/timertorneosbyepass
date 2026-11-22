export async function guardarInscripcion({ tienda, evento, uid, dato, limitada, cargar, escribir }){
  const ruta = `inscripciones/${tienda}/${evento}/${uid}`, base = `cupos/${tienda}/${evento}`;
  if (!limitada){ await escribir({ [ruta]: dato }); return dato; }
  const plazas = await cargar();
  const propia = plazas.quien?.[uid];
  if (propia && !propia.startsWith(dato.division + "/")) throw new Error("Anula tu inscripción antes de cambiar de categoría.");
  /* Ya tiene su plaza: se corrige solo la inscripción. Volver a escribir la plaza (con el mismo uid) lo rechazan las reglas, que
     solo dejan tomar una libre o soltar la propia: con eso nadie con cupo podía guardar cambios. */
  if (propia){ const perfil = { ...dato, cupo: propia.split("/")[1] }; await escribir({ [ruta]: perfil }); return perfil; }
  const candidatos = Object.entries(plazas[dato.division] || {}).filter(([,v]) => v === "").map(([k]) => k).sort((a,b) => +a - +b);
  for (const n of candidatos){
    const perfil = { ...dato, cupo:n };
    try {
      await escribir({ [ruta]:perfil, [`${base}/${dato.division}/${n}`]:uid, [`${base}/quien/${uid}`]:`${dato.division}/${n}` });
      return perfil;
    } catch(e){ if (!/permission/i.test(e.code || e.message || "")) throw e; }
  }
  throw new Error("No se pudo reservar: no quedan cupos disponibles o las inscripciones cerraron. Recarga e inténtalo otra vez.");
}
