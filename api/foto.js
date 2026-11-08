// POST /api/foto  { token, foto, consentimiento }
// Agrega o cambia la foto del carnet. Se usa cuando el afiliado ya tiene carnet
// (carnets creados antes de que existieran las fotos, o si quiere cambiarla).

import {
  json, leerCuerpo, estaBloqueado, registrarFallo, datosCarnet, leerFoto, guardarFoto, buscarCarnet, tokenValido,
  MENSAJE_BLOQUEO, MENSAJE_CONSENTIMIENTO
} from "../lib/comun.js";

export async function POST(request) {
  const env = process.env;
  const { token, foto: fotoTexto, consentimiento } = await leerCuerpo(request);
  if (!tokenValido(token)) return json({ estado: "invalido" }, 401);

  const foto = leerFoto(fotoTexto);
  if (!foto) return json({ error: "No se pudo leer la foto. Intente tomarla de nuevo." }, 400);
  if (consentimiento !== true) return json({ error: MENSAJE_CONSENTIMIENTO }, 400);

  if (await estaBloqueado(env, request)) return json({ error: MENSAJE_BLOQUEO }, 429);

  const carnet = await buscarCarnet(env, { token: `eq.${token}` });

  if (!carnet || !carnet.activo) {
    await registrarFallo(env, request);
    return json({ estado: "invalido" }, 401);
  }

  await guardarFoto(env, carnet.cedula, foto);
  carnet.foto = true;
  return json({ estado: "ok", carnet: await datosCarnet(env, carnet) });
}
