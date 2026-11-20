/* ============================================================
   tcgdex.js — el texto de una carta (efectos, habilidades, ataques con costo y daño), pedido a TCGdex
   ------------------------------------------------------------
   Nada de esto se guarda en el sitio: el navegador pide cada carta una vez y la deja en localStorage por
   14 días («tcgdex1:<id>»), así abrir Probar mazo otra vez no repite las consultas. Si TCGdex no responde,
   la función da null y no se guarda (la próxima vez se vuelve a intentar).
   ============================================================ */
const CLAVE = "tcgdex1:", DIAS = 14, MEM = new Map();

/* El id de TCGdex («sv06-129») sale de la dirección de la foto («…/en/sv/sv06/129/low.webp»); "" si la carta no tiene foto. */
export const idTcgdex = foto => { const m = /\/en\/[^/]+\/([^/]+)\/([^/]+)\/(?:low|high)\.webp$/.exec(foto || ""); return m ? m[1] + "-" + m[2] : ""; };

/* Solo lo que usa Probar mazo (el JSON entero pesa mucho más por los precios). */
const compacto = j => ({
  name: j.name, category: j.category, stage: j.stage, trainerType: j.trainerType, energyType: j.energyType, evolveFrom: j.evolveFrom, hp: j.hp, types: j.types, effect: j.effect,
  abilities: (j.abilities || []).map(a => ({ name: a.name, type: a.type, effect: a.effect })),
  attacks: (j.attacks || []).map(a => ({ name: a.name, cost: a.cost || [], damage: a.damage, effect: a.effect })),
});

export function datoCarta(id){
  if (!id) return Promise.resolve(null);
  if (MEM.has(id)) return MEM.get(id);
  let guardada = null;
  try { guardada = JSON.parse(localStorage.getItem(CLAVE + id) || "null"); } catch(e){ /* sin almacenamiento: se pide igual */ }
  let p;
  if (guardada && Date.now() - guardada.t < DIAS * 864e5) p = Promise.resolve(guardada.d);
  else p = fetch("https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(id)).then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return null;
    const d = compacto(j);
    try { localStorage.setItem(CLAVE + id, JSON.stringify({ t: Date.now(), d })); } catch(e){ /* sin espacio: no pasa nada */ }
    return d;
  }).catch(() => null).then(d => { if (!d) MEM.delete(id); return d; });
  MEM.set(id, p);
  return p;
}
