// Respaldo COMPLETO del proyecto de Supabase de ADEP (inventario-archivo), de una sola vez.
// En ese proyecto viven varios sistemas: Inventario del Archivo, Carnet, ADEP Vota (grupal, tablas vota_)
// y el prototipo de votaciones de Abigail (tablas votab_). El plan gratis NO guarda respaldos automáticos:
// haga este respaldo al menos una vez al mes.
//
// Uso: npm run respaldo-completo                 (base REAL, lee .env.produccion)
//      npm run respaldo-completo -- --prueba     (base de prueba, lee .env.local)
//
// Queda así, en respaldos/completo-<fecha>/:
//   tablas/<tabla>.json      todas las filas de cada tabla (inventario, carnet_, vota_, votab_ y las que haya)
//   usuarios.json            las cuentas de usuario (correo, fechas; sin contraseñas)
//   archivos/<bucket>/...    todos los archivos guardados (hoy, las fotos del carnet)
//   RESUMEN.txt              qué se guardó, cuántas filas y archivos, y si algo no se pudo leer
//
// ⚠️ Tiene datos personales (cédulas, nombres, fotos): guárdelo cifrado o en un lugar con acceso restringido.
// La carpeta respaldos/ está excluida de Git para que nunca se suba a GitHub.
//
// Para restaurar: cada sistema tiene su forma (vea RESUMEN.txt). El carnet: npm run restaurar.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { conexion } from "./entorno.mjs";

const POR_PAGINA = 1000;   // Supabase devuelve como máximo 1000 filas por consulta

// Tablas conocidas de cada sistema, por si Supabase no devuelve la lista completa
const CONOCIDAS = {
  "Inventario del Archivo": ["archivos", "historial", "prestamos", "roles_usuario"],
  "Carnet": ["carnet_afiliados", "carnet_carnets", "carnet_filiales", "carnet_intentos"],
  "ADEP Vota (grupal)": ["vota_admins", "vota_afiliados", "vota_alertas", "vota_auditoria", "vota_ayuda", "vota_codigos",
    "vota_config", "vota_conteos", "vota_cuentas", "vota_eliminados", "vota_intentos", "vota_participacion", "vota_polls",
    "vota_restaurables", "vota_sesiones", "vota_solicitudes", "vota_votos"],
  "Prototipo de votaciones (Abigail)": ["votab_admins", "votab_alertas", "votab_auditoria", "votab_codigos", "votab_config",
    "votab_conteos", "votab_cuentas", "votab_eliminados", "votab_intentos", "votab_participacion", "votab_polls",
    "votab_sesiones", "votab_votos"]
};
function sistemaDe(tabla) {
  for (const [sistema, tablas] of Object.entries(CONOCIDAS)) if (tablas.includes(tabla)) return sistema;
  if (tabla.startsWith("votab_")) return "Prototipo de votaciones (Abigail)";
  if (tabla.startsWith("vota_")) return "ADEP Vota (grupal)";
  if (tabla.startsWith("carnet_")) return "Carnet";
  return "Otras tablas";
}

const { env } = conexion();
const url = String(env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const clave = String(env.SUPABASE_SECRET_KEY ?? "").trim();
const cabeceras = { apikey: clave };
if (clave.startsWith("eyJ")) cabeceras.Authorization = `Bearer ${clave}`;

async function pedir(ruta, opciones = {}) {
  const r = await fetch(url + ruta, { ...opciones, headers: { ...cabeceras, ...(opciones.headers ?? {}) } });
  if (!r.ok) {
    const detalle = (await r.text().catch(() => "")).slice(0, 200);
    const error = new Error(`Supabase respondió ${r.status}: ${detalle}`);
    error.status = r.status;
    throw error;
  }
  return r;
}

const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const carpeta = `respaldos/completo-${fecha}`;
mkdirSync(`${carpeta}/tablas`, { recursive: true });
const resumen = [`Respaldo completo de Supabase — ${new Date().toLocaleString("es-CR")}`, `Proyecto: ${url}`, ""];
const problemas = [];

// 1. Tablas: la lista que da Supabase (con su clave principal, para ordenar) más las conocidas
const llaves = {};
try {
  const r = await pedir("/rest/v1/", { headers: { Accept: "application/openapi+json" } });
  const definiciones = (await r.json()).definitions ?? {};
  for (const [tabla, def] of Object.entries(definiciones)) {
    const pk = Object.entries(def.properties ?? {})
      .filter(([, p]) => String(p.description ?? "").includes("<pk/>")).map(([c]) => c);
    llaves[tabla] = pk.length ? pk : Object.keys(def.properties ?? {}).slice(0, 1);
  }
} catch (e) {
  problemas.push(`No se pudo pedir la lista de tablas a Supabase (${e.message}); se usó la lista conocida.`);
}
const tablas = [...new Set([...Object.keys(llaves), ...Object.values(CONOCIDAS).flat()])].sort();

const porSistema = {};
let totalFilas = 0;
for (const tabla of tablas) {
  const orden = (llaves[tabla] ?? []).map(c => `${c}.asc`).join(",");
  const filas = [];
  try {
    for (let desde = 0; ; desde += POR_PAGINA) {
      const p = new URLSearchParams({ select: "*", limit: String(POR_PAGINA), offset: String(desde) });
      if (orden) p.set("order", orden);
      const pagina = await (await pedir(`/rest/v1/${tabla}?${p}`)).json();
      filas.push(...pagina);
      if (pagina.length < POR_PAGINA) break;
    }
  } catch (e) {
    // 404: la tabla no existe en este proyecto (es de la lista conocida); no es un problema
    if (e.status !== 404 && !/PGRST205|42P01/.test(e.message)) problemas.push(`${tabla}: no se pudo leer (${e.message})`);
    continue;
  }
  writeFileSync(`${carpeta}/tablas/${tabla}.json`, JSON.stringify(filas, null, 1));
  (porSistema[sistemaDe(tabla)] ??= []).push(`${tabla}: ${filas.length}`);
  totalFilas += filas.length;
  console.log(`${tabla}: ${filas.length} fila(s)`);
}
resumen.push(`TABLAS (${totalFilas} filas en total)`);
for (const sistema of [...Object.keys(CONOCIDAS), "Otras tablas"]) {
  if (porSistema[sistema]) resumen.push(`  ${sistema}`, ...porSistema[sistema].map(t => `    ${t}`));
}
resumen.push("");

// 2. Cuentas de usuario (sin contraseñas)
try {
  const usuarios = [];
  for (let pagina = 1; ; pagina++) {
    const datos = await (await pedir(`/auth/v1/admin/users?page=${pagina}&per_page=${POR_PAGINA}`)).json();
    const lote = datos.users ?? [];
    usuarios.push(...lote);
    if (lote.length < POR_PAGINA) break;
  }
  writeFileSync(`${carpeta}/usuarios.json`, JSON.stringify(usuarios, null, 1));
  resumen.push(`CUENTAS DE USUARIO: ${usuarios.length}`, "");
  console.log(`cuentas de usuario: ${usuarios.length}`);
} catch (e) {
  problemas.push(`Cuentas de usuario: no se pudieron leer (${e.message}). Se ven en Supabase → Authentication → Users.`);
}

// 3. Archivos guardados (Storage): todos los buckets, con sus carpetas
async function listar(bucket, prefijo = "") {
  const encontrados = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const lote = await (await pedir(`/storage/v1/object/list/${bucket}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefijo, limit: POR_PAGINA, offset: desde, sortBy: { column: "name", order: "asc" } })
    })).json();
    for (const item of lote) {
      const ruta = prefijo ? `${prefijo}/${item.name}` : item.name;
      if (item.id === null) encontrados.push(...await listar(bucket, ruta));   // es una carpeta
      else encontrados.push(ruta);
    }
    if (lote.length < POR_PAGINA) break;
  }
  return encontrados;
}
resumen.push("ARCHIVOS GUARDADOS");
try {
  const buckets = await (await pedir("/storage/v1/bucket")).json();
  if (!buckets.length) resumen.push("  (no hay buckets)");
  for (const { id: bucket } of buckets) {
    const rutas = await listar(bucket);
    let bajados = 0;
    for (const ruta of rutas) {
      try {
        const bytes = new Uint8Array(await (await pedir(
          `/storage/v1/object/authenticated/${bucket}/${ruta.split("/").map(encodeURIComponent).join("/")}`)).arrayBuffer());
        const destino = `${carpeta}/archivos/${bucket}/${ruta}`;
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, bytes);
        bajados++;
      } catch (e) {
        problemas.push(`Archivo ${bucket}/${ruta}: no se pudo bajar (${e.message})`);
      }
    }
    resumen.push(`  ${bucket}: ${bajados} de ${rutas.length} archivo(s)`);
    console.log(`archivos en ${bucket}: ${bajados} de ${rutas.length}`);
  }
} catch (e) {
  problemas.push(`Archivos: no se pudo leer la lista (${e.message})`);
}
resumen.push("");

resumen.push("CÓMO RESTAURAR",
  "  Carnet: npm run restaurar -- <carpeta de un respaldo del carnet> (o vuelva a subir sus tablas carnet_ y las fotos).",
  "  Inventario, ADEP Vota y el prototipo: primero se corre su archivo SQL en Supabase → SQL Editor y luego",
  "  se cargan las filas de tablas/<tabla>.json (Supabase → Table Editor → Insert → Import data, o con la API).",
  "  Pida ayuda a TI antes de restaurar: cargar datos sobre una base en uso puede duplicar o reemplazar filas.", "");
resumen.push(problemas.length ? `⚠️ AVISOS (${problemas.length})` : "Sin avisos: todo se leyó bien.", ...problemas.map(p => `  - ${p}`));
writeFileSync(`${carpeta}/RESUMEN.txt`, resumen.join("\n") + "\n");

console.log(problemas.length ? `\n⚠️ ${problemas.length} aviso(s): vea ${carpeta}/RESUMEN.txt` : "");
console.log(`Listo: respaldo completo guardado en ${carpeta}/`);
