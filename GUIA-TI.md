# Mi Carnet ADEP — Guía de entrega para TI

Esta guía es para la persona de TI que queda a cargo del carnet digital. El `README.md` tiene el detalle de cada comando; aquí está lo necesario para **recibir el proyecto y mantenerlo**.

---

## 1. Qué es y dónde vive

| Pieza | Dónde está | Costo |
|---|---|---|
| **Código** | GitHub, organización `adepcr` | Gratis |
| **Página web y funciones** | Vercel, proyecto `carnet-adep` | Gratis (plan Hobby) |
| **Datos** (afiliados, filiales, carnets) | El proyecto de Supabase de ADEP, tablas `carnet_*` | Gratis |
| **Fotos** | El mismo proyecto de Supabase, Storage, bucket privado `carnet-fotos` | Gratis |

```
Celular del afiliado ──► Vercel (página + funciones /api y /v) ──► Supabase de ADEP
                                                                   ├─ Base de datos: tablas carnet_*
                                                                   └─ Storage: bucket privado carnet-fotos
```

- **Todos los datos quedan en el Supabase de ADEP.** En Vercel solo está la página: si se borra o se cambia de cuenta, no se pierde nada.
- **Hay una sola clave secreta:** `SUPABASE_SECRET_KEY`. Está en Vercel (*Settings → Environment Variables*) y en el archivo `.env.produccion` de quien administra. **Nunca** en el código ni en GitHub.
- Las tablas empiezan con `carnet_` y no tocan las demás tablas que ADEP tenga en ese proyecto.

---

## 2. Cómo se entrega (cuentas)

La idea es que **todo quede a nombre de ADEP**, no en cuentas personales.

### Supabase (los datos)
1. ADEP invita a quien va a configurar el proyecto: Supabase → *Organization → Team → Invite*.
2. Esa persona corre `basedatos/supabase.sql` en el **SQL Editor** del proyecto de ADEP (vea README, sección 1).
3. Al terminar, TI le quita el acceso en *Team*. **No hay nada que transferir**: los datos ya están en el proyecto de ADEP.

### GitHub (el código)
1. El repositorio se transfiere a la organización **`adepcr`** (*Settings → Danger Zone → Transfer ownership*).
2. TI queda como administrador. Quien desarrolló el proyecto puede quedar como colaborador o salir.

### Vercel (la página)
Hay dos caminos; los dos sirven porque en Vercel no hay datos:
- **Publicarlo de nuevo en la cuenta de ADEP:** TI entra a Vercel con un correo institucional, importa el repositorio de `adepcr` y pone las variables (README, sección 3). Luego se borra el proyecto de la cuenta de quien lo desarrolló.
- **Transferir el proyecto:** en Vercel → el proyecto → *Settings → General → Transfer Project*, a la cuenta o equipo de ADEP.

> Si se usa un dominio propio (por ejemplo `carnet.adepcr.org`), se configura en Vercel → *Settings → Domains*, en la cuenta que quede definitiva.

### Lista de entrega

- [ ] `basedatos/supabase.sql` ejecutado en el proyecto de Supabase de ADEP
- [ ] Lista real de afiliados y filiales cargada (`npm run db:subir`)
- [ ] Repositorio en `github.com/adepcr`, con TI como administrador
- [ ] Proyecto de Vercel en una cuenta de ADEP, con `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (y opcional `CRON_SECRET`)
- [ ] Consulta diaria visible en Vercel → *Settings → Cron Jobs*
- [ ] Página probada desde un celular (crear carnet, foto, QR, instalar la app)
- [ ] Política de privacidad completa (`public/privacidad.html`, lo marcado en amarillo, incluida la región de Supabase)
- [ ] Primer respaldo hecho (`npm run respaldo`) y guardado en un lugar seguro
- [ ] Persona encargada de la **rutina mensual** definida (sección 4)
- [ ] Acceso de la persona desarrolladora retirado de Supabase, Vercel y GitHub (si corresponde)
- [ ] Si se cambió la clave secreta de Supabase después de la entrega, actualizada en Vercel y en `.env.produccion`

---

## 3. Base de datos (definida en `basedatos/supabase.sql`)

| Tabla | Campos | Quién la llena |
|---|---|---|
| `carnet_afiliados` | `cedula` (9 dígitos, o 10-12 si es residente/DIMEX, sin guiones), `activo` (true/false), `nombre`, `filial`, `actualizado` | ADEP. **Lista compartida con ADEP Vota** (sistema de votaciones): el mismo reporte mensual actualiza los dos sistemas |
| `carnet_filiales` | `nombre` | ADEP |
| `carnet_carnets` | `cedula`, `nombre`, `filial`, `nacimiento`, `token`, `verificacion`, `creado`, `foto`, `consentimiento` | El afiliado |
| `carnet_intentos` | `ip`, `fecha` — intentos fallidos; se borran solos a los 15 min | Automático |

- `token`: **secreto**. Es lo que permite abrir un carnet en un celular ("Recordar en este celular"). No compartirlo.
- `verificacion`: código **público** del QR. Al escanearlo se abre `/v/<código>`, que muestra si el carnet está vigente.
- `foto` / `consentimiento`: fecha y hora en que subió la foto y aceptó la autorización (Ley 8968). `foto` vacío = sin foto: la página le exige una al entrar.
- **Fotos:** Storage → bucket `carnet-fotos` → `fotos/<cédula>.jpg` (360 × 480 px, ~30 KB). El bucket es privado: las fotos no tienen enlace público.
- **Seguridad:** RLS activado sin políticas y permisos quitados a `anon` y `authenticated`. Con la clave pública de Supabase no se puede leer nada de estas tablas. **No agregue políticas** a estas tablas.
- **Lista compartida con ADEP Vota:** el sistema de votaciones (repositorio `adepcr/sistema-votaciones`, tablas `vota_*` en este mismo proyecto) usa `carnet_afiliados` para saber quién puede votar y con qué nombre y filial. Solo la lee y cambia por medio de sus funciones (`supabase/votaciones.sql` de ese repositorio), nunca con la clave pública. Quien sale de la lista mensual deja de tener carnet **y** de poder votar.

Para consultar o editar a mano: Supabase → **Table Editor** (tipo hoja de cálculo) o **SQL Editor**.

---

## 4. Tareas de cada mes y de todos los días

### Rutina mensual (obligatoria)

El sistema **solo sabe quién es afiliado activo por la lista que se sube**. Si no se sube una lista nueva,
quien deja de ser afiliado sigue viendo su carnet como vigente y su carnet nunca se borra. Por eso, **una vez
al mes**, la persona encargada hace esto (unos 15 minutos), en la carpeta del proyecto en su computadora:

1. **Actualizar el proyecto:** `git pull`
2. **Sacar el reporte** del sistema de socios: *Reporte de Asociados Activos por Filial* (PDF).
3. **Copiar el texto del PDF:** abrirlo en Edge o Chrome, clic dentro del documento, **Ctrl+A** y **Ctrl+C**.
   Luego `notepad datos\reporte.txt`, pegar con **Ctrl+V** y guardar.
4. **Sacar la lista:** `npm run reporte`
   - También lee el **nombre** y la **filial** de cada persona (los usa ADEP Vota). Si dice que faltan nombres, no es grave: a esas personas se les conserva el nombre que ya tenían.
   - Debe decir *"Todas las filiales coinciden con su total del PDF"*. Si alguna no coincide, no siga: revise el texto copiado.
   - Si avisa de identificaciones con menos de 9 o más de 12 dígitos, avise a quien maneja el sistema de socios para que las corrija.
5. **Revisar los nombres de filiales** en `datos/filiales.txt` (por ejemplo `OSA(PALMAR NORTE-SUR` → `OSA (PALMAR NORTE-SUR)`) y guardar.
6. **Revisar y subir:** `npm run importar` y luego `npm run db:subir` (pide escribir SUBIR).
7. **Borrar** `datos\reporte.txt`: tiene todos los datos personales del reporte.
8. **Respaldo:** `npm run respaldo` y guardar la carpeta `respaldos/<fecha>` en el lugar seguro de ADEP.
9. **Al día siguiente**, abrir `https://carnet-adep.vercel.app/api/despertar`: debe decir `"ok":true` y la cantidad
   de afiliados nueva. Si dice `"ok":false` con un aviso, la lista subida estaba incompleta: repita desde el paso 2.

Con esto, la consulta diaria detecta sola quién salió de la lista (anota la fecha), quién volvió (la quita) y, a los
3 meses sin aparecer, borra su carnet y su foto.

**Encargado(a) de la rutina mensual:** ______________________


### Agregar UN afiliado nuevo
Supabase → **Table Editor → carnet_afiliados → Insert row**: cédula sin guiones (`102340567`) y `activo` = true.
O en el **SQL Editor**:
```sql
insert into carnet_afiliados (cedula, activo) values ('102340567', true)
on conflict (cedula) do update set activo = true, actualizado = now();
```
Para desactivar a alguien: `update carnet_afiliados set activo = false where cedula = '102340567';`

> ⚠️ Cuando se sube el Excel completo (abajo), **la lista se reemplaza**. Si agregó a alguien a mano, asegúrese de que también esté en el Excel, o desaparecerá en la siguiente carga.

### Cargar la lista completa desde un Excel (en vez del PDF)
1. Guarde el Excel como CSV en `datos/afiliados.csv` (columna `cedula`; opcional `activo`).
2. Las filiales en `datos/filiales.txt`, una por línea.
3. `npm run importar` (revisa y avisa errores) y luego `npm run db:subir` (pide escribir SUBIR).

Los carnets ya creados se conservan. `datos/afiliados.csv` nunca se sube a GitHub.

### Otras tareas

| Tarea | Cómo |
|---|---|
| Borrar una foto inadecuada (se le pide otra al entrar) | `npm run borrar-foto -- 1-0234-0567` |
| Borrar un carnet para que lo cree de nuevo | `npm run borrar-foto -- <cédula>` y luego borrar la fila en *Table Editor → carnet_carnets* |
| Corregir nombre o filial | *Table Editor → carnet_carnets*, doble clic en el dato |
| Publicar cambios del código | Subirlos a la rama principal en GitHub: Vercel publica solo |
| Respaldo | `npm run respaldo` (parte de la rutina mensual) |
| Desactivar a alguien de inmediato (renuncia a mitad de mes) | `update carnet_afiliados set activo = false where cedula = '...';` en el SQL Editor. Desde ese momento el QR dice "Carnet no vigente" |
| Ver el estado de la limpieza automática | `npm run limpiar` (solo muestra; pide SI antes de cambiar algo) |

---

## 5. Respaldos

> ⚠️ El plan **gratis** de Supabase **no guarda respaldos automáticos**. El respaldo manual es la única copia.

- **Hacer un respaldo (una vez al mes, como mínimo):** `npm run respaldo`.
  Descarga las tablas (`carnet_afiliados.json`, `carnet_filiales.json`, `carnet_carnets.json`) y todas las fotos a `respaldos/<fecha>/`.
  Esos archivos tienen **datos personales**: guárdelos cifrados o en una carpeta con acceso restringido.
- **Restaurar:** `npm run restaurar -- respaldos/<fecha>` (pide escribir RESTAURAR).
  Vuelve a cargar las filas y las fotos del respaldo. Si el proyecto es nuevo, corra antes `basedatos/supabase.sql`.
- Para probar los comandos sin tocar la base real, agregue `-- --prueba` (usa `.env.local`).

---

## 6. Límites del plan gratis

| Límite | Valor | ¿Preocupa? |
|---|---|---|
| **Pausa por inactividad (Supabase)** | 7 días sin uso | No: Vercel hace una consulta diaria (`api/despertar.js`). Si aun así se pausa, se reactiva en el panel de Supabase con *Restore* |
| Storage (Supabase) | 1 GB | ~30 000 fotos, **compartido** con lo que ADEP ya tenga. Revise en *Project Settings → Usage* |
| Base de datos (Supabase) | 500 MB | No: ~1 KB por afiliado, pero también es compartido |
| Descargas (Supabase) | 5 GB al mes | No: unas 170 000 vistas de foto; además el celular guarda el carnet |
| Respaldos (Supabase) | Ninguno automático | Sí: `npm run respaldo` mensual |
| Tráfico (Vercel Hobby) | 100 GB al mes | No |
| Uso (Vercel Hobby) | Solo no comercial | Una asociación sin fines de lucro normalmente entra; si hay dudas, plan Pro |

---

## 7. Seguridad y protección de datos (Ley 8968)

- El sistema guarda **cédula, nombre, filial, fecha de nacimiento y foto** de cada afiliado que crea su carnet.
- La lista de afiliados (`carnet_afiliados`) guarda **cédula, nombre y filial** de todos los afiliados activos, según el reporte de ADEP. La comparten el carnet y ADEP Vota. Teléfonos, direcciones y fechas del reporte **no** se guardan.
- Solo deben tener acceso al proyecto de Supabase y a Vercel las personas que administran el sistema. Revise los miembros periódicamente.
- Active la **verificación en dos pasos** en Supabase, Vercel y GitHub.
- Si cree que la clave secreta se filtró: en Supabase → *Project Settings → API Keys* cree una nueva, borre la vieja y actualícela en Vercel y en `.env.produccion`.
- Nunca suba a GitHub: `.env.local`, `.env.produccion`, `datos/afiliados.csv`, la carpeta `respaldos/` ni capturas con datos de afiliados (el `.gitignore` ya los excluye).
- Las solicitudes de acceso, corrección o borrado de datos (política de privacidad, punto 8) se atienden con las tareas de la sección 4.
- **Borrado automático:** la consulta diaria (`api/despertar.js`) borra el carnet y la foto de quien lleva **3 meses** sin aparecer como afiliado activo, como dice la política (punto 7). Si alguien vuelve a la lista antes, no se borra nada. Si de una vez desaparecen muchos afiliados (más de 50, o más del 20 % de los carnets), se detiene sin borrar y deja un aviso en Vercel → *Logs*: revise que la última lista subida esté completa. Para ver el estado: `npm run limpiar`.
- La política de privacidad está en `public/privacidad.html`. Si cambia lo que se guarda o quién lo ve, hay que actualizarla.

---

## 8. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| Nadie puede crear su carnet: "No encontramos su afiliación" | ¿Se cargó la lista? `select count(*) from carnet_afiliados where activo;` |
| Ningún carnet abre, error en todas las páginas | ¿Supabase está pausado? Panel de Supabase → *Restore project*. ¿Están bien `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en Vercel? |
| Error al guardar la foto | ¿El Storage llegó a 1 GB? *Project Settings → Usage* |
| La página no carga | Vercel → el proyecto → *Deployments* (vuelva a la versión anterior con *Instant Rollback*). Errores en *Logs* |
| Aviso "Limpieza diaria detenida" en Vercel → Logs | La última lista de afiliados subida probablemente está incompleta. Vuelva a generarla y subirla (`npm run reporte`, `importar`, `db:subir`) |
| "Demasiados intentos" | Normal tras 10 intentos fallidos desde la misma conexión; se libera en 15 minutos |
| Un celular sigue mostrando una versión vieja | Cerrar la app o el navegador y abrir de nuevo (se actualiza al haber internet) |
