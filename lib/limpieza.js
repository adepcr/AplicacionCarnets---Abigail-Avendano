// Borrado automático de carnets de quienes dejaron de ser afiliados (política de privacidad, punto 7).
// Lo corre api/despertar.js todos los días (cron de Vercel) y también "npm run limpiar".
//
//   - Carnet cuya cédula NO está activa y no tiene fecha → se anota hoy en "sin_afiliacion_desde".
//   - Carnet cuya cédula volvió a estar activa → se quita la fecha.
//   - Carnet sin afiliación desde hace más de 3 meses → se borran el carnet y la foto.
// Si alguien falta por error en un solo reporte, no pierde su carnet: vuelve a aparecer y se quita la marca.
//
// Freno de seguridad: si de una vez dejan de estar activos muchos carnets (casi siempre es una lista
// incompleta), no se anota ni se borra nada y se devuelve un aviso.

import { supabase } from "./supabase.js";

export const MESES_SIN_AFILIACION = 3;
const POR_PAGINA = 1000;   // Supabase devuelve como máximo 1000 filas por consulta
const LOTE = 100;          // cédulas por cambio, para no armar direcciones muy largas

async function todas(db, tabla, filtros, columnas, orden) {
  const filas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const pagina = await db.select(tabla, { ...filtros, order: orden, limit: String(POR_PAGINA), offset: String(desde) }, columnas);
    filas.push(...pagina);
    if (pagina.length < POR_PAGINA) return filas;
  }
}

async function enLotes(lista, fn) {
  for (let i = 0; i < lista.length; i += LOTE) await fn(lista.slice(i, i + LOTE));
}
const filtroCedulas = lista => ({ cedula: `in.(${lista.join(",")})` });

// Revisa los carnets. Con { borrar: false } solo cuenta (no cambia nada).
// Con { borrar: true } anota/quita fechas y borra los vencidos.
export async function limpiarCarnets(env, { borrar = true, hoy = new Date() } = {}) {
  const db = supabase(env);
  const dia = hoy.toISOString().slice(0, 10);
  const limite = new Date(hoy);
  limite.setUTCMonth(limite.getUTCMonth() - MESES_SIN_AFILIACION);
  const fechaLimite = limite.toISOString().slice(0, 10);

  const activos = new Set((await todas(db, "carnet_afiliados", { activo: "is.true" }, "cedula", "cedula")).map(a => a.cedula));
  const carnets = await todas(db, "carnet_carnets", {}, "cedula,sin_afiliacion_desde", "cedula");

  const sinAfiliacion = c => !activos.has(c.cedula);
  const resultado = {
    activos: activos.size,
    carnets: carnets.length,
    volvieron: carnets.filter(c => !sinAfiliacion(c) && c.sin_afiliacion_desde).map(c => c.cedula),
    nuevos: carnets.filter(c => sinAfiliacion(c) && !c.sin_afiliacion_desde).map(c => c.cedula),
    esperando: carnets.filter(c => sinAfiliacion(c) && c.sin_afiliacion_desde > fechaLimite).length,
    vencidos: carnets.filter(c => sinAfiliacion(c) && c.sin_afiliacion_desde && c.sin_afiliacion_desde <= fechaLimite).map(c => c.cedula),
    aviso: null,
    borrados: 0
  };

  if (activos.size === 0) {
    resultado.aviso = "La lista de afiliados activos está vacía: no se cambió nada.";
  } else if (resultado.nuevos.length > Math.max(50, carnets.length * 0.2)) {
    resultado.aviso = `${resultado.nuevos.length} carnets dejarían de estar activos de una vez: ¿la lista subida está completa? No se cambió nada.`;
  }
  if (!borrar || resultado.aviso) return resultado;

  await enLotes(resultado.volvieron, lote => db.actualizar("carnet_carnets", filtroCedulas(lote), { sin_afiliacion_desde: null }));
  await enLotes(resultado.nuevos, lote => db.actualizar("carnet_carnets", filtroCedulas(lote), { sin_afiliacion_desde: dia }));
  await enLotes(resultado.vencidos, async lote => {
    await db.borrarFotos(lote.map(c => `fotos/${c}.jpg`));
    await db.borrar("carnet_carnets", filtroCedulas(lote));
  });
  resultado.borrados = resultado.vencidos.length;
  return resultado;
}
