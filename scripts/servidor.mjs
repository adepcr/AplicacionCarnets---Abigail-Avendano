// Servidor para probar la página en su computadora: npm run dev → http://localhost:3000
// Hace lo mismo que Vercel: muestra public/, corre las funciones de api/ y envía /v/<código>
// a api/verificar.js. Usa la base de datos de PRUEBA (archivo .env.local).
// No hace falta instalar nada ni tener cuenta en Vercel.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { leerVariables } from "./entorno.mjs";

Object.assign(process.env, leerVariables(".env.local"));
const PUERTO = Number(process.env.PORT ?? 3000);
const RAIZ = join(process.cwd(), "public");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".json": "application/json"
};

async function funcion(nombre, req, url) {
  const archivo = join(process.cwd(), "api", `${nombre}.js`);
  if (!/^[a-z-]+$/.test(nombre) || !existsSync(archivo)) return new Response("No encontrado", { status: 404 });
  const modulo = await import(pathToFileURL(archivo).href);
  const manejador = modulo[req.method];
  if (!manejador) return new Response("Método no permitido", { status: 405 });
  const partes = [];
  for await (const p of req) partes.push(p);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  if (!headers.has("x-real-ip")) headers.set("x-real-ip", req.socket.remoteAddress ?? "local");
  const cuerpo = partes.length ? Buffer.concat(partes) : undefined;
  return manejador(new Request(url, { method: req.method, headers, body: cuerpo }));
}

async function archivo(ruta) {
  let camino = normalize(join(RAIZ, decodeURIComponent(ruta)));
  if (!camino.startsWith(RAIZ)) return new Response("No encontrado", { status: 404 });
  if (ruta.endsWith("/")) camino = join(camino, "index.html");
  else if (!extname(camino)) camino += ".html";            // /privacidad → privacidad.html (como cleanUrls)
  try {
    const headers = { "Content-Type": TIPOS[extname(camino)] ?? "application/octet-stream" };
    if (ruta === "/sw.js" || ruta === "/manifest.webmanifest") headers["Cache-Control"] = "no-cache";
    return new Response(await readFile(camino), { headers });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  let respuesta;
  try {
    const v = url.pathname.match(/^\/v\/([^/]+)$/);
    if (v) {
      url.searchParams.set("codigo", decodeURIComponent(v[1]));
      respuesta = await funcion("verificar", req, url);
    } else if (url.pathname.startsWith("/api/")) {
      respuesta = await funcion(url.pathname.slice(5), req, url);
    } else {
      respuesta = await archivo(url.pathname);
    }
  } catch (error) {
    console.error(error);
    respuesta = Response.json({ error: "Error del servidor" }, { status: 500 });
  }
  res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
  res.end(Buffer.from(await respuesta.arrayBuffer()));
  console.log(`${req.method} ${url.pathname} → ${respuesta.status}`);
}).listen(PUERTO, () => console.log(`Página de prueba en http://localhost:${PUERTO}`));
