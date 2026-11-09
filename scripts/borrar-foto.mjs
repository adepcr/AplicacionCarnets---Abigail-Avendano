// Borra la foto de un afiliado (por ejemplo, si subió una foto inadecuada).
// La próxima vez que abra su carnet, la página le pedirá tomarse una foto nueva.
//
// Uso:   npm run borrar-foto -- 1-0234-0567              (base REAL)
//        npm run borrar-foto -- 1-0234-0567 --prueba     (base de prueba)

import { argumentos, conexion } from "./entorno.mjs";

const cedula = String(argumentos[0] ?? "").replace(/\D/g, "");
if (!/^(\d{9}|\d{11,12})$/.test(cedula)) {
  console.error("Escriba la cédula del afiliado. Ejemplo: npm run borrar-foto -- 1-0234-0567");
  process.exit(1);
}

const { db } = conexion();
const cambiados = await db.actualizar("carnet_carnets", { cedula: `eq.${cedula}` }, { foto: null });
if (cambiados.length === 0) {
  console.error(`No hay ningún carnet con la cédula ${cedula}.`);
  process.exit(1);
}
await db.borrarFoto(`fotos/${cedula}.jpg`);
console.log(`Listo: se borró la foto de la cédula ${cedula}. Se le pedirá una nueva al abrir su carnet.`);
