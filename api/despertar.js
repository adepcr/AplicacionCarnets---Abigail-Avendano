// GET /api/despertar  → Vercel la llama sola una vez al día (vea "crons" en vercel.json).
//   1. Hace una consulta a Supabase: en el plan gratis, Supabase pausa los proyectos que pasan
//      7 días sin uso; con esta consulta diaria el proyecto nunca queda inactivo.
//   2. Borra los carnets y fotos de quienes llevan más de 3 meses sin ser afiliados activos
//      (política de privacidad, punto 7). Vea lib/limpieza.js.
//
// Si en Vercel se define la variable CRON_SECRET, Vercel la envía al llamar y aquí se exige.
// Sin CRON_SECRET, cualquiera puede llamarla: solo hace la limpieza diaria, que no depende de quién llame.

import { json } from "../lib/comun.js";
import { limpiarCarnets } from "../lib/limpieza.js";

export async function GET(request) {
  const env = process.env;
  if (env.CRON_SECRET && request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: "No autorizado" }, 401);
  }
  let r;
  try {
    r = await limpiarCarnets(env);
  } catch (error) {
    // La consulta a Supabase ya se hizo (eso evita la pausa). Se avisa del error en Vercel → Logs.
    console.error("Limpieza diaria con error:", error.message);
    return json({ ok: false, error: "La limpieza diaria falló; vea Vercel → Logs." }, 500);
  }
  const resumen = {
    ok: !r.aviso,
    afiliados: r.activos,
    carnets: r.carnets,
    marcados_hoy: r.nuevos.length,
    volvieron: r.volvieron.length,
    en_espera: r.esperando,
    borrados: r.borrados
  };
  if (r.aviso) {
    resumen.aviso = r.aviso;
    console.error("Limpieza diaria detenida:", r.aviso);   // aparece en rojo en Vercel → Logs
  } else {
    console.log("Limpieza diaria:", JSON.stringify(resumen));
  }
  return json(resumen);
}
