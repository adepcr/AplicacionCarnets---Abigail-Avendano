// GET /v/<código>  (vercel.json la envía a /api/verificar?codigo=<código>)
// → página pública que se abre al escanear el QR del carnet.
// Muestra si el carnet es válido HOY (consulta la lista de afiliados en ese momento),
// con la foto y el nombre para comparar con la persona. La cédula se muestra incompleta.

import { codigoValido, leerFotoGuardada, buscarCarnet } from "../lib/comun.js";

const escapar = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cedulaParcial = c => `•-••••-${c.slice(5)}`;

export async function GET(request) {
  const env = process.env;
  const url = new URL(request.url);
  const codigo = String(url.searchParams.get("codigo") ?? url.pathname.match(/\/v\/([^/]+)$/)?.[1] ?? "").toUpperCase();
  let carnet = null;
  if (codigoValido(codigo)) {
    carnet = await buscarCarnet(env, { verificacion: `eq.${codigo}` });
  }

  const ahora = new Date().toLocaleString("es-CR", {
    timeZone: "America/Costa_Rica", dateStyle: "long", timeStyle: "short"
  });

  let contenido;
  if (carnet && carnet.activo) {
    const foto = await leerFotoGuardada(env, carnet);
    contenido = `
      <div class="estado estado-ok" role="status">
        <svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
        <div><strong>Carnet válido</strong><span>Afiliado activo de ADEP</span></div>
      </div>
      <div class="verif-persona">
        ${foto ? `<img class="verif-foto" src="${foto}" alt="Foto de ${escapar(carnet.nombre)}">` : ""}
        <h1>${escapar(carnet.nombre)}</h1>
        <dl>
          <div><dt>Filial</dt><dd>${escapar(carnet.filial)}</dd></div>
          <div><dt>Cédula</dt><dd>${cedulaParcial(carnet.cedula)}</dd></div>
        </dl>
      </div>
      <p class="verif-ayuda">Compare la foto con la persona que presenta el carnet.</p>`;
  } else if (carnet) {
    contenido = `
      <div class="estado estado-no" role="status">
        <svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        <div><strong>Carnet no vigente</strong><span>Esta persona no aparece como afiliada activa de ADEP.</span></div>
      </div>
      <p class="verif-ayuda">Si cree que es un error, comuníquese con ADEP.</p>`;
  } else {
    contenido = `
      <div class="estado estado-no" role="status">
        <svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        <div><strong>Código no válido</strong><span>Este código no corresponde a ningún carnet emitido por ADEP.</span></div>
      </div>
      <p class="verif-ayuda">El carnet podría ser falso o el código estar dañado.</p>`;
  }

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0b4f2a">
<title>Verificación de carnet · ADEP</title>
<link rel="icon" href="/logo.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/estilos.css">
</head>
<body data-paso="verificacion">
<header class="hero">
  <div class="hero-inner">
    <a class="marca" href="/">
      <img class="logo" src="/logo.png" alt="Logo ADEP">
      <div><strong>ADEP</strong><span>Verificación de carnet</span></div>
    </a>
  </div>
</header>
<main>
  <section class="panel verificacion">
    ${contenido}
    <p class="verif-fecha">Consultado el ${escapar(ahora)}</p>
  </section>
</main>
<footer>
  <div class="footer-inner">
    <p class="lema"><b>ADEP</b> · Comprensión · Fraternidad · Cooperación · <a href="/privacidad">Política de privacidad</a></p>
  </div>
</footer>
</body>
</html>`;

  return new Response(html, {
    status: carnet ? 200 : 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex"
    }
  });
}
