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
const ENCABEZADO = /^\s*(\d{3})\s*-\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ0-9 .,'()\/-]*?)\s*$/i;
// Fila de un afiliado: empieza con la cédula de 9 dígitos (sola o seguida de más datos)
const FILA = /^\s*(\d{9})(\s|$)/;
// A veces, al copiar, la cédula queda en medio de la línea: se reconoce porque sigue el teléfono
const FILA_MEDIO = /(?:^|\s)(\d{9})\s+\d{4}-\d{4}(\s|$)/;
// Algo que empieza como una identificación pero no tiene 9 dígitos (DIMEX, errores de digitación)
const OTRA_ID = /^\s*(\d{5,8}|\d{10,13})(\s|$)/;
// Totales que trae el PDF: "Total de socios por filial: 38" y "Numero de Asociado en el reporte: 8703"
// (el número puede quedar en la misma línea o en la siguiente al copiar)
const TOTAL_FILIAL = /total de socios por filial:?\s*(\d+)?/i;
const TOTAL_REPORTE = /n[uú]mero de asociados? en el reporte:?\s*(\d+)?/i;

const filiales = new Map();        // código → nombre
const filas = new Map();           // código → filas de personas encontradas (incluye repetidas y otras ids)
const totalesPdf = new Map();      // código → total que dice el PDF
const cedulas = new Map();         // cédula → código de filial (la primera en que aparece)
const repetidas = [];
const otras = [];
const enMedio = [];
let filialActual = null;
let totalReporte = null;
let esperando = null;              // "filial" o "reporte" si el número viene en la línea siguiente

const sumarFila = () => filas.set(filialActual, (filas.get(filialActual) ?? 0) + 1);

lineas.forEach((linea, i) => {
  if (esperando) {
    const n = linea.match(/^\s*(\d+)\s*$/);
    if (n) {
      if (esperando === "filial") totalesPdf.set(filialActual, Number(n[1]));
      else totalReporte = Number(n[1]);
      esperando = null;
      return;
    }
    if (linea.trim()) esperando = null;
  }
  const tf = linea.match(TOTAL_FILIAL);
  if (tf) { if (tf[1]) totalesPdf.set(filialActual, Number(tf[1])); else esperando = "filial"; return; }
  const tr = linea.match(TOTAL_REPORTE);
  if (tr) { if (tr[1]) totalReporte = Number(tr[1]); else esperando = "reporte"; return; }

  let fila = linea.match(FILA);
  if (!fila && (fila = linea.match(FILA_MEDIO))) enMedio.push(i + 1);
  if (fila) {
    sumarFila();
    const cedula = fila[1];
    if (cedulas.has(cedula)) { repetidas.push(i + 1); return; }
    cedulas.set(cedula, filialActual);
    return;
  }
  if (OTRA_ID.test(linea)) { sumarFila(); otras.push(i + 1); return; }
  const encabezado = linea.match(ENCABEZADO);
  if (encabezado) {
    filiales.set(encabezado[1], encabezado[2].replace(/\s+/g, " ").trim());
    filialActual = encabezado[1];
  }
});

if (cedulas.size === 0) {
  console.error("No se encontró ninguna cédula. Revise que el archivo tenga el texto copiado del PDF.");
  process.exit(1);
}

writeFileSync(salidaAfiliados, "cedula\n" + [...cedulas.keys()].join("\n") + "\n");
writeFileSync(salidaFiliales, [...new Set(filiales.values())].join("\n") + "\n");

console.log(`Cédulas encontradas: ${cedulas.size}`);
console.log(`Filiales encontradas: ${filiales.size}`);

// Comparación con los totales del PDF
const totalFilas = [...filas.values()].reduce((a, b) => a + b, 0);
if (totalReporte !== null) {
  console.log(`\nEl PDF dice ${totalReporte} asociado(s); se leyeron ${totalFilas} fila(s) de personas` +
    (totalFilas === totalReporte ? " → coincide." : ` → DIFERENCIA de ${totalReporte - totalFilas}.`));
}
const diferentes = [...filiales.keys()].filter(c => totalesPdf.has(c) && totalesPdf.get(c) !== (filas.get(c) ?? 0));
const sinTotal = [...filiales.keys()].filter(c => !totalesPdf.has(c));
if (totalesPdf.size) {
  if (diferentes.length === 0) console.log("Todas las filiales coinciden con su total del PDF.");
  else {
    console.log(`\nFiliales que NO coinciden con su total del PDF (${diferentes.length}):`);
    for (const c of diferentes) console.log(`  ${c} - ${filiales.get(c)}: PDF ${totalesPdf.get(c)}, leídas ${filas.get(c) ?? 0}`);
  }
  if (sinTotal.length) console.log(`Filiales sin total en el texto copiado: ${sinTotal.join(", ")}`);
}

console.log("\nCédulas por filial:");
for (const [codigo, nombre] of [...filiales].sort()) {
  const unicas = [...cedulas.values()].filter(c => c === codigo).length;
  console.log(`  ${codigo} - ${nombre}: ${unicas}`);
}
const sinFilial = [...cedulas.values()].filter(c => c === null).length;
if (sinFilial) console.log(`  (antes del primer encabezado de filial): ${sinFilial}`);
if (repetidas.length) console.log(`\nAviso: ${repetidas.length} cédula(s) aparecen más de una vez; se cuentan una sola vez. Líneas: ${repetidas.slice(0, 20).join(", ")}`);
if (enMedio.length) console.log(`\nAviso: ${enMedio.length} cédula(s) estaban en medio de la línea y se incluyeron. Líneas: ${enMedio.slice(0, 20).join(", ")}`);
if (otras.length) {
  console.log(`\nAviso: ${otras.length} fila(s) tienen una identificación que no es de 9 dígitos (por ejemplo DIMEX)`);
  console.log(`y no se incluyeron. Líneas de ${entrada}: ${otras.slice(0, 20).join(", ")}${otras.length > 20 ? "…" : ""}`);
}
console.log(`\nListo: se crearon ${salidaAfiliados} y ${salidaFiliales}.`);
console.log("Revise filiales.txt (puede corregir nombres o tildes) y siga con: npm run importar");
