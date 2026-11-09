// Revisión manual de la limpieza de carnets (la misma que hace sola la consulta diaria de Vercel).
// Normalmente NO hace falta correrlo: /api/despertar la hace todos los días. Sirve para ver el
// estado o para forzarla después de subir una lista.
//
// Uso: npm run limpiar                 (base REAL, lee .env.produccion)
//      npm run limpiar -- --prueba     (base de prueba, lee .env.local)
//
// Reglas (vea lib/limpieza.js): se anota la fecha a quien deja de estar activo, se quita si vuelve,
// y pasados 3 meses se borran su carnet y su foto.

import { conexion, confirmar } from "./entorno.mjs";
import { limpiarCarnets, MESES_SIN_AFILIACION } from "../lib/limpieza.js";

const { env } = conexion();
const r = await limpiarCarnets(env, { borrar: false });

console.log(`Afiliados activos: ${r.activos} · Carnets creados: ${r.carnets}`);
console.log(`  Volvieron a estar activos (se quita la marca): ${r.volvieron.length}`);
console.log(`  Dejaron de estar activos (se anota la fecha de hoy): ${r.nuevos.length}`);
console.log(`  Sin afiliación, todavía dentro de los ${MESES_SIN_AFILIACION} meses: ${r.esperando}`);
console.log(`  Sin afiliación desde hace más de ${MESES_SIN_AFILIACION} meses (se borran): ${r.vencidos.length}`);

if (r.aviso) {
  console.error(`\n${r.aviso}`);
  process.exit(1);
}
if (!r.volvieron.length && !r.nuevos.length && !r.vencidos.length) {
  console.log("\nNo hay nada que cambiar.");
  process.exit(0);
}
const pregunta = r.vencidos.length
  ? `\nSe van a anotar las fechas y BORRAR ${r.vencidos.length} carnet(s) con sus fotos. No se puede deshacer (salvo con un respaldo).`
  : "\nSe van a anotar o quitar fechas (no se borra ningún carnet).";
if (!(await confirmar(pregunta, "SI"))) {
  console.log("Cancelado. No se cambió nada.");
  process.exit(0);
}
const hecho = await limpiarCarnets(env);
console.log(`\nListo: ${hecho.nuevos.length} anotado(s), ${hecho.volvieron.length} desmarcado(s), ${hecho.borrados} borrado(s).`);
