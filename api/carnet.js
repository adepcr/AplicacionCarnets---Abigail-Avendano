// POST /api/carnet  { token }
// Para "recordar en este celular": devuelve el carnet guardado si el afiliado sigue activo.

import { json, leerCuerpo, estaBloqueado, registrarFallo, datosCarnet, buscarCarnet, tokenValido, MENSAJE_BLOQUEO } from "../lib/comun.js";

export async function POST(request) {
  const env = process.env;
  const { token } = await leerCuerpo(request);
  if (!tokenValido(token)) return json({ estado: "invalido" }, 401);

  if (await estaBloqueado(env, request)) return json({ error: MENSAJE_BLOQUEO }, 429);

  const carnet = await buscarCarnet(env, { token: `eq.${token}` });

  if (!carnet || !carnet.activo) {
    await registrarFallo(env, request);
    return json({ estado: "invalido" }, 401);
  }

  // La foto es obligatoria: sin foto solo se devuelve lo necesario para subirla.
  const datos = await datosCarnet(env, carnet);
  if (!datos.foto) return json({ estado: "sin-foto", carnet: { token: datos.token, nombre: datos.nombre } });

  return json({ estado: "ok", carnet: datos });
}
