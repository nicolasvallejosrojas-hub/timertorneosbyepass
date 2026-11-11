import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInWithEmailAndPassword, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { MES_LARGO } from "./agenda.js?v=9beff3299439";
import { db, auth, params, enEmulador, urlMuro, urlCuenta, urlPanel, decir, CORREO_OK, revisarClave, claveOk,
         textoFalta, errorNacimiento, registrar, codigoInvitacion, betaActiva, normCodigo, CODIGO_OK, consultarPerfil, perfilCompleto } from "./sesion.js?v=9beff3299439";
import { estoyEnLinea } from "./presencia.js?v=9beff3299439";
estoyEnLinea(db, "portada");

const $ = id => document.getElementById(id);
function aviso(id, msg){ $(id).textContent = msg; $(id).classList.toggle("oculto", !msg); }

/* Los enlaces llevan la sala y el ?emu=1 con que llegaste: sin eso, en una
   prueba local la cuenta abriría la base real en vez del emulador. */
/* El aviso de la beta se ve solo mientras queden cupos: si la cuenta falla,
   no se muestra (mejor callar que prometer una insignia que ya no queda).
   El 100 es BETA_CUPOS de insignias.js, escrito acá y en el texto del aviso:
   importar ese módulo solo por el número le sumaría 20 KB a la portada. */
get(ref(db, "altas")).then(s => {
  if (Object.keys(s.val() || {}).length < 100) $("betaAviso").classList.remove("oculto");
}, () => {});

/* ▌BLOQUE 3 · Enlaces y sesión abierta ══════════════════════════════════════════
   Con sesión abierta salta al muro. */
const DESTINO = { ingresar: urlCuenta("ingresar"), olvide: urlCuenta("olvide"), panel: urlPanel(), pedir: urlCuenta("tienda"),
                  torneo: "timer-view.html" + params(), tiendas: "tienda.html" + (enEmulador() ? "?emu=1" : ""),
                  rulings: enEmulador() ? "rulings.html?emu=1" : "rulings" };
document.querySelectorAll("[data-link]").forEach(a => a.href = DESTINO[a.dataset.link]);
/* Rulings aparece cuando está abierta a todos (sistema/ se lee sin sesión). */
get(ref(db, "sistema/rulingsAbierto")).then(s => {
  if (s.val() === true) ["pasoRulings", "pieRulings"].forEach(id => $(id).classList.remove("oculto"));
}, () => {});

/* Con la sesión abierta, esta página no tiene nada que ofrecer: al muro, como
   hacía Facebook. Mientras se registra no, o la cuenta quedaría a medias. */
let registrando = false;
onAuthStateChanged(auth, async u => {
  if (!u || registrando) return;
  try {
    const p = await consultarPerfil(u);
    if (auth.currentUser?.uid === u.uid && !registrando) location.replace(perfilCompleto(p) ? urlMuro() : urlCuenta("ajustes"));
  } catch(e){ if (auth.currentUser?.uid === u.uid && !registrando) location.replace(urlCuenta("ajustes")); }
});

/* ▌BLOQUE 4 · Entrar ════════════════════════════════════════════════════════════
   Ingreso desde la ventana de acceso. */
/* ------------------------------------------------------------ entrar */
$("formEntrar").onsubmit = async e => {
  e.preventDefault();
  aviso("errEntrar", "");
  const correo = $("enCorreo").value.trim(), clave = $("enClave").value;
  if (!correo || !clave) return aviso("errEntrar", "Escribe tu correo y tu contraseña.");
  const b = $("btnEntrar");
  b.disabled = true; b.textContent = "Ingresando…"; b.setAttribute("aria-busy", "true");
  try {
    await signInWithEmailAndPassword(auth, correo, clave);   // onAuthStateChanged lleva al muro
  } catch(err){
    aviso("errEntrar", decir(err));
    b.disabled = false; b.textContent = "Iniciar sesión"; b.removeAttribute("aria-busy");
  }
};

/* ▌BLOQUE 5 · Fecha de nacimiento ═══════════════════════════════════════════════
   Los selectores de día, mes y año. */
/* ------------------------------------------------------------ fecha
   Día, mes y año por separado, como en 2009. Un calendario nativo abre en el
   mes de hoy, y para llegar a 2011 hay que retroceder quince años a toques. */
const anioHoy = new Date().getFullYear();
const opciones = (sel, pares) => pares.forEach(([v, t]) => sel.add(new Option(t, v)));
opciones($("rgDia"),  Array.from({ length: 31 }, (_, i) => [String(i + 1).padStart(2, "0"), i + 1]));
opciones($("rgMes"),  MES_LARGO.map((m, i) => [String(i + 1).padStart(2, "0"), m]));
opciones($("rgAnio"), Array.from({ length: 101 }, (_, i) => [anioHoy - i, anioHoy - i]));
const fecha = () => [$("rgAnio").value, $("rgMes").value, $("rgDia").value].every(Boolean)
  ? $("rgAnio").value + "-" + $("rgMes").value + "-" + $("rgDia").value : "";

/* ▌BLOQUE 6 · Contraseña ════════════════════════════════════════════════════════
   Medidor de fuerza. */
/* ------------------------------------------------------------ contraseña */
function medir(){
  const clave = $("rgClave").value;
  const r = revisarClave(clave, $("rgNombre").value, $("rgCorreo").value);
  const n = Object.values(r).filter(Boolean).length;
  $("rgMedidor").classList.toggle("lista", claveOk(r));
  [...$("rgMedidor").children].forEach((i, k) => i.classList.toggle("si", k < n));
  $("rgFalta").classList.toggle("ok", claveOk(r));
  $("rgFalta").innerHTML = textoFalta(clave, r);
  return r;
}
["rgClave", "rgNombre", "rgCorreo"].forEach(id => $(id).addEventListener("input", medir));

/* ▌BLOQUE 7 · Crear cuenta ══════════════════════════════════════════════════════
   Validación y registro (con código si la beta está activa). */
/* ------------------------------------------------------------ crear cuenta */
function error(){
  const nombre = $("rgNombre").value.trim();
  if (nombre.length < 3) return ["rgNombre", "Escribe tu nombre y apellido."];
  if (!CORREO_OK($("rgCorreo").value.trim())) return ["rgCorreo", "Revisa el correo."];
  if (!claveOk(medir())) return ["rgClave", "A la contraseña todavía le falta algo: está escrito debajo."];
  const f = fecha();
  if (!f) return ["rgDia", "Elige el día, el mes y el año en que naciste."];
  /* 31 de febrero: el select lo deja elegir, y una fecha así no existe. */
  const d = new Date(f + "T12:00:00");
  if (d.getMonth() + 1 !== +$("rgMes").value) return ["rgDia", "Esa fecha no existe: revisa el día."];
  const mal = errorNacimiento(f);
  if (mal) return ["rgDia", mal];
  if (BETA && !CODIGO_OK(normCodigo($("rgCodigo").value))) return ["rgCodigo", "Escribe tu código de invitación: son letras y números, sin espacios."];
  return null;
}

/* Beta cerrada: si está activa se pide el código (el del enlace ya viene escrito). */
let BETA = false;
$("rgCodigo").defaultValue = codigoInvitacion();
betaActiva().then(b => { BETA = b; $("filaCodigo").classList.toggle("oculto", !b); });

$("formRegistro").onsubmit = async e => {
  e.preventDefault();
  aviso("errRegistro", "");
  const falla = error();
  if (falla){ aviso("errRegistro", falla[1]); $(falla[0]).focus(); return; }
  const b = $("btnRegistro");
  b.disabled = true; b.textContent = "Creando…"; b.setAttribute("aria-busy", "true");
  registrando = true;
  try {
    await registrar({ nombre: $("rgNombre").value.trim().replace(/\s+/g, " "),
                      correo: $("rgCorreo").value.trim(), clave: $("rgClave").value,
                      nacimiento: fecha(), invitacion: $("rgCodigo").value });
    location.replace(urlMuro("perfil"));
  } catch(err){
    registrando = false;
    /* Si falló el guardado y no la creación, la sesión ya está abierta: los
       ajustes muestran el aviso de cuenta incompleta. */
    if (auth.currentUser) return location.replace(urlCuenta("ajustes"));
    aviso("errRegistro", decir(err));
    b.disabled = false; b.textContent = "Crear mi cuenta"; b.removeAttribute("aria-busy");
  }
};


// Los controles se habilitan solo después de preparar Firebase y las validaciones.
dispatchEvent(new Event("portada-auth-ready"));
