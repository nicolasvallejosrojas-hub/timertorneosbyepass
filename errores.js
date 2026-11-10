export function avisarError(error, texto = "No se pudo completar la operación. Revisa la conexión y vuelve a intentarlo."){
  console.error(texto, error?.code || error?.message || error);
  let caja = document.getElementById("errorOperacion");
  if (!caja){
    caja = document.createElement("div"); caja.id = "errorOperacion"; caja.role = "alert";
    Object.assign(caja.style, {position:"fixed",bottom:"20px",left:"20px",right:"20px",zIndex:10000,padding:"16px",background:"var(--sup, #202436)",color:"var(--texto, white)",border:"2px solid #f5a46b",borderRadius:"12px"});
    document.body.appendChild(caja);
  }
  caja.replaceChildren(document.createTextNode(texto + " "));
  const b = document.createElement("button"); b.textContent = "Entendido"; b.onclick = () => caja.remove(); caja.appendChild(b);
}
