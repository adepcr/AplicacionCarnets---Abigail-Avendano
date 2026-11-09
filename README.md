# Mi Carnet ADEP

Página web donde los afiliados de ADEP crean y ven su carnet digital.

- **Crear mi carnet (primera vez):** el afiliado escribe su cédula, su nombre, elige su filial y su
  fecha de nacimiento (día, mes y año en tres listas), y **se toma una foto del rostro** con la cámara
  del celular (o la elige de sus fotos). Debe marcar la casilla de autorización para guardar su foto
  (Ley 8968). Solo se puede si la cédula está en la lista de afiliados activos de ADEP.
- **Cambiar mi foto:** desde su carnet, el afiliado puede tomarse otra foto. La nueva reemplaza a la
  anterior en todos los celulares donde abra su carnet.
- **Carnets sin foto** (creados antes, o si ADEP borró la foto): la foto es **obligatoria**. Al entrar
  se le pide tomarse una, y el carnet no se muestra hasta que la suba (también lo valida el servidor).
- **Ver mi carnet:** cédula + fecha de nacimiento.
- **Cédula o DIMEX:** se acepta la cédula nacional (9 dígitos) y la identificación de personas extranjeras
  residentes: número de residencia antiguo (10 dígitos) o DIMEX (11 o 12). Cualquier otro largo se rechaza.
- **Recordar en este celular:** después de entrar una vez, el carnet aparece directo al abrir la página.
- **Código QR de verificación:** el botón **"Mostrar código QR"** abre el código en grande (no va impreso
  en el carnet). Quien lo escanee (un comercio, ADEP) ve en ese momento si el carnet está **vigente**, con la foto y el nombre para compararlos con la persona. La cédula
  se muestra incompleta y nunca la fecha de nacimiento.
- **App instalable y sin internet:** se puede instalar en el celular como una app (Android: botón
  "Instalar"; iPhone: instrucciones). Si eligió "Recordar en este celular", el carnet se ve aunque no haya señal.
- **Política de privacidad** en `/privacidad` (Ley 8968), enlazada desde la autorización de la foto y el pie de página.
- El carnet (formato vertical) se puede descargar como imagen o imprimir.
- Si la cédula no está en la lista, se le ofrece escribir por WhatsApp para afiliarse.

Funciona en **Vercel + Supabase**, los dos en su plan **gratis**:

```
Celular del afiliado ──► Vercel (página + funciones /api y /v) ──► Supabase de ADEP
                                                                   ├─ Base de datos: tablas carnet_*
                                                                   └─ Storage: bucket privado carnet-fotos
```

El celular **nunca** se conecta a Supabase: solo las funciones de Vercel lo hacen, con una clave secreta
guardada en Vercel (no en el código ni en GitHub).

**Para entregar el proyecto a TI**, vea [`GUIA-TI.md`](GUIA-TI.md).

### Lo que hay que saber del plan gratis

- **Supabase pausa el proyecto si pasa 7 días sin uso.** Para que eso no pase, Vercel hace sola una
  consulta pequeña a Supabase **una vez al día** (`api/despertar.js`, programada en `vercel.json`).
- **Borrado automático (política de privacidad, punto 7):** esa misma consulta diaria anota la fecha en que
  un carnet deja de tener afiliado activo, la quita si la persona vuelve a la lista, y **a los 3 meses borra
  el carnet y la foto**. Si de una vez desaparecen muchos afiliados (lista incompleta), no borra nada y deja
  un aviso en Vercel → **Logs**. Detalle en `lib/limpieza.js`.
- **Espacio:** 1 GB para fotos (unas **30 000 fotos** de ~30 KB) y 500 MB de base de datos, **compartidos
  con lo que ADEP ya tenga** en ese proyecto. Revíselo en Supabase → *Project Settings → Usage*.
- **No hay respaldos automáticos** en el plan gratis de Supabase: haga `npm run respaldo` **una vez al mes**.
- **Vercel gratis (Hobby)** es para uso no comercial. Un carnet de afiliados de una asociación sin fines de
  lucro normalmente entra; si ADEP quiere evitar dudas, existe el plan Pro.

## Cómo está hecho

```
public/                   → la página que ve el afiliado
  index.html
  estilos.css
  app.js
  logo.png                → logo oficial de ADEP
  privacidad.html         → política de privacidad (BORRADOR: complete lo marcado en amarillo)
  sw.js                   → guarda la página en el celular para que abra sin internet
  manifest.webmanifest    → nombre, colores e íconos de la app instalable
  iconos/                 → íconos de la app (hechos a partir de logo.png)
  vendor/                 → librerías: html2canvas (descargar imagen) y qrcode (código QR)
api/                      → lo que corre en el servidor (funciones de Vercel)
  crear.js                → crea el carnet (si la cédula está en la lista)
  ingresar.js             → muestra el carnet con cédula + fecha de nacimiento
  foto.js                 → agrega o cambia la foto de un carnet
  carnet.js               → "recordar en este celular"
  filiales.js             → lista de filiales
  verificar.js            → página que se abre al escanear el QR (/v/<código>)
  despertar.js            → consulta diaria: evita la pausa de Supabase y borra carnets sin afiliación (3 meses)
lib/comun.js              → funciones compartidas
lib/supabase.js           → conexión a Supabase (base de datos y fotos)
lib/limpieza.js           → borrado de carnets de quienes llevan 3 meses sin ser afiliados
basedatos/supabase.sql    → crea las tablas, la seguridad y el bucket de fotos en Supabase
scripts/servidor.mjs      → servidor para probar en su computadora (npm run dev)
scripts/importar.mjs      → revisa la lista de cédulas y filiales y la sube a Supabase
scripts/borrar-foto.mjs   → borra la foto de un afiliado (fotos inadecuadas)
scripts/respaldo.mjs      → descarga una copia de los datos y las fotos (npm run respaldo)
scripts/restaurar.mjs     → vuelve a cargar un respaldo (npm run restaurar)
scripts/limpiar.mjs       → muestra o fuerza la limpieza que la consulta diaria hace sola (npm run limpiar)
scripts/reporte.mjs       → saca cédulas y filiales del reporte PDF de ADEP (npm run reporte)
scripts/ejemplo.mjs       → llena la base de PRUEBA con datos de ejemplo
datos/                    → ejemplos de cómo deben venir las listas
.env.local.ejemplo        → modelo de la conexión a la base de PRUEBA
.env.produccion.ejemplo   → modelo de la conexión a la base REAL
vercel.json               → configuración de Vercel (carpeta public, /v/<código>, consulta diaria)
```

La base de datos (Supabase) tiene:

| Tabla              | Qué guarda                                           | Quién la llena             |
|--------------------|------------------------------------------------------|----------------------------|
| `carnet_afiliados` | Cédulas de los afiliados y si están activos          | ADEP (Excel o Table Editor) |
| `carnet_filiales`  | Lista de filiales                                    | ADEP                       |
| `carnet_carnets`   | Nombre, filial, fecha de nacimiento, códigos y fecha de la foto/autorización | El afiliado, al crearlo |
| `carnet_intentos`  | Intentos fallidos, para frenar a quien intente adivinar | Automático              |

Todas empiezan con `carnet_` para poder estar en el mismo proyecto de Supabase que las demás tablas de ADEP
sin mezclarse. Tienen la seguridad por filas (RLS) activada **sin políticas**: con la clave pública de
Supabase no se puede leer nada; solo el servidor, con la clave secreta.

Cada carnet tiene un **código de verificación** público (12 letras y números al azar) que va en el QR
del botón "Mostrar código QR".
Es distinto de la clave secreta que usa "Recordar en este celular" (`token`), así que escanear el QR no
permite entrar al carnet de nadie.

Las fotos están en Supabase Storage, bucket **privado** `carnet-fotos`, como `fotos/<cédula>.jpg`
(360 × 480 px, unos 30 KB cada una). El celular recorta y comprime la foto antes de enviarla, así sube
rápido aunque la señal sea mala.

Tras 10 intentos fallidos en 15 minutos desde la misma conexión, se bloquean los intentos por un rato.

---

## 1. Preparar Supabase (una sola vez)

Se recomiendan **dos** proyectos de Supabase: uno **de prueba** (para `npm run dev`) y el **real** de ADEP.
En el real, las tablas `carnet_*` conviven con las que ADEP ya tiene sin tocarlas.

En cada proyecto:

1. Abra **SQL Editor**, pegue todo el archivo `basedatos/supabase.sql` y toque **Run**.
   Crea las tablas, la seguridad y el bucket privado de fotos. Se puede volver a correr sin perder datos.
2. En **Project Settings → API Keys** copie:
   - la **URL** del proyecto (`https://xxxx.supabase.co`)
   - una clave **secret** (`sb_secret_...`). También sirve la antigua `service_role`.

   **Nunca** use ni comparta esta clave fuera del servidor: da acceso total.

## 2. Probarlo en su computadora

1. Instale **Node.js** (versión LTS): https://nodejs.org. No hace falta `npm install`: el proyecto no
   usa paquetes externos.
2. Copie `.env.local.ejemplo` como **`.env.local`** y ponga la URL y la clave del proyecto de **prueba**.
3. En una terminal, dentro de la carpeta del proyecto:
   ```
   npm run db:ejemplo   # llena la base de PRUEBA con datos de ejemplo (borra los carnets de prueba)
   npm run dev          # abre la página en http://localhost:3000
   ```

Datos de prueba:

| Cédula      | Fecha de nacimiento | Qué pasa                                        |
|-------------|---------------------|-------------------------------------------------|
| 1-0234-0567 | 14 marzo 1958       | Ya tiene carnet, sin foto: debe agregarla para verlo |
| 2-0456-0789 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 4-0111-0222 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 155800000012 | (la que usted elija) | DIMEX (persona extranjera) sin carnet: puede crearlo |
| 9000000001 | (la que usted elija) | Residencia antigua (10 dígitos) sin carnet: puede crearlo |
| 3-0321-0654 | —                   | Inactiva: "No encontramos su afiliación"        |
| Cualquier otra | —                | "No encontramos su afiliación"                  |

Para empezar de cero otra vez, repita `npm run db:ejemplo`.

La cámara funciona en `http://localhost:3000` y en la página publicada (https). Si abre la prueba
desde otro aparato con la IP de su computadora (`http://192.168...`), el navegador no permite usar
la cámara: use "Elegir de mis fotos".

## 3. Publicarlo en Vercel (una sola vez)

1. En https://vercel.com → **Add New → Project**, elija este repositorio de GitHub.
2. En **Framework Preset** deje **Other**. No cambie nada más: `vercel.json` ya dice que la página está
   en `public/`.
3. En **Environment Variables** agregue las dos del proyecto **real** de Supabase:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - (opcional) `CRON_SECRET`: cualquier texto largo al azar. Así solo Vercel puede llamar a la consulta diaria.
4. Toque **Deploy**. Le da la dirección, por ejemplo **https://carnet-adep.vercel.app**.

Desde ese momento, **cada vez que se suben cambios a GitHub** (rama principal), Vercel publica la versión
nueva sola. Si cambia una variable, vuelva a publicar desde *Deployments → Redeploy*.

Para comprobar que la consulta diaria quedó programada: Vercel → el proyecto → **Settings → Cron Jobs**.

## 4. Cargar o actualizar la lista de afiliados y filiales

> **Hay que hacerlo una vez al mes**: el sistema solo sabe quién es afiliado activo por la última lista
> subida. Los pasos completos, con el respaldo, están en `GUIA-TI.md` → *Rutina mensual*.

1. Copie `.env.produccion.ejemplo` como **`.env.produccion`** y ponga la URL y la clave del proyecto **real**.
   Guárdelo solo en la computadora de quien administra.
2. **Afiliados y filiales desde el PDF "Reporte de Asociados Activos por Filial":**
   1. Abra el PDF en Edge o Chrome, haga clic dentro del documento y toque **Ctrl+A** y **Ctrl+C**.
   2. `notepad datos\reporte.txt`, pegue con **Ctrl+V** y guarde.
   3. `npm run reporte`: crea `datos/afiliados.csv` (solo las cédulas) y `datos/filiales.txt`
      (de los encabezados `101 - SAN JOSE`), y muestra cuántas cédulas hay por filial para compararlas
      con el PDF. No copia nombres, teléfonos, direcciones ni fechas.
   4. Revise `datos/filiales.txt` (puede corregir tildes) y siga con el paso 5. Al terminar, borre
      `datos/reporte.txt`: tiene datos personales (Git ya lo ignora).

   Si en vez del PDF tiene un Excel, siga los puntos de abajo.
3. **Afiliados:** del Excel de ADEP solo se necesita la columna **cedula** (con o sin guiones).
   Si tiene una columna **activo** (`1`/`sí` = activo, `0`/`no` = inactivo), también se usa.
   Las demás columnas se ignoran. Guárdelo como **CSV** en `datos/afiliados.csv`.
   Vea el ejemplo en `datos/ejemplo-afiliados.csv`.
4. **Filiales:** cree `datos/filiales.txt` con una filial por línea.
   Vea el ejemplo en `datos/ejemplo-filiales.txt` (son de ejemplo: use las reales de ADEP).
5. Ejecute:
   ```
   npm run importar     # revisa los archivos y avisa si hay errores (no sube nada)
   npm run db:subir     # los sube a la base REAL (pide escribir SUBIR para confirmar)
   ```
   Para probar con la base de prueba: `npm run db:subir-prueba`.

**Las listas que suba reemplazan a las anteriores**, en un solo paso (si algo falla, no cambia nada).
Los carnets que ya crearon los afiliados se conservan: si una cédula sale de la lista o queda inactiva,
su carnet deja de mostrarse, y si vuelve, reaparece.

Para agregar **un solo** afiliado sin subir el Excel: Supabase → **Table Editor → carnet_afiliados →
Insert row** (cédula de 9 dígitos sin guiones, `activo` = true). Recuerde agregarlo también al Excel,
o desaparecerá en la siguiente carga.

> ⚠️ `datos/afiliados.csv`, `.env.local`, `.env.produccion` y la carpeta `respaldos/` tienen datos de
> afiliados o claves. Están excluidos de Git (`.gitignore`) para que **nunca** se suban a GitHub.

## 5. Tareas comunes

**Un afiliado subió una foto inadecuada:** bórrela. La próxima vez que abra su carnet, la página le
pedirá tomarse una nueva. Si tiene su número, avísele por WhatsApp.
```
npm run borrar-foto -- 1-0234-0567
```

**Un afiliado dice que otra persona creó su carnet, o se equivocó en sus datos:** borre su foto y luego
su carnet para que lo cree de nuevo: Supabase → **Table Editor → carnet_carnets**, busque la cédula y
borre la fila.

**Corregir el nombre o la filial** (sin borrar el carnet): en el mismo **Table Editor → carnet_carnets**,
haga doble clic en el dato y cámbielo.

**Ver cuántos carnets se han creado:** **Table Editor → carnet_carnets** (el total aparece abajo), o en
**SQL Editor**: `select count(*) from carnet_carnets;`

**Respaldo** (copia de datos y fotos en la carpeta `respaldos/`, que nunca se sube a GitHub).
El plan gratis de Supabase no guarda copias automáticas: **hágalo una vez al mes**.
```
npm run respaldo
```
Para volver a cargar un respaldo: `npm run restaurar -- respaldos/<fecha>`.

**Limpieza de carnets de exafiliados:** la hace sola la consulta diaria. Para ver cómo va o forzarla
después de subir una lista: `npm run limpiar` (muestra los números y pide escribir SI antes de cambiar algo).
Lo que hizo cada día aparece en Vercel → **Logs** buscando `despertar`.

**Espacio usado:** Supabase → **Project Settings → Usage** (Storage: máximo 1 GB; base de datos: 500 MB).

## 6. Antes de publicar

- **Política de privacidad:** abra `public/privacidad.html` y complete lo marcado como pendiente (cédula
  jurídica, dirección, fecha y plazo de conservación). Es un borrador: conviene que lo revise la asesoría legal de ADEP.
- **Dirección definitiva de la página:** el QR lleva a la dirección donde está publicada la página
  (por ejemplo `https://carnet.adepcr.org/v/...`). Como se genera cada vez que se abre, si luego cambia de
  dominio los códigos nuevos usan la dirección nueva; aun así, conviene decidir el dominio antes de publicar.

## 7. Personalizar

- **Plantilla del carnet:** la actual es **provisional**. En `public/index.html` está entre las marcas
  `PLANTILLA PROVISIONAL` y `FIN DE LA PLANTILLA PROVISIONAL`; sus estilos están en `public/estilos.css`
  (clases `.carnet-v` y `.cv-…`). Los datos se llenan solos en los elementos con
  `data-campo="nombre|cedula|filial|emitido"` y la foto en los que tienen `data-foto`.
- **Texto de autorización de la foto:** en `public/index.html` (busque "Autorizo a ADEP"). Conviene que
  ADEP lo revise.
- **Logo:** está en `public/logo.png` (redondo, con fondo transparente). Para cambiarlo, reemplace ese archivo
  por otro con el mismo nombre. Los íconos de la app (`public/iconos/`) se hicieron a partir de él; si consigue
  el logo en mejor calidad (512 × 512 px o más), conviene volver a generarlos.
- **Cambios en la página y celulares con la app instalada:** la app busca la versión nueva cada vez que
  hay internet. Si cambia la lista de archivos de `public/sw.js`, suba también el número de `VERSION` en ese archivo.
- **Textos, teléfono y correo:** en `public/index.html`.
- **Número y mensaje de WhatsApp:** al inicio de `public/app.js`.
- **Colores:** al inicio de `public/estilos.css` (`--verde`, `--rojo`, etc.).
