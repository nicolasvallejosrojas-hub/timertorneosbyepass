// Plan puro: el torneo y su vista pública se envían en una única actualización atómica.
export function aplicarRutas(actual, rutas, base){
  let copia = structuredClone(actual);
  const prefijo = base + "/torneo";
  for (const [ruta, valor] of Object.entries(rutas)){
    if (ruta === prefijo){ copia = structuredClone(valor); continue; }
    if (!ruta.startsWith(prefijo + "/")) continue;
    const partes = ruta.slice(prefijo.length + 1).split("/");
    copia ??= {};
    let nodo = copia;
    for (const p of partes.slice(0,-1)) nodo = nodo[p] ??= {};
    if (valor === null) delete nodo[partes.at(-1)]; else nodo[partes.at(-1)] = structuredClone(valor);
  }
  return copia;
}
export function planPublicacion(actual, rutas, base, convertir){
  const siguiente = aplicarRutas(actual, rutas, base);
  const tieneRondas = siguiente && Object.values(siguiente.ronda || {}).some(Boolean);
  return { ...rutas, [base + "/pairings"]: tieneRondas ? convertir(siguiente) : null };
}
