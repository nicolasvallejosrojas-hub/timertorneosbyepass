/* sonidos.js — los efectos de sonido de los minijuegos de la espera (memorice, Salta Magikarp y Buscaminas).
   Se generan en el navegador con la Web Audio API (tonos y ruido cortos, estilo retro como el pixel art de los juegos):
   no hay archivos de audio que bajar ni que guardar. Suenan solo si la persona no los silenció (botón 🔊/🔇 en la cabecera de
   cada juego; se recuerda en este navegador) y a volumen bajo, porque se juega en la tienda. Los navegadores solo dejan sonar
   después de un toque: prepararSonido() se llama al tocar (antes de esperar al servidor) para «despertar» el audio a tiempo. */

const CLAVE = "bp-sonido", VOLUMEN = 0.16;
let ctx = null, activo = true;
try { activo = localStorage.getItem(CLAVE) !== "no"; } catch { /* sin almacenamiento: con sonido */ }

export function prepararSonido(){
  if (!activo) return null;
  try {
    if (!ctx){ const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
    if (ctx.state === "suspended") ctx.resume();
  } catch { return null; }
  return ctx;
}

/* un tono con su envolvente (ataque corto y caída), que puede deslizarse hasta otra frecuencia */
function tono(f, t0, dur, { tipo = "square", vol = 1, hasta = null } = {}){
  const a = prepararSonido(); if (!a) return;
  const t = a.currentTime + t0, o = a.createOscillator(), g = a.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(VOLUMEN * vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
/* ruido filtrado (agua, lanzamiento, explosión) */
function ruido(t0, dur, { vol = 1, filtro = 1200, hasta = null } = {}){
  const a = prepararSonido(); if (!a) return;
  const t = a.currentTime + t0, n = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = "lowpass"; f.frequency.setValueAtTime(filtro, t);
  if (hasta) f.frequency.exponentialRampToValueAtTime(hasta, t + dur);
  g.gain.setValueAtTime(VOLUMEN * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur);
}
const arpegio = (notas, paso = 0.09, dur = 0.2, op) => notas.forEach((f, i) => tono(f, i * paso, dur, op));

const SONIDOS = {
  /* memorice */
  voltear: () => tono(700, 0, 0.06, { tipo: "triangle", vol: 0.7, hasta: 900 }),
  pareja: () => { tono(784, 0, 0.11); tono(1175, 0.09, 0.2); },
  fallo: () => tono(260, 0, 0.22, { tipo: "triangle", vol: 0.8, hasta: 170 }),
  ganar: () => { arpegio([523, 659, 784, 1047], 0.09, 0.2); tono(1319, 0.38, 0.45, { vol: 0.8 }); },
  /* salta, magikarp: el impulso suena más agudo mientras más preciso (p = 0 a 100) */
  lanzar: () => { ruido(0, 0.28, { vol: 0.6, filtro: 3000, hasta: 500 }); tono(500, 0.05, 0.18, { tipo: "triangle", vol: 0.5, hasta: 900 }); },
  impulso: p => tono(320 + p * 5, 0, 0.16, { hasta: 520 + p * 8 }),
  perfecto: () => { arpegio([880, 1320, 1760], 0.06, 0.14, { vol: 0.7 }); },
  splash: () => { ruido(0, 0.4, { vol: 0.9, filtro: 1400, hasta: 300 }); tono(180, 0, 0.2, { tipo: "triangle", vol: 0.5, hasta: 90 }); },
  record: () => { arpegio([659, 784, 988, 1319], 0.08, 0.2); tono(1568, 0.34, 0.5, { vol: 0.8 }); },
  /* buscaminas */
  destapar: () => tono(560, 0, 0.05, { tipo: "triangle", vol: 0.6 }),
  cascada: n => { for (let k = 0; k < Math.min(n, 10); k++) tono(520 + k * 45, k * 0.028, 0.05, { tipo: "triangle", vol: 0.5 }); },
  bandera: () => { tono(990, 0, 0.05, { tipo: "sine" }); tono(1320, 0.05, 0.08, { tipo: "sine", vol: 0.8 }); },
  explosion: () => { ruido(0, 0.7, { vol: 1.4, filtro: 700, hasta: 120 }); tono(140, 0, 0.5, { tipo: "sawtooth", vol: 0.7, hasta: 40 }); },
};

export function sonar(nombre, x){
  if (!activo || !nombre || !SONIDOS[nombre]) return;
  try { SONIDOS[nombre](x); } catch { /* el sonido es un extra: nunca rompe el juego */ }
}

/* el botón de sonido (parlante con o sin ondas): va en la cabecera de cada ventana de juego, junto a «Cerrar» (el mismo estado para los tres juegos) */
const botones = new Set();
const PARLANTE = '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/>';
const ICONO = { si: PARLANTE + '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>', no: PARLANTE + '<path d="M17 9.5l5 5M22 9.5l-5 5"/>' };
function pintar(b){
  b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' + ICONO[activo ? "si" : "no"] + "</svg>";
  b.setAttribute("aria-pressed", String(!activo));
  b.setAttribute("aria-label", activo ? "Silenciar los sonidos de los juegos" : "Activar los sonidos de los juegos");
  b.title = activo ? "Sonido activado" : "Sonido silenciado";
}
export function ponerBotonSonido(cerrar){
  if (!cerrar) return;
  const b = document.createElement("button"), caja = document.createElement("span");
  b.type = "button"; b.className = "botonSonido"; pintar(b); botones.add(b);
  b.onclick = () => {
    activo = !activo;
    try { localStorage.setItem(CLAVE, activo ? "si" : "no"); } catch { /* solo por esta visita */ }
    botones.forEach(pintar);
    if (activo) sonar("voltear");
  };
  caja.className = "juegoAcc"; cerrar.replaceWith(caja); caja.append(b, cerrar);
}
