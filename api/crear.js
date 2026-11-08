// POST /api/crear  { cedula, nombre, filial, nacimiento, foto, consentimiento }
// Crea el carnet si la cédula está en la lista de afiliados activos de ADEP.

import {
  json, leerCuerpo, leerCedula, leerFecha, estaBloqueado, registrarFallo,
  esAfiliadoActivo, datosCarnet, leerFoto, guardarFoto, MENSAJE_BLOQUEO, MENSAJE_CONSENTIMIENTO
} from "../lib/comun.js";
import { supabase } from "../lib/supabase.js";

export async function POST(request) {
  const env = process.env;
  const cuerpo = await leerCuerpo(request);
  const cedula = leerCedula(cuerpo.cedula);
  const nombre = String(cuerpo.nombre ?? "").trim().replace(/\s+/g, " ");
  const filial = String(cuerpo.filial ?? "").trim();
  const nacimiento = leerFecha(cuerpo.nacimiento);
  const foto = leerFoto(cuerpo.foto);

  if (!cedula) return json({ error: "Ingrese una cédula de 9 dígitos." }, 400);
  if (nombre.length < 5 || nombre.length > 80 || !nombre.includes(" ")) {
    return json({ error: "Escriba su nombre completo (nombre y apellidos)." }, 400);
  }
  if (!nacimiento) return json({ error: "Elija su fecha de nacimiento completa." }, 400);
  if (!foto) return json({ error: "Tómese una foto de su rostro para el carnet." }, 400);
  if (cuerpo.consentimiento !== true) return json({ error: MENSAJE_CONSENTIMIENTO }, 400);

  if (await estaBloqueado(env, request)) return json({ error: MENSAJE_BLOQUEO }, 429);

  const db = supabase(env);
  const filialValida = await db.uno("carnet_filiales", { nombre: `eq.${filial}` }, "nombre");
  if (!filialValida) return json({ error: "Elija su filial de la lista." }, 400);

  if (!(await esAfiliadoActivo(env, cedula))) {
    await registrarFallo(env, request);
    return json({ estado: "no-afiliado" });
  }

  const existente = await db.uno("carnet_carnets", { cedula: `eq.${cedula}` }, "cedula");
  if (existente) return json({ estado: "ya-existe" });

  const carnet = {
    cedula,
    nombre,
    filial,
    nacimiento,
    token: crypto.randomUUID(),
    creado: new Date().toISOString().slice(0, 10)
  };

  // Si dos personas crean el mismo carnet a la vez, la segunda recibe "ya existe"
  if (!(await db.insertar("carnet_carnets", carnet))) return json({ estado: "ya-existe" });
  await guardarFoto(env, cedula, foto);
  carnet.foto = true;

  return json({ estado: "ok", carnet: await datosCarnet(env, carnet) });
}
