// Lee la conexión a Supabase para los scripts de ADEP y para "npm run dev".
//
//   Sin --produccion → archivo .env.local      (base de datos de PRUEBA; la misma que usa "npm run dev")
//   Con --produccion → archivo .env.produccion (base de datos REAL de los afiliados)
//
// Ambos archivos tienen dos líneas y NUNCA se suben a GitHub (están en .gitignore):
//   SUPABASE_URL=https://xxxxxxxx.supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...
// En Vercel los mismos dos valores van en Settings → Environment Variables.

import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { supabase } from "../lib/supabase.js";

export const produccion = process.argv.includes("--produccion") && !process.argv.includes("--prueba");
export const argumentos = process.argv.slice(2).filter(a => !a.startsWith("--"));

const EJEMPLO = { ".env.local": ".env.local.ejemplo", ".env.produccion": ".env.produccion.ejemplo" };

// Lee un archivo de variables (NOMBRE=valor por línea). Termina el programa si no existe.
export function leerVariables(archivo) {
  if (!existsSync(archivo)) {
    console.error(`No existe el archivo ${archivo}. Cópielo de ${EJEMPLO[archivo] ?? archivo + ".ejemplo"} y complete los datos de Supabase.`);
    process.exit(1);
  }
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

export function conexion() {
  const env = leerVariables(produccion ? ".env.produccion" : ".env.local");
  console.log(`Base de datos: ${produccion ? "REAL (producción)" : "de prueba"} → ${env.SUPABASE_URL}`);
  return { env, db: supabase(env) };
}

export async function confirmar(pregunta, palabra) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question(`${pregunta}\nEscriba ${palabra} para continuar: `);
  rl.close();
  return respuesta.trim().toUpperCase() === palabra;
}
