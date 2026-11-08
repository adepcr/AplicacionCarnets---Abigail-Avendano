// Deja la base de datos de PRUEBA con los datos de ejemplo (para probar con "npm run dev").
// Borra todos los carnets y fotos de esa base. Nunca se usa con la base real.
//
// Uso: npm run db:ejemplo

import { execFileSync } from "node:child_process";
import { conexion, confirmar, produccion } from "./entorno.mjs";

if (produccion) {
  console.error("Este script es solo para la base de datos de prueba.");
  process.exit(1);
}

const { env, db } = conexion();
const esLocal = /\/\/(127\.0\.0\.1|localhost)[:/]/.test(env.SUPABASE_URL);
if (!esLocal && !(await confirmar(
  "Se van a BORRAR todos los carnets y fotos de esta base de datos de prueba.", "BORRAR"))) {
  console.log("Cancelado.");
  process.exit(0);
}

// 1. Lista de afiliados y filiales de ejemplo (revisada con el mismo script que la real)
execFileSync(process.execPath, ["scripts/importar.mjs", "datos/ejemplo-afiliados.csv", "datos/ejemplo-filiales.txt", "--subir"], { stdio: "inherit" });

// 2. Borrar carnets, fotos e intentos
const carnets = await db.select("carnet_carnets", {}, "cedula");
for (const { cedula } of carnets) await db.borrarFoto(`fotos/${cedula}.jpg`);
await db.borrar("carnet_carnets", { cedula: "not.is.null" });
await db.borrar("carnet_intentos", { id: "not.is.null" });

// 3. Un carnet ya creado (sin foto), para probar "Ver mi carnet"
await db.insertar("carnet_carnets", {
  cedula: "102340567",
  nombre: "María Elena Rodríguez Solís",
  filial: "San José",
  nacimiento: "1958-03-14",
  token: "11111111-2222-3333-4444-555555555555",
  creado: "2026-10-27"
});

console.log("Listo: base de prueba con datos de ejemplo (vea la tabla de cédulas de prueba en el README).");
