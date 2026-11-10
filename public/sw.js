// Service worker: guarda la página en el celular para que abra sin internet.
//
// - Página, estilos y código: primero intenta internet (para tener siempre la última versión);
//   si no hay señal o tarda mucho, usa la copia guardada.
// - Letras (Google Fonts): se guardan la primera vez y se reutilizan.
// - /api/ y /v/ (datos de afiliados y verificación): siempre por internet, nunca se guardan aquí.
//   La copia del carnet para ver sin internet la guarda la página (app.js), solo si la persona
//   eligió "Recordar en este celular".

const VERSION = "carnet-adep-v2";
const ARCHIVOS = [
  "/",
  "/estilos.css",
  "/app.js",
  "/logo.png",
  "/vendor/html2canvas.min.js",
  "/vendor/qrcode.js",
  "/privacidad",
  "/manifest.webmanifest",
  "/iconos/icono-192.png"
];
const ESPERA_MAXIMA = 4000;   // ms antes de usar la copia si la señal es muy lenta

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const pedido = e.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(primeroGuardado(pedido));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v/")) return;

  e.respondWith(primeroInternet(pedido));
});

async function primeroInternet(pedido) {
  const cache = await caches.open(VERSION);
  try {
    const respuesta = await conLimite(fetch(pedido), ESPERA_MAXIMA);
    if (respuesta.ok) cache.put(pedido, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    if (pedido.mode === "navigate") return cache.match("/");
    return Response.error();
  }
}

async function primeroGuardado(pedido) {
  const cache = await caches.open(VERSION);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok || respuesta.type === "opaque") cache.put(pedido, respuesta.clone());
  return respuesta;
}

function conLimite(promesa, ms) {
  return new Promise((resolver, rechazar) => {
    const t = setTimeout(() => rechazar(new Error("tiempo")), ms);
    promesa.then(r => { clearTimeout(t); resolver(r); }, e => { clearTimeout(t); rechazar(e); });
  });
}
