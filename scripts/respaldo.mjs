// Descarga una copia de los datos y las fotos del carnet a la carpeta respaldos/<fecha>/.
// El plan gratis de Supabase NO guarda respaldos automáticos: haga uno al menos una vez al mes.
//
// Uso: npm run respaldo                 (base REAL, lee .env.produccion)
//      npm run respaldo -- --prueba     (base de prueba, lee .env.local)
//
// Queda así:
//   respaldos/<fecha>/carnet_afiliados.json, carnet_filiales.json, carnet_carnets.json
//   respaldos/<fecha>/fotos/<cedula>.jpg
// Para restaurarlo: npm run restaurar -- respaldos/<fecha>
//
// ⚠️ Los respaldos tienen datos personales de los afiliados: guárdelos en un lugar seguro.
// La carpeta respaldos/ está excluida de Git para que nunca se suba a GitHub.

import { mkdirSync, writeFileSync } from "node:fs";
import { conexion } from "./entorno.mjs";

const TABLAS = { carnet_afiliados: "cedula", carnet_filiales: "nombre", carnet_carnets: "cedula" };
const POR_PAGINA = 1000;   // Supabase devuelve como máximo 1000 filas por consulta

const { db } = conexion();
const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const carpeta = `respaldos/${fecha}`;
mkdirSync(`${carpeta}/fotos`, { recursive: true });

const datos = {};
for (const [tabla, orden] of Object.entries(TABLAS)) {
  const filas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const pagina = await db.select(tabla, { order: orden, limit: String(POR_PAGINA), offset: String(desde) });
    filas.push(...pagina);
    if (pagina.length < POR_PAGINA) break;
  }
  writeFileSync(`${carpeta}/${tabla}.json`, JSON.stringify(filas, null, 1));
  datos[tabla] = filas;
  console.log(`${tabla}: ${filas.length} fila(s)`);
}

let fotos = 0, faltantes = 0;
for (const carnet of datos.carnet_carnets.filter(c => c.foto)) {
  const bytes = await db.bajarFoto(`fotos/${carnet.cedula}.jpg`);
  if (bytes) { writeFileSync(`${carpeta}/fotos/${carnet.cedula}.jpg`, bytes); fotos++; }
  else faltantes++;
}
console.log(`fotos: ${fotos}${faltantes ? ` (${faltantes} carnet(s) dicen tener foto pero no se encontró)` : ""}`);
console.log(`\nListo: respaldo guardado en ${carpeta}/`);
