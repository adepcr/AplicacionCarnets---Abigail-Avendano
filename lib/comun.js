// Funciones compartidas por las rutas de /api y /v.
// Los datos y las fotos están en Supabase (vea lib/supabase.js y basedatos/supabase.sql).

import { supabase } from "./supabase.js";

const MAX_INTENTOS = 10;               // intentos fallidos permitidos...
const VENTANA_MS = 15 * 60 * 1000;     // ...cada 15 minutos por IP

export function json(datos, status = 200) {
  return Response.json(datos, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export const MENSAJE_BLOQUEO = "Demasiados intentos. Espere 15 minutos e intente de nuevo.";

const MAX_CUERPO = 1_000_000;          // ~1 MB: alcanza para los datos + una foto comprimida

export async function leerCuerpo(request) {
  try {
    const texto = await request.text();
    if (texto.length > MAX_CUERPO) return {};
    return JSON.parse(texto);
  } catch {
    return {};
  }
}

// Cédula nacional (9 dígitos) o identificación de persona extranjera: número de residencia antiguo
// (10 dígitos) o DIMEX (11 o 12). Siempre sin guiones.
export const ID_VALIDA = /^\d{9,12}$/;
export const MENSAJE_CEDULA = "Ingrese su cédula (9 dígitos) o su identificación de residente (10 a 12 dígitos).";

export function leerCedula(valor) {
  const cedula = String(valor ?? "").replace(/\D/g, "");
  return ID_VALIDA.test(cedula) ? cedula : null;
}

// Acepta AAAA-MM-DD y verifica que la fecha exista (por ejemplo, rechaza 30 de febrero).
export function leerFecha(valor) {
  const texto = String(valor ?? "");
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [a, mes, d] = m.slice(1).map(Number);
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  const valida = fecha.getUTCFullYear() === a && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === d;
  return valida && a >= 1900 && fecha < new Date() ? texto : null;
}

// Vercel pone la IP real del celular en "x-real-ip" (y al inicio de "x-forwarded-for").
function ip(request) {
  const h = request.headers;
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

const haceUnRato = () => new Date(Date.now() - VENTANA_MS).toISOString();

export async function estaBloqueado(env, request) {
  const fallidos = await supabase(env).contar("carnet_intentos", {
    ip: `eq.${ip(request)}`,
    fecha: `gt.${haceUnRato()}`
  });
  return fallidos >= MAX_INTENTOS;
}

export async function registrarFallo(env, request) {
  const db = supabase(env);
  await db.insertar("carnet_intentos", { ip: ip(request) });
  await db.borrar("carnet_intentos", { fecha: `lt.${haceUnRato()}` });   // limpiar los viejos
}

export async function esAfiliadoActivo(env, cedula) {
  return Boolean(await supabase(env).uno("carnet_afiliados", { cedula: `eq.${cedula}`, activo: "is.true" }, "cedula"));
}

// Carnet que cumple el filtro (por token o por código de verificación), con "activo" true/false
// según la lista de afiliados en este momento. null si no existe.
export async function buscarCarnet(env, filtro) {
  const db = supabase(env);
  const carnet = await db.uno("carnet_carnets", filtro);
  if (!carnet) return null;
  carnet.activo = await esAfiliadoActivo(env, carnet.cedula);
  return carnet;
}

// --- Fotos ---
// El celular envía la foto ya recortada y comprimida como "data:image/jpeg;base64,...".
const PREFIJO_FOTO = "data:image/jpeg;base64,";
const FOTO_MIN = 2_000;                // bytes
const FOTO_MAX = 200_000;              // el celular las envía de ~30 KB; esto es solo un tope de seguridad

export const MENSAJE_CONSENTIMIENTO = "Para guardar su foto debe marcar la casilla de autorización.";

// Devuelve los bytes de la foto si es un JPEG válido de tamaño razonable, o null.
export function leerFoto(valor) {
  if (typeof valor !== "string" || !valor.startsWith(PREFIJO_FOTO)) return null;
  try {
    const binario = atob(valor.slice(PREFIJO_FOTO.length));
    if (binario.length < FOTO_MIN || binario.length > FOTO_MAX) return null;
    const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
    const esJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return esJpeg ? bytes : null;
  } catch {
    return null;
  }
}

const claveFoto = cedula => `fotos/${cedula}.jpg`;

// Guarda (o reemplaza) la foto en Supabase Storage y anota cuándo se subió y cuándo autorizó.
export async function guardarFoto(env, cedula, bytes) {
  const db = supabase(env);
  await db.subirFoto(claveFoto(cedula), bytes);
  const ahora = new Date().toISOString();
  await db.actualizar("carnet_carnets", { cedula: `eq.${cedula}` }, { foto: ahora, consentimiento: ahora });
}

export async function leerFotoGuardada(env, carnet) {
  if (!carnet.foto) return null;
  const bytes = await supabase(env).bajarFoto(claveFoto(carnet.cedula));
  if (!bytes) return null;
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return PREFIJO_FOTO + btoa(binario);
}

// --- Código de verificación (QR) ---
// Es público (va en el QR), por eso es distinto del token, que es secreto.
const LETRAS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";   // sin 0/O ni 1/I para que no se confundan

function nuevoCodigo() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, b => LETRAS[b % LETRAS.length]).join("");
}

// Los carnets reciben su código la primera vez que se muestran.
async function codigoVerificacion(env, carnet) {
  if (carnet.verificacion) return carnet.verificacion;
  const db = supabase(env);
  await db.actualizar("carnet_carnets", { cedula: `eq.${carnet.cedula}`, verificacion: "is.null" }, { verificacion: nuevoCodigo() });
  const fila = await db.uno("carnet_carnets", { cedula: `eq.${carnet.cedula}` }, "verificacion");
  return fila.verificacion;
}

// Token de "recordar en este celular": un UUID (se valida antes de consultar la base de datos)
export const tokenValido = valor => typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

export const codigoValido = valor => typeof valor === "string" && /^[2-9A-HJ-NP-Z]{12}$/.test(valor);

// Datos que se envían al navegador para dibujar el carnet.
// La foto va incluida, así cada celular ve siempre la más reciente.
export async function datosCarnet(env, carnet) {
  return {
    cedula: carnet.cedula,
    nombre: carnet.nombre,
    filial: carnet.filial,
    creado: carnet.creado,
    token: carnet.token,
    verificacion: await codigoVerificacion(env, carnet),
    foto: await leerFotoGuardada(env, carnet)
  };
}
