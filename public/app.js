const $ = id => document.getElementById(id);
const pasos = ["paso-cargando", "paso-inicio", "paso-ingresar", "paso-crear", "paso-foto", "paso-aviso", "paso-carnet"];

const CLAVE_TOKEN = "carnet-adep-token";
const WHATSAPP = "https://wa.me/50687227777?text=" + encodeURIComponent("Hola, quisiera afiliarme a ADEP.");
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
               "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const icono = nombre => `<svg class="ico" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;

// --- Animaciones para celular ---
const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Vibración corta (solo Android; en iPhone no hace nada)
function vibrar(patron) {
  try { if (!movimientoReducido()) navigator.vibrate?.(patron); } catch {}
}

// Onda que sale desde donde toca el dedo
document.addEventListener("pointerdown", e => {
  const el = e.target.closest(".opcion, .btn, .contacto, .enlace-icono, .atras");
  if (!el || el.disabled || movimientoReducido()) return;
  const caja = el.getBoundingClientRect();
  const tam = Math.max(caja.width, caja.height) * 2.2;
  const onda = document.createElement("span");
  onda.className = "onda";
  onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - caja.left - tam / 2}px;top:${e.clientY - caja.top - tam / 2}px`;
  el.appendChild(onda);
  onda.addEventListener("animationend", () => onda.remove());
});

// Confeti con los colores de ADEP al crear el carnet o guardar la foto
function celebrar() {
  if (movimientoReducido()) return;
  const capa = document.createElement("div");
  capa.className = "confeti";
  const colores = ["#128a3e", "#d7242a", "#ffffff", "#1ea552", "#f4c542"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${colores[i % colores.length]};` +
      `animation-delay:${Math.random() * .35}s;animation-duration:${1.6 + Math.random() * 1.2}s;` +
      `--deriva:${(Math.random() - .5) * 160}px;--giro:${(Math.random() - .5) * 1080}deg;` +
      `width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px`;
    capa.appendChild(p);
  }
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), 3500);
}

let pasoActual = "paso-cargando";

function mostrar(paso) {
  // Hacia adelante entra desde la derecha; al volver, desde la izquierda (como en las apps)
  document.body.dataset.direccion = pasos.indexOf(paso) >= pasos.indexOf(pasoActual) ? "adelante" : "atras";
  pasoActual = paso;
  pasos.forEach(p => $(p).classList.toggle("oculto", p !== paso));
  document.body.dataset.paso = paso;   // la portada grande solo se ve en el inicio
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- "Recordar en este celular" (puede fallar en modo privado) ---
// Si la persona eligió "Recordar en este celular", también se guarda una copia del carnet
// para poder mostrarlo sin internet. Al salir, ambas cosas se borran.
const CLAVE_CARNET = "carnet-adep-carnet";
const token = {
  leer() { try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; } },
  guardar(valor) { try { localStorage.setItem(CLAVE_TOKEN, valor); } catch {} },
  borrar() { try { localStorage.removeItem(CLAVE_TOKEN); localStorage.removeItem(CLAVE_CARNET); } catch {} }
};
const copiaLocal = {
  leer() { try { return JSON.parse(localStorage.getItem(CLAVE_CARNET)); } catch { return null; } },
  guardar(carnet) {
    try { localStorage.setItem(CLAVE_CARNET, JSON.stringify({ ...carnet, guardado: new Date().toISOString() })); } catch {}
  },
  borrar() { try { localStorage.removeItem(CLAVE_CARNET); } catch {} }
};

// --- Cédula ---
const soloDigitos = v => v.replace(/\D/g, "").slice(0, 9);
const formatoCedula = d => [d.slice(0, 1), d.slice(1, 5), d.slice(5, 9)].filter(Boolean).join("-");

document.querySelectorAll("input.cedula").forEach(input => input.addEventListener("input", () => {
  input.value = formatoCedula(soloDigitos(input.value));
}));

// --- Fecha de nacimiento con tres listas: día, mes y año ---
function crearSelectorFecha(contenedor) {
  const opcion = (valor, texto) => `<option value="${valor}">${texto}</option>`;
  const anioActual = new Date().getFullYear();
  const dias = Array.from({ length: 31 }, (_, i) => opcion(i + 1, i + 1)).join("");
  const meses = MESES.map((m, i) => opcion(i + 1, m)).join("");
  const anios = Array.from({ length: anioActual - 18 - 1920 + 1 }, (_, i) => anioActual - 18 - i)
    .map(a => opcion(a, a)).join("");

  contenedor.innerHTML = `
    <select aria-label="Día" data-parte="dia"><option value="">Día</option>${dias}</select>
    <select aria-label="Mes" data-parte="mes"><option value="">Mes</option>${meses}</select>
    <select aria-label="Año" data-parte="anio"><option value="">Año</option>${anios}</select>`;

  return {
    // Devuelve AAAA-MM-DD, o null si falta algo o la fecha no existe (por ejemplo, 31 de abril).
    valor() {
      const [d, m, a] = ["dia", "mes", "anio"].map(p => Number(contenedor.querySelector(`[data-parte=${p}]`).value));
      if (!d || !m || !a) return null;
      const fecha = new Date(a, m - 1, d);
      if (fecha.getMonth() !== m - 1) return null;
      return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  };
}

const fechaIngresar = crearSelectorFecha($("ingresar-fecha"));
const fechaCrear = crearSelectorFecha($("crear-fecha"));

// --- Foto del rostro ---
// La foto se recorta a 3:4 (como foto de carnet) y se comprime en el celular
// antes de enviarla, para que suba rápido aunque la señal sea mala.
const FOTO_ANCHO = 360;     // ~30 KB por foto: así caben unas 30 000 en 1 GB (plan gratis de Supabase)
const FOTO_ALTO = 480;

function recortarFoto(fuente, ancho, alto, espejo = false) {
  const canvas = document.createElement("canvas");
  canvas.width = FOTO_ANCHO;
  canvas.height = FOTO_ALTO;
  const ctx = canvas.getContext("2d");
  // Recorte centrado con la proporción 3:4
  const escala = Math.max(FOTO_ANCHO / ancho, FOTO_ALTO / alto);
  const w = FOTO_ANCHO / escala, h = FOTO_ALTO / escala;
  if (espejo) { ctx.translate(FOTO_ANCHO, 0); ctx.scale(-1, 1); }
  ctx.drawImage(fuente, (ancho - w) / 2, (alto - h) / 2, w, h, 0, 0, FOTO_ANCHO, FOTO_ALTO);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function fotoDeArchivo(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(recortarFoto(img, img.naturalWidth, img.naturalHeight)); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(); };
    img.src = url;
  });
}

// Cámara a pantalla completa. Devuelve la foto (data URL) o null si la persona cancela.
const camara = (() => {
  const video = $("camara-video");
  let flujo = null;
  let resolver = null;
  let foto = null;

  function apagar() {
    flujo?.getTracks().forEach(t => t.stop());
    flujo = null;
    video.srcObject = null;
  }
  function revisar(modo) {
    $("camara-tomando").classList.toggle("oculto", modo);
    $("camara-revisando").classList.toggle("oculto", !modo);
    $("camara-ayuda").textContent = modo
      ? "¿Se ve bien su cara? Si no, tome otra."
      : "Ponga su cara dentro del óvalo, de frente y con buena luz.";
    $("camara").classList.toggle("revisando", modo);
  }
  function cerrar(resultado) {
    apagar();
    $("camara").classList.add("oculto");
    document.body.classList.remove("sin-scroll");
    resolver?.(resultado);
    resolver = null;
  }
  async function encender() {
    flujo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    video.srcObject = flujo;
    await video.play();
  }

  $("camara-disparar").addEventListener("click", () => {
    if (!video.videoWidth) return;
    // La vista previa es como un espejo; la foto guardada se voltea igual para que coincida con lo que vio.
    foto = recortarFoto(video, video.videoWidth, video.videoHeight, true);
    vibrar(35);
    const visor = video.parentElement;          // flash de cámara
    visor.classList.remove("flash"); void visor.offsetWidth; visor.classList.add("flash");
    const vista = $("camara-captura");
    const img = new Image();
    img.onload = () => {
      vista.width = FOTO_ANCHO; vista.height = FOTO_ALTO;
      vista.getContext("2d").drawImage(img, 0, 0);
    };
    img.src = foto;
    apagar();
    revisar(true);
  });
  $("camara-otra").addEventListener("click", async () => {
    revisar(false);
    try { await encender(); } catch { cerrar(null); }
  });
  $("camara-usar").addEventListener("click", () => cerrar(foto));
  $("camara-cancelar").addEventListener("click", () => cerrar(null));

  return {
    disponible: () => Boolean(navigator.mediaDevices?.getUserMedia),
    // Lanza un error si no hay permiso o no hay cámara; quien llama ofrece la galería.
    async abrir() {
      revisar(false);
      $("camara").classList.remove("oculto");
      document.body.classList.add("sin-scroll");
      try {
        await encender();
      } catch (e) {
        cerrar(null);
        throw e;
      }
      return new Promise(r => { resolver = r; });
    }
  };
})();

// Campo de foto dentro de un formulario: vista previa + "Tomar foto" + "Elegir de mis fotos".
function crearCampoFoto(contenedor) {
  let foto = null;
  contenedor.innerHTML = `
    <div class="foto-vista">${icono("persona")}</div>
    <div class="foto-acciones">
      <button type="button" class="btn btn-secundario" data-accion="camara">${icono("camara")} <span>Tomar foto</span></button>
      <label class="btn btn-claro">${icono("imagen")} Elegir de mis fotos
        <input type="file" accept="image/*" class="oculto" data-accion="archivo">
      </label>
      <div class="ayuda">De frente, sin lentes oscuros ni gorra, con buena luz.</div>
    </div>`;
  const vista = contenedor.querySelector(".foto-vista");
  const archivo = contenedor.querySelector("[data-accion=archivo]");
  const botonCamara = contenedor.querySelector("[data-accion=camara]");

  function poner(nueva) {
    foto = nueva;
    vista.innerHTML = foto ? `<img src="${foto}" alt="Su foto">` : icono("persona");
    vista.classList.toggle("con-foto", Boolean(foto));
    botonCamara.querySelector("span").textContent = foto ? "Tomar otra" : "Tomar foto";
  }
  const error = mensaje => {
    const form = contenedor.closest("form");
    if (form) mostrarError(form, mensaje);
  };

  botonCamara.addEventListener("click", async () => {
    if (!camara.disponible()) return archivo.click();
    try {
      const nueva = await camara.abrir();
      if (nueva) poner(nueva);
    } catch {
      error("No se pudo abrir la cámara. Revise que le dio permiso al navegador, o elija una foto de su celular.");
    }
  });
  archivo.addEventListener("change", async () => {
    const elegido = archivo.files[0];
    archivo.value = "";
    if (!elegido) return;
    try { poner(await fotoDeArchivo(elegido)); }
    catch { error("No se pudo abrir esa imagen. Pruebe con otra foto."); }
  });

  return { valor: () => foto, limpiar: () => poner(null) };
}

const fotoCrear = crearCampoFoto($("crear-foto"));
const fotoActualizar = crearCampoFoto($("actualizar-foto"));

// --- Filiales ---
async function cargarFiliales() {
  try {
    const res = await fetch("/api/filiales");
    const { filiales } = await res.json();
    const select = $("crear-filial");
    filiales.forEach(f => select.add(new Option(f, f)));
  } catch {
    // Si falla, el servidor avisará al intentar crear el carnet.
  }
}

// --- Navegación ---
document.querySelectorAll("[data-ir]").forEach(b => b.addEventListener("click", () => irA(b.dataset.ir)));

function irA(paso) {
  // Pasar la cédula escrita de un formulario al otro
  const escrita = $("ingresar-cedula").value || $("crear-cedula").value;
  if (paso === "paso-ingresar" && !$("ingresar-cedula").value) $("ingresar-cedula").value = escrita;
  if (paso === "paso-crear" && !$("crear-cedula").value) $("crear-cedula").value = escrita;
  document.querySelectorAll(".error-form").forEach(e => e.classList.add("oculto"));
  mostrar(paso);
}

// --- Avisos ---
// tipo: "alerta" (rojo) o "info" (verde). simbolo: nombre del ícono.
function aviso({ tipo = "alerta", simbolo = "alerta", titulo, texto, acciones }) {
  $("aviso-icono").innerHTML = icono(simbolo);
  $("aviso-icono").className = "icono-estado " + tipo;
  $("aviso-titulo").textContent = titulo;
  $("aviso-texto").textContent = texto;
  const contenedor = $("aviso-acciones");
  contenedor.innerHTML = "";
  acciones.forEach(({ texto, clase, ir, href }) => {
    const el = document.createElement(href ? "a" : "button");
    el.className = "btn " + clase;
    el.textContent = texto;
    if (href) { el.href = href; el.target = "_blank"; el.rel = "noopener"; }
    else { el.type = "button"; el.addEventListener("click", () => irA(ir)); }
    contenedor.appendChild(el);
  });
  mostrar("paso-aviso");
}

const avisoNoAfiliado = () => aviso({
  titulo: "No encontramos su afiliación",
  texto: "Esta cédula no aparece como afiliado activo de ADEP. Si desea afiliarse o cree que es un error, escríbanos por WhatsApp.",
  acciones: [
    { texto: "Escribir por WhatsApp", clase: "btn-whatsapp", href: WHATSAPP },
    { texto: "Revisar la cédula", clase: "btn-secundario", ir: "paso-inicio" }
  ]
});

// --- Mostrar el carnet ---
function iniciales(nombre) {
  const partes = nombre.split(" ").filter(Boolean);
  // Primer nombre + primer apellido (penúltima palabra cuando hay dos apellidos)
  const apellido = partes.length >= 3 ? partes[partes.length - 2] : partes[partes.length - 1];
  return (partes[0][0] + (apellido ?? "")[0]).toUpperCase();
}

let carnetActual = null;

// --- Código QR de verificación (en la ventana del botón "Mostrar código QR", no en el carnet) ---
// Lleva a /v/<código>, donde cualquiera puede comprobar que el carnet es válido.
function dibujarQR(codigo) {
  document.querySelectorAll("[data-qr]").forEach(el => {
    el.innerHTML = "";
    if (!codigo || typeof qrcode === "undefined") return;
    const qr = qrcode(0, "M");
    qr.addData(`${location.origin}/v/${codigo}`);
    qr.make();
    const img = new Image();
    img.src = qr.createDataURL(10, 0);
    img.alt = "Código QR para verificar el carnet";
    el.appendChild(img);
  });
}

function mostrarCarnet(carnet, festejar = false, sinConexion = false) {
  carnetActual = carnet;
  // Copia para ver el carnet sin internet (solo si este celular lo recuerda)
  if (!sinConexion && token.leer() === carnet.token) copiaLocal.guardar(carnet);
  const aviso = $("aviso-offline");
  aviso.classList.toggle("oculto", !sinConexion);
  if (sinConexion) {
    const fecha = new Date(carnet.guardado).toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" });
    aviso.innerHTML = `${icono("sin-senal")} <span>Sin conexión. Mostrando el carnet guardado en este celular (actualizado el ${fecha}).</span>`;
  }
  $("btn-cambiar-foto").classList.toggle("oculto", sinConexion);
  dibujarQR(carnet.verificacion);
  $("btn-qr").classList.toggle("oculto", !carnet.verificacion);
  if (festejar) { setTimeout(celebrar, 350); vibrar([30, 50, 30, 50, 60]); }
  const [a, m, d] = carnet.creado.split("-");
  const valores = {
    nombre: carnet.nombre,
    cedula: formatoCedula(carnet.cedula),
    filial: carnet.filial,
    iniciales: iniciales(carnet.nombre),
    emitido: `Emitido: ${d}/${m}/${a}`
  };
  document.querySelectorAll("[data-campo]").forEach(el => {
    el.textContent = valores[el.dataset.campo];
  });
  document.querySelectorAll("[data-foto]").forEach(el => {
    el.classList.toggle("con-foto", Boolean(carnet.foto));
    if (carnet.foto) {
      el.innerHTML = "";
      const img = new Image();
      img.src = carnet.foto;
      img.alt = "Foto de " + carnet.nombre;
      el.appendChild(img);
    } else {
      el.textContent = valores.iniciales;
    }
  });
  $("saludo").textContent = "¡Hola, " + carnet.nombre.split(" ")[0] + "!";
  mostrar("paso-carnet");
}

// --- Enviar formularios ---
async function enviar(form, url, datos) {
  const error = form.querySelector(".error-form");
  const btn = form.querySelector("button[type=submit]");
  const textoBtn = btn.textContent;
  error.classList.add("oculto");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Un momento…';

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });
    const respuesta = await res.json();
    if (respuesta.error) mostrarError(form, respuesta.error);
    return respuesta;
  } catch {
    mostrarError(form, "No se pudo conectar. Revise su internet e intente de nuevo.");
    return {};
  } finally {
    btn.disabled = false;
    btn.textContent = textoBtn;
  }
}

// El aviso de error se quita cuando la persona corrige algo.
document.querySelectorAll("form").forEach(form => form.addEventListener("change", () => {
  form.querySelector(".error-form").classList.add("oculto");
}));

function mostrarError(form, mensaje) {
  const error = form.querySelector(".error-form");
  error.textContent = mensaje;
  error.classList.remove("oculto");
  // El aviso "tiembla" cada vez que aparece, y el celular vibra dos veces
  error.classList.remove("temblar"); void error.offsetWidth; error.classList.add("temblar");
  vibrar([40, 60, 40]);
  error.scrollIntoView({ block: "center", behavior: movimientoReducido() ? "auto" : "smooth" });
}

// estado "ok" → muestra el carnet; "sin-foto" → carnet sin foto: debe agregarla antes de verlo.
function terminar(form, r, recordar) {
  if (recordar) token.guardar(r.carnet.token);
  else token.borrar();
  form.reset();
  fotoCrear.limpiar();
  if (r.estado === "ok") mostrarCarnet(r.carnet, form.id === "form-crear");
  else pedirFoto(r.carnet, false);
}

// --- Agregar o cambiar la foto ---
// cambiar = true: el afiliado quiere cambiar su foto (puede cancelar).
// cambiar = false: su carnet no tiene foto y es obligatorio agregarla para verlo.
let cambiandoFoto = false;

function pedirFoto(carnet, cambiar) {
  carnetActual = carnet;
  cambiandoFoto = cambiar;
  $("foto-titulo").textContent = cambiar ? "Cambiar mi foto" : "Agregue su foto";
  $("foto-texto").textContent = cambiar
    ? "La nueva foto reemplaza a la anterior en todos los celulares donde abra su carnet."
    : `${carnet.nombre.split(" ")[0]}, ahora el carnet lleva la foto de su rostro. Para ver su carnet, primero tómese la foto. Solo se hace una vez.`;
  $("foto-despues").textContent = cambiar ? "Cancelar" : "Salir";
  fotoActualizar.limpiar();
  $("foto-consentimiento").checked = false;
  $("form-foto").querySelector(".error-form").classList.add("oculto");
  mostrar("paso-foto");
}

$("form-foto").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const foto = fotoActualizar.valor();
  if (!foto) return mostrarError(form, "Primero tómese la foto o elíjala de su celular.");
  if (!$("foto-consentimiento").checked) return mostrarError(form, "Marque la casilla de autorización para guardar su foto.");

  const r = await enviar(form, "/api/foto", { token: carnetActual.token, foto, consentimiento: true });
  if (r.estado === "ok") mostrarCarnet(r.carnet, true);
  else if (r.estado === "invalido") {
    token.borrar();
    aviso({
      titulo: "Vuelva a ingresar",
      texto: "No pudimos confirmar su carnet. Ingrese de nuevo con su cédula y fecha de nacimiento.",
      acciones: [{ texto: "Ver mi carnet", clase: "btn-principal", ir: "paso-ingresar" }]
    });
  }
});

$("foto-despues").addEventListener("click", () => {
  if (cambiandoFoto) return mostrarCarnet(carnetActual);
  token.borrar();
  carnetActual = null;
  mostrar("paso-inicio");
});
$("btn-cambiar-foto").addEventListener("click", () => pedirFoto(carnetActual, true));

$("form-ingresar").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const cedula = soloDigitos($("ingresar-cedula").value);
  const nacimiento = fechaIngresar.valor();

  if (cedula.length !== 9) return mostrarError(form, "Escriba su cédula completa (9 dígitos).");
  if (!nacimiento) return mostrarError(form, "Elija el día, el mes y el año de su nacimiento.");

  const r = await enviar(form, "/api/ingresar", { cedula, nacimiento });
  if (r.estado === "ok" || r.estado === "sin-foto") terminar(form, r, $("ingresar-recordar").checked);
  else if (r.estado === "no-afiliado") avisoNoAfiliado();
  else if (r.estado === "fecha-incorrecta") mostrarError(form, "La fecha de nacimiento no coincide con la que registró al crear su carnet.");
  else if (r.estado === "sin-carnet") aviso({
    tipo: "info", simbolo: "mas",
    titulo: "Todavía no ha creado su carnet",
    texto: "Su cédula está en la lista de afiliados, pero aún no ha creado su carnet. Es rápido: solo complete sus datos.",
    acciones: [{ texto: "Crear mi carnet", clase: "btn-principal", ir: "paso-crear" }]
  });
});

$("form-crear").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const cedula = soloDigitos($("crear-cedula").value);
  const nombre = $("crear-nombre").value.trim().replace(/\s+/g, " ");
  const filial = $("crear-filial").value;
  const nacimiento = fechaCrear.valor();
  const foto = fotoCrear.valor();

  if (cedula.length !== 9) return mostrarError(form, "Escriba su cédula completa (9 dígitos).");
  if (nombre.length < 5 || !nombre.includes(" ")) return mostrarError(form, "Escriba su nombre completo (nombre y apellidos).");
  if (!filial) return mostrarError(form, "Elija su filial.");
  if (!nacimiento) return mostrarError(form, "Elija el día, el mes y el año de su nacimiento.");
  if (!foto) return mostrarError(form, "Tómese una foto de su rostro (o elíjala de su celular).");
  if (!$("crear-consentimiento").checked) return mostrarError(form, "Marque la casilla de autorización para guardar su foto.");

  const r = await enviar(form, "/api/crear", { cedula, nombre, filial, nacimiento, foto, consentimiento: true });
  if (r.estado === "ok") terminar(form, r, $("crear-recordar").checked);
  else if (r.estado === "no-afiliado") avisoNoAfiliado();
  else if (r.estado === "ya-existe") aviso({
    tipo: "info", simbolo: "carnet",
    titulo: "Usted ya tiene un carnet",
    texto: "Esta cédula ya tiene un carnet creado. Para verlo, use su cédula y su fecha de nacimiento. Si no fue usted quien lo creó, escríbanos por WhatsApp.",
    acciones: [
      { texto: "Ver mi carnet", clase: "btn-principal", ir: "paso-ingresar" },
      { texto: "Escribir por WhatsApp", clase: "btn-whatsapp", href: WHATSAPP }
    ]
  });
});

// --- Carnet: descarga y salir ---

$("btn-descargar").addEventListener("click", async () => {
  if (typeof html2canvas === "undefined") {
    alert("No se pudo cargar la herramienta de descarga. Puede usar Imprimir → Guardar como PDF.");
    return;
  }
  const canvas = await html2canvas($("carnet-v"), {
    scale: 3,
    backgroundColor: null,
    // En la copia que se convierte en imagen, sin animaciones (si no, el carnet saldría a medio aparecer)
    onclone: doc => doc.body.classList.add("sin-animacion")
  });
  const enlace = document.createElement("a");
  enlace.download = "carnet-adep.png";
  enlace.href = canvas.toDataURL("image/png");
  enlace.click();
});

$("btn-salir").addEventListener("click", () => {
  token.borrar();
  carnetActual = null;
  mostrar("paso-inicio");
});

// --- Carnet en 3D: se inclina siguiendo el dedo y vuelve a su lugar al soltar ---
(() => {
  const marco = $("marco-carnet");
  function inclinar(e) {
    if (movimientoReducido()) return;
    const caja = $("carnet-v").getBoundingClientRect();
    const x = (e.clientX - caja.left) / caja.width - .5;
    const y = (e.clientY - caja.top) / caja.height - .5;
    if (Math.abs(x) > .6 || Math.abs(y) > .6) return soltar();
    marco.style.setProperty("--ry", `${x * 18}deg`);
    marco.style.setProperty("--rx", `${-y * 14}deg`);
    marco.style.setProperty("--luz-x", `${(x + .5) * 100}%`);
    marco.style.setProperty("--luz-y", `${(y + .5) * 100}%`);
    marco.classList.add("inclinado");
  }
  function soltar() {
    marco.classList.remove("inclinado");
    marco.style.setProperty("--rx", "0deg");
    marco.style.setProperty("--ry", "0deg");
  }
  marco.addEventListener("pointermove", inclinar);
  marco.addEventListener("pointerdown", inclinar);
  ["pointerup", "pointerleave", "pointercancel"].forEach(t => marco.addEventListener(t, soltar));
})();

// --- Al abrir la página: si este celular recuerda un carnet, mostrarlo directo ---
async function iniciar() {
  cargarFiliales();
  const guardado = token.leer();
  if (!guardado) return mostrar("paso-inicio");

  try {
    const res = await fetch("/api/carnet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: guardado })
    });
    const r = await res.json();
    if (r.estado === "ok") return mostrarCarnet(r.carnet);
    if (r.estado === "sin-foto") { copiaLocal.borrar(); return pedirFoto(r.carnet, false); }
    if (res.status === 401) token.borrar();
    else if (res.status === 429 || res.status >= 500) throw new Error("servidor");
  } catch {
    // Sin conexión (o el servidor no responde): mostrar la copia guardada en este celular
    const copia = copiaLocal.leer();
    if (copia && copia.token === guardado) return mostrarCarnet(copia, false, true);
  }
  mostrar("paso-inicio");
}

// --- App instalable ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

const instalada = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
let pedidoInstalar = null;

// Android/Chrome avisa cuando la página se puede instalar
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  pedidoInstalar = e;
  $("instalar").classList.remove("oculto");
});
window.addEventListener("appinstalled", () => {
  pedidoInstalar = null;
  $("instalar").classList.add("oculto");
});
// En iPhone no hay aviso automático: se muestran instrucciones
if (esIphone && !instalada()) $("instalar").classList.remove("oculto");

$("btn-instalar").addEventListener("click", async () => {
  if (pedidoInstalar) {
    pedidoInstalar.prompt();
    const { outcome } = await pedidoInstalar.userChoice;
    if (outcome === "accepted") $("instalar").classList.add("oculto");
    pedidoInstalar = null;
  } else if (esIphone) {
    $("dialogo-ios").classList.remove("oculto");
  }
});
$("cerrar-ios").addEventListener("click", () => $("dialogo-ios").classList.add("oculto"));

// --- Ventana del código QR ---
$("btn-qr").addEventListener("click", () => $("dialogo-qr").classList.remove("oculto"));
$("cerrar-qr").addEventListener("click", () => $("dialogo-qr").classList.add("oculto"));
// Cerrar tocando fuera de la ventana o con la tecla Esc
document.querySelectorAll(".dialogo").forEach(d => d.addEventListener("click", e => {
  if (e.target === d) d.classList.add("oculto");
}));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".dialogo").forEach(d => d.classList.add("oculto"));
});

iniciar();
