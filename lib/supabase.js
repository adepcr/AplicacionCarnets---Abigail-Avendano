// Conexión a Supabase (base de datos y fotos) usando su API REST.
//
// Solo se usa desde el servidor (funciones de Vercel en api/ y scripts de ADEP), nunca desde el celular:
// la clave secreta da acceso total y no debe llegar al navegador.
//
// Necesita dos valores (en Vercel: Settings → Environment Variables; en su computadora: el archivo .env.local):
//   SUPABASE_URL          ej. https://abcdefgh.supabase.co
//   SUPABASE_SECRET_KEY   la clave "secret" (sb_secret_...) o la antigua "service_role" (eyJ...)

export const BUCKET_FOTOS = "carnet-fotos";

export function supabase(env) {
  const url = String(env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const clave = String(env.SUPABASE_SECRET_KEY ?? "");
  if (!url || !clave) throw new Error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en la configuración.");

  // Las claves nuevas (sb_secret_...) van solo en "apikey"; las antiguas (JWT) también en Authorization.
  const base = { apikey: clave };
  if (clave.startsWith("eyJ")) base.Authorization = `Bearer ${clave}`;

  async function pedir(ruta, { method = "GET", headers = {}, body } = {}) {
    const respuesta = await fetch(url + ruta, { method, headers: { ...base, ...headers }, body });
    if (!respuesta.ok && respuesta.status !== 404 && respuesta.status !== 409) {
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`Supabase respondió ${respuesta.status} en ${method} ${ruta.split("?")[0]}: ${detalle.slice(0, 300)}`);
    }
    return respuesta;
  }

  // filtros: { cedula: "eq.102340567", fecha: "gt.2026-01-01T00:00:00Z" } (sintaxis de PostgREST)
  const consulta = (filtros = {}, extra = {}) => {
    const p = new URLSearchParams({ ...filtros, ...extra });
    const texto = p.toString();
    return texto ? "?" + texto : "";
  };
  const JSON_CT = { "Content-Type": "application/json" };

  return {
    // Filas que cumplen los filtros
    async select(tabla, filtros, columnas = "*") {
      const r = await pedir(`/rest/v1/${tabla}${consulta(filtros, { select: columnas })}`);
      return r.status === 404 ? [] : r.json();
    },

    // Primera fila o null
    async uno(tabla, filtros, columnas = "*") {
      const filas = await this.select(tabla, { ...filtros, limit: "1" }, columnas);
      return filas[0] ?? null;
    },

    // Cuántas filas cumplen los filtros
    async contar(tabla, filtros) {
      const r = await pedir(`/rest/v1/${tabla}${consulta(filtros, { select: "*" })}`, {
        method: "HEAD", headers: { Prefer: "count=exact" }
      });
      return Number((r.headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
    },

    // Inserta. Devuelve false si ya existía una fila con la misma clave (conflicto).
    async insertar(tabla, fila) {
      const r = await pedir(`/rest/v1/${tabla}`, {
        method: "POST", headers: { ...JSON_CT, Prefer: "return=minimal" }, body: JSON.stringify(fila)
      });
      return r.status !== 409;
    },

    // Actualiza las filas que cumplen los filtros y las devuelve
    async actualizar(tabla, filtros, cambios) {
      const r = await pedir(`/rest/v1/${tabla}${consulta(filtros)}`, {
        method: "PATCH", headers: { ...JSON_CT, Prefer: "return=representation" }, body: JSON.stringify(cambios)
      });
      return r.json();
    },

    // Inserta o, si ya existe una fila con la misma clave, la reemplaza (para restaurar respaldos)
    async guardar(tabla, filas) {
      await pedir(`/rest/v1/${tabla}`, {
        method: "POST",
        headers: { ...JSON_CT, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(filas)
      });
    },

    async borrar(tabla, filtros) {
      await pedir(`/rest/v1/${tabla}${consulta(filtros)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    },

    // Llama a una función de la base de datos (ej. carnet_reemplazar_listas)
    async funcion(nombre, argumentos) {
      const r = await pedir(`/rest/v1/rpc/${nombre}`, { method: "POST", headers: JSON_CT, body: JSON.stringify(argumentos) });
      return r.json();
    },

    // --- Fotos (Storage, bucket privado) ---
    async subirFoto(ruta, bytes) {
      await pedir(`/storage/v1/object/${BUCKET_FOTOS}/${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "no-cache" },
        body: bytes
      });
    },

    // Bytes de la foto, o null si no existe
    async bajarFoto(ruta) {
      const r = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET_FOTOS}/${ruta}`, { headers: base });
      if (r.status === 400 || r.status === 404) return null;
      if (!r.ok) throw new Error(`Supabase respondió ${r.status} al leer la foto ${ruta}`);
      return new Uint8Array(await r.arrayBuffer());
    },

    async borrarFoto(ruta) {
      await pedir(`/storage/v1/object/${BUCKET_FOTOS}`, {
        method: "DELETE", headers: JSON_CT, body: JSON.stringify({ prefixes: [ruta] })
      });
    }
  };
}
