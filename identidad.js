import { contraste } from './paleta.js';
export const colorValido = c => /^#[0-9a-f]{6}$/i.test(c || '');
export function colorLogo(pixels){
 const bins=new Map();
 for(let i=0;i<pixels.length;i+=4){
  if(pixels[i+3]<160) continue;
  const rgb=[pixels[i],pixels[i+1],pixels[i+2]], max=Math.max(...rgb),min=Math.min(...rgb);
  if(max>240 && min>230 || max<22) continue;
  const key=rgb.map(x=>Math.min(240,Math.floor(x/24)*24+12)).join(',');
  const b=bins.get(key)||{n:0,r:0,g:0,b:0};b.n++;b.r+=rgb[0];b.g+=rgb[1];b.b+=rgb[2];bins.set(key,b);
 }
 const b=[...bins.values()].sort((a,b)=>b.n-a.n)[0];
 return b ? '#'+[b.r,b.g,b.b].map(v=>Math.round(v/b.n).toString(16).padStart(2,'0')).join('') : '#3867a8';
}
export async function prepararLogo(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Usa una imagen PNG, JPG o WebP.');
 if(file.size>5*1024*1024) throw Error('El archivo debe pesar menos de 5 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width>4096||bitmap.height>4096) throw Error('El logo debe tener hasta 4096 píxeles por lado.');
  const canvas=document.createElement('canvas'),scale=Math.min(1,384/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let logo=canvas.toDataURL('image/png');if(logo.length>180000)logo=canvas.toDataURL('image/webp',.8);
  if(logo.length>180000)throw Error('El logo tiene demasiado detalle. Prueba una versión más sencilla.');
  const sample=document.createElement('canvas');sample.width=sample.height=80;
  const c=sample.getContext('2d');c.drawImage(bitmap,0,0,80,80);
  return {logo,color:colorLogo(c.getImageData(0,0,80,80).data)};
 } finally {bitmap.close();}
}
export function aplicarMarca(el,color){
 if(!colorValido(color))return;
 el.style.setProperty('--franja',color);
 el.style.setProperty('--accion',color);
 el.style.setProperty('--sobre-accion',contraste(color,'#ffffff')>=4.5?'#ffffff':'#111111');
 const fondo=getComputedStyle(el).getPropertyValue('--sup').trim();
 el.style.setProperty('--accion-texto',colorValido(fondo)&&contraste(color,fondo)>=4.5?color:'var(--texto)');
}
export function montarIdentidad({root,puedeEditar,colorInput}){
 root.innerHTML=`<h3>Identidad de tu tienda</h3><p>Sube tu logo y te proponemos un color. Puedes ajustarlo antes de guardar; también puedes continuar con tus iniciales.</p><label>Logo de la tienda<input id="marcaArchivo" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="marcaQuitar" class="small sec">Usar iniciales</button><label class="chk"><input type="checkbox" id="marcaTimer">Aplicar también al diseño de este timer</label><div class="marcaPreview"><img id="marcaImagen" alt="Vista previa del logo" hidden><strong id="marcaInicial">Tu tienda</strong><p>Así se verá tu identidad</p><button type="button" tabindex="-1">Acción principal</button></div><p id="marcaEstado" role="status"></p>`;
 const file=root.querySelector('input[type=file]'),img=root.querySelector('img'),preview=root.querySelector('.marcaPreview'),msg=root.querySelector('[role=status]');
 let logo=null,modificado=false,cargando=false,numero=0;
 root.querySelectorAll('input,button').forEach(x=>x.disabled=!puedeEditar);
 function pintar(){aplicarMarca(preview,colorInput.value);img.hidden=!logo;if(logo)img.src=logo;else img.removeAttribute('src');root.querySelector('#marcaInicial').hidden=!!logo;}
 colorInput.addEventListener('input',pintar);
 file.onchange=async()=>{
  const f=file.files[0];file.value='';if(!f)return;const n=++numero;cargando=true;msg.textContent='Preparando tu logo…';
  try {const resultado=await prepararLogo(f);if(n!==numero)return;logo=resultado.logo;colorInput.value=resultado.color;modificado=true;pintar();colorInput.dispatchEvent(new Event('input',{bubbles:true}));msg.textContent='Colores propuestos. Revísalos y pulsa Guardar perfil.';}
  catch(e){if(n===numero)msg.textContent=e.message;}
  finally {if(n===numero)cargando=false;}
 };
 root.querySelector('#marcaQuitar').onclick=()=>{numero++;cargando=false;logo=null;modificado=true;pintar();msg.textContent='Se usarán las iniciales al guardar.';colorInput.dispatchEvent(new Event('input',{bubbles:true}));};
 return {
  cargar(valor){if(!modificado){logo=valor||null;pintar();}},
  cambios(tienda,base){if(cargando)throw Error('Espera a que termine de prepararse el logo.');const out={};if(modificado)out[`fotos/${tienda}/logo`]=logo;
   if(root.querySelector('#marcaTimer').checked){out[base+'/timer/theme/paleta']={accion:colorInput.value,base:'#151b29',manual:{}};out[base+'/timer/media/logo']=logo;out[base+'/timer/mediaVersion']=Date.now();}
   return out;
  },
  guardado(){modificado=false;msg.textContent='Identidad guardada.';}
 };
}
