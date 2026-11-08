// Revisa la lista de afiliados y de filiales y la sube a Supabase.
//
// Uso:
//   node scripts/importar.mjs <afiliados.csv> <filiales.txt>                  → solo revisa, no sube nada
//   node scripts/importar.mjs <afiliados.csv> <filiales.txt> --subir          → sube a la base de PRUEBA
//   node scripts/importar.mjs <afiliados.csv> <filiales.txt> --subir --produccion → sube a la base REAL
//
// afiliados.csv: el Excel de ADEP guardado como CSV. Solo se necesita la columna "cedula"
//   (con o sin guiones). Si tiene una columna "activo" (1 / sí = activo, 0 / no = inactivo),
//   también se usa. Cualquier otra columna se ignora.
// filiales.txt: una filial por línea.
//
// Las listas que suba REEMPLAZAN a las anteriores, en un solo paso (si algo falla no cambia nada).
// Los carnets que ya crearon los afiliados se conservan; si una cédula deja de estar en la lista
// (o queda inactiva), su carnet deja de mostrarse.

import { readFileSync } from "node:fs";
import { argumentos, conexion, confirmar, produccion } from "./entorno.mjs";

const [archivoAfiliados, archivoFiliales] = argumentos;
const subir = process.argv.includes("--subir");
if (!archivoAfiliados || !archivoFiliales) {
  console.error("Uso: node scripts/importar.mjs <afiliados.csv> <filiales.txt> [--subir] [--produccion]");
  process.exit(1);
}

const leer = archivo => readFileSync(archivo, "utf8").replace(/^﻿/, "");
const sinTildes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function leerCsv(contenido) {
  // Excel en español suele separar con ";" en vez de ",".
  const primeraLinea = contenido.split(/\r?\n/, 1)[0];
  const separador = primeraLinea.split(";").length > primeraLinea.split(",").length ? ";" : ",";

  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i];
    if (entreComillas) {
      if (c === '"' && contenido[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && contenido[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila);
      fila = []; campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v.trim() !== ""));
}

function normalizarActivo(valor) {
  const v = sinTildes(valor ?? "");
  if (v === "" || ["1", "si", "s", "activo", "true", "x"].includes(v)) return 1;
  if (["0", "no", "n", "inactivo", "false"].includes(v)) return 0;
  return null;
}

const errores = [];

// --- Afiliados ---
const [titulos, ...filas] = leerCsv(leer(archivoAfiliados));
const columnas = titulos.map(sinTildes);
const colCedula = columnas.indexOf("cedula");
const colActivo = columnas.indexOf("activo");

if (colCedula === -1) {
  console.error(`Falta la columna "cedula". Títulos encontrados: ${titulos.join(", ")}`);
  process.exit(1);
}

const afiliados = new Map();
filas.forEach((f, i) => {
  const linea = i + 2;
  const original = f[colCedula] ?? "";
  const cedula = original.replace(/\D/g, "");
  const activo = colActivo === -1 ? 1 : normalizarActivo(f[colActivo]);

  if (cedula.length !== 9) return errores.push(`afiliados, línea ${linea}: cédula inválida "${original}"`);
  if (activo === null) return errores.push(`afiliados, línea ${linea}: valor de "activo" no reconocido "${f[colActivo]}"`);
  if (afiliados.has(cedula)) return errores.push(`afiliados, línea ${linea}: cédula repetida ${original}`);
  afiliados.set(cedula, activo);
});

// --- Filiales ---
const filiales = [...new Set(
  leer(archivoFiliales).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
)];
if (filiales.length === 0) errores.push("filiales: el archivo está vacío");

if (errores.length) {
  console.error(`Se encontraron ${errores.length} problema(s). Corríjalos y vuelva a intentar:\n`);
  errores.forEach(e => console.error("  - " + e));
  process.exit(1);
}

const activos = [...afiliados.values()].filter(Boolean).length;
console.log(`Revisión correcta: ${afiliados.size} cédula(s) (${activos} activas) y ${filiales.length} filial(es).`);

if (!subir) {
  console.log("No se subió nada. Para subir la lista use: npm run db:subir (base real) o npm run db:subir-prueba.");
  process.exit(0);
}

const { db } = conexion();
if (produccion && !(await confirmar(
  `Se va a REEMPLAZAR la lista de afiliados y filiales de la base REAL por la del archivo.`, "SUBIR"))) {
  console.log("Cancelado. No se cambió nada.");
  process.exit(0);
}
const resultado = await db.funcion("carnet_reemplazar_listas", {
  afiliados: [...afiliados].map(([cedula, activo]) => ({ cedula, activo: Boolean(activo) })),
  filiales
});
console.log(`Listo: la base de datos ahora tiene ${resultado.afiliados} afiliado(s) (${resultado.activos} activos) y ${resultado.filiales} filial(es).`);
