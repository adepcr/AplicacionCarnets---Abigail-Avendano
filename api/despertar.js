// GET /api/despertar  → consulta pequeña a Supabase que Vercel hace sola una vez al día
// (vea "crons" en vercel.json). En el plan gratis, Supabase pausa los proyectos que pasan
// 7 días sin uso; con esta consulta diaria el proyecto nunca queda inactivo.
//
// Si en Vercel se define la variable CRON_SECRET, Vercel la envía al llamar y aquí se exige.

import { json } from "../lib/comun.js";
import { supabase } from "../lib/supabase.js";

export async function GET(request) {
  const env = process.env;
  if (env.CRON_SECRET && request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: "No autorizado" }, 401);
  }
  const filiales = await supabase(env).contar("carnet_filiales", {});
  return json({ ok: true, filiales });
}
