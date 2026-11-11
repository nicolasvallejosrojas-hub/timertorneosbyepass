const normal = n => String(n||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function estadoEspera(p,nombre){
 const ronda=p?.rounds?.find(r=>r.number===p.lastRound);
 /* Quien no juega esta ronda (o si no hay torneo) juega libre: clave «libre», que no cambia con las rondas. Quien sí juega espera su resultado. */
 const libre=m=>({listo:true,libre:true,clave:'libre',motivo:m});
 if(!ronda)return libre('No hay una ronda en juego: puedes jugar libre.');
 const todas=(ronda.matches||[]).flatMap(m=>[m.p1,m.p2].filter(Boolean));
 const candidatos=todas.filter(n=>normal(n)===normal(nombre));
 if(candidatos.length!==1)return libre('No estás en esta ronda: puedes jugar libre.');
 const mesa=ronda.matches.find(m=>[m.p1,m.p2].some(n=>normal(n)===normal(nombre)));
 return {listo:!!mesa.result,mesa:mesa.table,nombre:candidatos[0],ronda:ronda.number,clave:[p.name,p.fecha||p.startdate||'',ronda.number].join('|'),motivo:mesa.result?'Tu resultado está publicado. Puedes jugar mientras esperas.':'Tu partida todavía no tiene un resultado publicado.'};
}
export function mazoMemoria(azar=Math.random){
 const lista=Array.from({length:12},(_,i)=>({id:i,tipo:i%6}));
 for(let i=lista.length-1;i>0;i--){const j=Math.floor(azar()*(i+1));[lista[i],lista[j]]=[lista[j],lista[i]];}return lista;
}
