// Vuelve a cargar un respaldo hecho con "npm run respaldo" (datos y fotos).
// Las filas que ya existen se reemplazan por las del respaldo; las demás no se tocan.
//
// Uso: npm run restaurar -- respaldos/<fecha>                (base REAL, lee .env.produccion)
//      npm run restaurar -- respaldos/<fecha> --prueba       (base de prueba, lee .env.local)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { argumentos, conexion, confirmar, produccion } from "./entorno.mjs";

const TABLAS = ["carnet_afiliados", "carnet_filiales", "carnet_carnets"];
const carpeta = argumentos[0];
if (!carpeta || !TABLAS.every(t => existsSync(`${carpeta}/${t}.json`))) {
  console.error("Indique la carpeta del respaldo. Ejemplo: npm run restaurar -- respaldos/2026-11-08-10-30");
  process.exit(1);
}

const { db } = conexion();
if (produccion && !(await confirmar(`Se va a cargar el respaldo ${carpeta} en la base REAL.`, "RESTAURAR"))) {
  console.log("Cancelado. No se cambió nada.");
  process.exit(0);
}

for (const tabla of TABLAS) {
  const filas = JSON.parse(readFileSync(`${carpeta}/${tabla}.json`, "utf8"));
  for (let i = 0; i < filas.length; i += 500) await db.guardar(tabla, filas.slice(i, i + 500));
  console.log(`${tabla}: ${filas.length} fila(s)`);
}

const archivos = existsSync(`${carpeta}/fotos`) ? readdirSync(`${carpeta}/fotos`).filter(f => /^\d{9}\.jpg$/.test(f)) : [];
for (const archivo of archivos) await db.subirFoto(`fotos/${archivo}`, readFileSync(`${carpeta}/fotos/${archivo}`));
console.log(`fotos: ${archivos.length}`);
console.log("\nListo: respaldo restaurado.");
