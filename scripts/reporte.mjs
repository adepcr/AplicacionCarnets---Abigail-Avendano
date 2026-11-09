// Saca la lista de cédulas y de filiales del "Reporte de Asociados Activos por Filial" de ADEP.
//
// Cómo usarlo:
//   1. Abra el PDF del reporte en Edge o Chrome, haga clic dentro del documento,
//      toque Ctrl+A (seleccionar todo) y Ctrl+C (copiar).
//   2. Abra el Bloc de notas (notepad datos\reporte.txt), pegue con Ctrl+V y guarde.
//   3. npm run reporte
//
// Crea:
//   datos/afiliados.csv  → solo la columna "cedula" (todas activas, porque el reporte es de activos)
//   datos/filiales.txt   → una filial por línea, tomadas de los encabezados "101 - SAN JOSE"
// Después siga con "npm run importar" y "npm run db:subir", como siempre.
//
// Del reporte solo se usan las cédulas y los nombres de las filiales: los nombres de las personas,
// teléfonos, direcciones y fechas NO se copian a ningún lado.
// ⚠️ datos/reporte.txt tiene datos personales: está excluido de Git y conviene borrarlo al terminar.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const entrada = process.argv[2] ?? "datos/reporte.txt";
const salidaAfiliados = "datos/afiliados.csv";
const salidaFiliales = "datos/filiales.txt";

if (!existsSync(entrada)) {
  console.error(`No existe ${entrada}. Copie el texto del PDF (Ctrl+A, Ctrl+C) y péguelo en ese archivo.`);
  process.exit(1);
}

const lineas = readFileSync(entrada, "utf8").replace(/^﻿/, "").split(/\r?\n/);

// Encabezado de filial: "101 - SAN JOSE" (código de 3 dígitos, guion y nombre, nada más en la línea)
const ENCABEZADO = /^\s*(\d{3})\s*-\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .'()-]*?)\s*$/i;
// Fila de un afiliado: empieza con la cédula de 9 dígitos y sigue con más datos
const FILA = /^\s*(\d{9})\s+\S/;
// Algo que empieza como una identificación pero no tiene 9 dígitos (DIMEX, errores de digitación)
const OTRA_ID = /^\s*(\d{10,12})\s+\d{4}-\d{4}/;

const filiales = new Map();        // código → nombre
const porFilial = new Map();       // nombre → cantidad de cédulas
const cedulas = new Map();         // cédula → filial (la primera en que aparece)
const repetidas = [];
const otras = [];
let filialActual = null;

lineas.forEach((linea, i) => {
  const fila = linea.match(FILA);
  if (fila) {
    const cedula = fila[1];
    if (cedulas.has(cedula)) { repetidas.push(i + 1); return; }
    cedulas.set(cedula, filialActual);
    porFilial.set(filialActual, (porFilial.get(filialActual) ?? 0) + 1);
    return;
  }
  if (OTRA_ID.test(linea)) { otras.push(i + 1); return; }
  const encabezado = linea.match(ENCABEZADO);
  if (encabezado) {
    const nombre = encabezado[2].replace(/\s+/g, " ").trim();
    filiales.set(encabezado[1], nombre);
    filialActual = nombre;
  }
});

if (cedulas.size === 0) {
  console.error("No se encontró ninguna cédula. Revise que el archivo tenga el texto copiado del PDF.");
  process.exit(1);
}

writeFileSync(salidaAfiliados, "cedula\n" + [...cedulas.keys()].join("\n") + "\n");
writeFileSync(salidaFiliales, [...new Set(filiales.values())].join("\n") + "\n");

console.log(`Cédulas encontradas: ${cedulas.size}`);
console.log(`Filiales encontradas: ${filiales.size}\n`);
console.log("Cédulas por filial (compárelas con los totales del PDF):");
for (const [codigo, nombre] of [...filiales].sort()) {
  console.log(`  ${codigo} - ${nombre}: ${porFilial.get(nombre) ?? 0}`);
}
if (porFilial.get(null)) console.log(`  (antes del primer encabezado de filial): ${porFilial.get(null)}`);
if (repetidas.length) console.log(`\nAviso: ${repetidas.length} cédula(s) aparecen más de una vez; se cuentan una sola vez.`);
if (otras.length) {
  console.log(`\nAviso: ${otras.length} fila(s) tienen una identificación que no es de 9 dígitos (por ejemplo DIMEX)`);
  console.log(`y no se incluyeron. Líneas de ${entrada}: ${otras.slice(0, 20).join(", ")}${otras.length > 20 ? "…" : ""}`);
}
console.log(`\nListo: se crearon ${salidaAfiliados} y ${salidaFiliales}.`);
console.log("Revise filiales.txt (puede corregir nombres o tildes) y siga con: npm run importar");
