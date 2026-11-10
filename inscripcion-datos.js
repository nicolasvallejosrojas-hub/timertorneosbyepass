export async function guardarInscripcion({ tienda, evento, uid, dato, limitada, cargar, escribir }){
  const ruta = `inscripciones/${tienda}/${evento}/${uid}`, base = `cupos/${tienda}/${evento}`;
  if (!limitada){ await escribir({ [ruta]: dato }); return dato; }
  const plazas = await cargar();
  const propia = plazas.quien?.[uid];
  const candidatos = propia ? [propia.split("/")[1]] : Object.entries(plazas[dato.division] || {}).filter(([,v]) => v === "").map(([k]) => k).sort((a,b) => +a - +b);
  if (propia && !propia.startsWith(dato.division + "/")) throw new Error("Anula tu inscripción antes de cambiar de categoría.");
  for (const n of candidatos){
    const perfil = { ...dato, cupo:n };
    try {
      await escribir({ [ruta]:perfil, [`${base}/${dato.division}/${n}`]:uid, [`${base}/quien/${uid}`]:`${dato.division}/${n}` });
      return perfil;
    } catch(e){ if (!/permission/i.test(e.code || e.message || "")) throw e; }
  }
  throw new Error("No se pudo reservar: no quedan cupos disponibles o las inscripciones cerraron. Recarga e inténtalo otra vez.");
}
