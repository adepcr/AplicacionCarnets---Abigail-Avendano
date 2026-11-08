// GET /api/filiales  → lista de filiales para el formulario de "Crear mi carnet"

import { json } from "../lib/comun.js";
import { supabase } from "../lib/supabase.js";

export async function GET() {
  const env = process.env;
  const results = await supabase(env).select("carnet_filiales", {}, "nombre");
  const filiales = results.map(f => f.nombre).sort((a, b) => a.localeCompare(b, "es"));
  return json({ filiales });
}
