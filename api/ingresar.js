// POST /api/ingresar  { cedula, nacimiento }
// Devuelve el carnet si la cédula y la fecha coinciden y el afiliado sigue activo.

import {
  json, leerCuerpo, leerCedula, leerFecha, estaBloqueado, registrarFallo,
  esAfiliadoActivo, datosCarnet, MENSAJE_BLOQUEO, MENSAJE_CEDULA
} from "../lib/comun.js";
import { supabase } from "../lib/supabase.js";

export async function POST(request) {
  const env = process.env;
  const cuerpo = await leerCuerpo(request);
  const cedula = leerCedula(cuerpo.cedula);
  const nacimiento = leerFecha(cuerpo.nacimiento);

  if (!cedula) return json({ error: MENSAJE_CEDULA }, 400);
  if (!nacimiento) return json({ error: "Elija su fecha de nacimiento completa." }, 400);

  if (await estaBloqueado(env, request)) return json({ error: MENSAJE_BLOQUEO }, 429);

  if (!(await esAfiliadoActivo(env, cedula))) {
    await registrarFallo(env, request);
    return json({ estado: "no-afiliado" });
  }

  const carnet = await supabase(env).uno("carnet_carnets", { cedula: `eq.${cedula}` });

  if (!carnet) return json({ estado: "sin-carnet" });

  if (carnet.nacimiento !== nacimiento) {
    await registrarFallo(env, request);
    return json({ estado: "fecha-incorrecta" });
  }

  // La foto es obligatoria: sin foto solo se devuelve lo necesario para subirla.
  const datos = await datosCarnet(env, carnet);
  if (!datos.foto) return json({ estado: "sin-foto", carnet: { token: datos.token, nombre: datos.nombre } });

  return json({ estado: "ok", carnet: datos });
}
