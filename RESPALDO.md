# Cómo hacer el respaldo mensual (paso a paso)

Guía para la persona de ADEP que hace el respaldo. **Hágalo una vez al mes**: el plan gratis de Supabase
**no guarda respaldos automáticos**, así que esta es la única copia de los datos.

En el proyecto de Supabase de ADEP están **todos** los sistemas: Inventario del Archivo, Carnet, ADEP Vota
y el prototipo de votaciones. Con este respaldo se guardan todos de una vez.

Tiempo: unos 20 minutos la primera vez y 5 minutos los meses siguientes.

> ⚠️ El respaldo tiene **datos personales** (cédulas, nombres, fotos de carnet). Guárdelo solo en una carpeta
> de ADEP con acceso restringido (TI y jefatura). Nunca en el Escritorio, en un USB personal ni en GitHub.

---

## Qué se necesita

- Una computadora con Windows de ADEP.
- La **URL** y la **clave secreta** de Supabase (ver paso 3).
- Una carpeta de ADEP con acceso restringido donde guardar el respaldo.
  Carpeta acordada: ______________________________

---

## Parte 1 · Excel del Inventario (2 minutos)

1. Abra **https://inventario-archivo-docs.vercel.app** y entre con un usuario **editor**.
2. Toque el botón **Respaldo**. Se descarga un Excel con el inventario y los préstamos.
3. Guárdelo en la carpeta de respaldos de ADEP, dentro de una carpeta con la fecha (por ejemplo `2026-12-15`).

---

## Parte 2 · Respaldo completo de Supabase

### Paso 1. Instalar Node.js (solo la primera vez)

1. Entre a **https://nodejs.org** y descargue la versión **LTS**.
2. Instálela con todas las opciones por defecto («Siguiente» hasta terminar).

Si ya está instalado, siga al paso 2.

### Paso 2. Descargar este proyecto

1. En GitHub, abra este repositorio: `adepcr/AplicacionCarnets---Abigail-Avendano`.
2. Toque el botón verde **Code → Download ZIP**.
3. Clic derecho sobre el ZIP → **Extraer todo**.
4. Windows crea **una carpeta dentro de otra** con el mismo nombre. Entre a la de adentro: es la que tiene
   `package.json`, `scripts`, `api`, etc.

### Paso 3. Poner la clave de Supabase

1. Dentro de esa carpeta, haga **clic derecho en un espacio vacío → Abrir en Terminal**
   (si no aparece: **Mostrar más opciones → Abrir en Terminal**). Se abre una ventana (PowerShell).
2. Escriba este comando y presione Enter. Crea el archivo de la clave a partir del ejemplo:
   ```
   Copy-Item .env.produccion.ejemplo .env.produccion
   ```
3. Ábralo en el Bloc de notas:
   ```
   notepad .env.produccion
   ```
4. Cambie **solo lo que va después del `=`** en las dos últimas líneas. Sin espacios ni comillas, y con un
   solo `https://`:
   ```
   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxx
   ```
   - **SUPABASE_URL**: Supabase → proyecto **inventario-archivo** → **Project Settings → Data API**
     (también está en el documento de entrega).
   - **SUPABASE_SECRET_KEY**: Supabase → **Project Settings → API Keys** → en **Secret keys**, copie la clave
     (empieza con `sb_secret_`). En Vercel no se puede ver: está marcada como sensible.
5. Guarde con **Ctrl+G** y cierre el Bloc de notas. Revise que en la pestaña no quede el puntito ● de
   «sin guardar».

> Nunca mande capturas de pantalla del Bloc de notas con la clave puesta.

### Paso 4. Hacer el respaldo

En la misma ventana de PowerShell, escriba **un comando a la vez** y espere a que termine:

```
npm install
```
(solo la primera vez)

```
npm run respaldo
```
Debe terminar con: `Listo: respaldo guardado en respaldos/<fecha>/`

```
npm run respaldo-completo
```
Debe mostrar cuántas filas tiene cada tabla y terminar con:
`Listo: respaldo completo guardado en respaldos/completo-<fecha>/`

### Paso 5. Revisar que salió bien

1. La línea **«Base de datos: REAL (producción) → https://…supabase.co»** debe mostrar la dirección real.
   Si dice `xxxxxxxxxxxx` o `https:https://`, el archivo `.env.produccion` está mal (vuelva al paso 3).
2. Debe decir `carnet_afiliados` con unos **8 700** afiliados y `archivos` con unas **1 300** filas.
3. Abra el resumen:
   ```
   notepad respaldos\completo-<fecha>\RESUMEN.txt
   ```
   - Al final debe decir **«Sin avisos: todo se leyó bien.»**
   - La sección **«NO SE COPIAN A PROPÓSITO»** (tabla `vota_restaurables`) es normal: protege el voto secreto.
   - Si aparece **«permission denied for table …»** en tablas del Inventario, falta un permiso: en Supabase →
     **SQL Editor → New query**, pegue esto, toque **Run** y repita el paso 4:
     ```sql
     grant select on public.archivos, public.historial, public.prestamos, public.roles_usuario to service_role;
     ```

### Paso 6. Guardar el respaldo y limpiar la computadora

1. Abra la carpeta de respaldos:
   ```
   explorer respaldos
   ```
2. Copie las **dos carpetas nuevas** (`<fecha>` y `completo-<fecha>`) a la carpeta restringida de ADEP,
   junto con el Excel de la parte 1.
3. Si un intento salió mal, borre esa carpeta para no confundirla con un respaldo bueno.
4. Si esta computadora **no** es la de TI, **borre toda la carpeta del proyecto** (incluye `.env.produccion`
   con la clave secreta) y el ZIP descargado. Vacíe la papelera.

---

## Problemas comunes

| Mensaje | Qué hacer |
|---|---|
| `npm` no se reconoce como un comando | Falta Node.js (paso 1). Instálelo, cierre la ventana y ábrala de nuevo |
| `No existe el archivo .env.produccion` | Falta el paso 3 o está en otra carpeta. Revise que esté en la carpeta que tiene `package.json` |
| `getaddrinfo ENOTFOUND xxxxxxxxxxxx.supabase.co` | No se cambió la URL de ejemplo, o no se guardó el archivo (paso 3) |
| `getaddrinfo ENOTFOUND https` | La URL quedó con `https://` repetido (paso 3) |
| `Invalid API key` o error 401 | La clave secreta está mal copiada o la cambiaron: cópiela de nuevo de Supabase |
| `permission denied for table …` | Ver el paso 5, punto 3 |
| La app de Supabase dice que el proyecto está pausado | Supabase → **Restore project** y repita el respaldo |

## Cómo restaurar

No restaure sobre una base en uso sin hablar antes con TI: puede duplicar o reemplazar datos.

- **Carnet**: `npm run restaurar -- respaldos/<fecha>` (pide escribir RESTAURAR). Ver [GUIA-TI.md](GUIA-TI.md), sección 5.
- **Inventario y ADEP Vota**: primero se corre su archivo SQL en Supabase → SQL Editor y luego se cargan las filas
  de `tablas/<tabla>.json` (el `RESUMEN.txt` de cada respaldo lo explica).

## Registro de respaldos

| Fecha | Quién lo hizo | Dónde quedó guardado |
|---|---|---|
| 16/11/2026 | Abigail Avendaño | Carpeta restringida de ADEP |
| | | |
| | | |
