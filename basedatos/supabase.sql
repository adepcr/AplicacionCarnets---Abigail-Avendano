-- =====================================================================
--  Mi Carnet ADEP — base de datos en Supabase
--
--  Cómo usarlo: en Supabase, abra "SQL Editor", pegue TODO este archivo
--  y toque "Run". Se puede correr más de una vez sin perder datos.
--
--  Todas las tablas empiezan con "carnet_" para poder convivir con otras
--  tablas del mismo proyecto de Supabase sin mezclarse.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

-- Lista oficial de ADEP: quién puede crear su carnet.
-- Para agregar un afiliado basta con agregar una fila (Table Editor).
create table if not exists public.carnet_afiliados (
  cedula      text primary key check (cedula ~ '^([0-9]{9}|[0-9]{11,12})$'),   -- cédula (9) o DIMEX (11-12), sin guiones
  activo      boolean not null default true,
  actualizado timestamptz not null default now()
);
comment on table public.carnet_afiliados is
  'Afiliados de ADEP que pueden crear su carnet. Cédula de 9 dígitos o DIMEX de 11-12, sin guiones (ej. 102340567).';

-- Filiales que el afiliado puede elegir al crear su carnet.
create table if not exists public.carnet_filiales (
  nombre text primary key check (length(trim(nombre)) > 0)
);
comment on table public.carnet_filiales is 'Filiales que aparecen en la lista de "Crear mi carnet".';

-- Carnets creados por los mismos afiliados.
create table if not exists public.carnet_carnets (
  cedula         text primary key check (cedula ~ '^([0-9]{9}|[0-9]{11,12})$'),
  nombre         text not null check (length(nombre) between 5 and 80),
  filial         text not null,
  nacimiento     date not null,                     -- clave para volver a ver el carnet
  token          uuid not null unique,              -- SECRETO: "recordar en este celular"
  verificacion   text unique,                       -- público: código del QR (/v/<código>)
  creado         date not null default current_date,
  foto           timestamptz,                       -- cuándo subió su foto (null = sin foto)
  consentimiento timestamptz                        -- cuándo autorizó guardar su foto (Ley 8968)
);
comment on table public.carnet_carnets is
  'Carnets creados por los afiliados. La foto está en Storage, bucket carnet-fotos, como fotos/<cedula>.jpg.';
comment on column public.carnet_carnets.token is 'Secreto. Nunca compartirlo: permite abrir el carnet.';

-- Intentos fallidos por IP, para frenar a quien pruebe muchas cédulas o fechas.
-- Se borran solos a los 15 minutos.
create table if not exists public.carnet_intentos (
  id    bigint generated always as identity primary key,
  ip    text not null,
  fecha timestamptz not null default now()
);
create index if not exists carnet_intentos_ip_fecha on public.carnet_intentos (ip, fecha);

-- Aceptar también DIMEX (11 o 12 dígitos) en bases creadas cuando solo se aceptaban 9.
alter table public.carnet_afiliados drop constraint if exists carnet_afiliados_cedula_check;
alter table public.carnet_afiliados add  constraint carnet_afiliados_cedula_check
  check (cedula ~ '^([0-9]{9}|[0-9]{11,12})$');
alter table public.carnet_carnets drop constraint if exists carnet_carnets_cedula_check;
alter table public.carnet_carnets add  constraint carnet_carnets_cedula_check
  check (cedula ~ '^([0-9]{9}|[0-9]{11,12})$');


-- ---------------------------------------------------------------------
-- 2. Seguridad
--    La página web NUNCA se conecta a Supabase desde el celular: solo el
--    servidor (Vercel) lo hace, con la clave secreta. Por eso se activa
--    RLS SIN políticas: nadie con la clave pública (anon) puede leer nada.
-- ---------------------------------------------------------------------
alter table public.carnet_afiliados enable row level security;
alter table public.carnet_filiales  enable row level security;
alter table public.carnet_carnets   enable row level security;
alter table public.carnet_intentos  enable row level security;

revoke all on public.carnet_afiliados, public.carnet_filiales,
              public.carnet_carnets,   public.carnet_intentos
  from anon, authenticated;

-- Solo el servidor (clave secreta = rol service_role) puede usar estas tablas.
-- Los proyectos nuevos de Supabase ya no dan este permiso solos: sin esto, todo responde 403.
grant usage on schema public to service_role;
grant select, insert, update, delete
  on public.carnet_afiliados, public.carnet_filiales,
     public.carnet_carnets,   public.carnet_intentos
  to service_role;


-- ---------------------------------------------------------------------
-- 3. Reemplazar la lista de afiliados y de filiales (desde el Excel)
--    Todo ocurre en un solo paso: si algo falla, no se cambia nada.
--    Los carnets ya creados se conservan.
-- ---------------------------------------------------------------------
create or replace function public.carnet_reemplazar_listas(afiliados jsonb, filiales jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.carnet_afiliados where true;
  insert into public.carnet_afiliados (cedula, activo)
    select a->>'cedula', (a->>'activo')::boolean
    from jsonb_array_elements(afiliados) as a;

  delete from public.carnet_filiales where true;
  insert into public.carnet_filiales (nombre)
    select f #>> '{}' from jsonb_array_elements(filiales) as f;

  return jsonb_build_object(
    'afiliados', (select count(*) from public.carnet_afiliados),
    'activos',   (select count(*) from public.carnet_afiliados where activo),
    'filiales',  (select count(*) from public.carnet_filiales)
  );
end;
$$;
revoke all on function public.carnet_reemplazar_listas(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.carnet_reemplazar_listas(jsonb, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- 4. Fotos: bucket PRIVADO (las fotos no tienen enlace público)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carnet-fotos', 'carnet-fotos', false, 500000, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 500000, allowed_mime_types = array['image/jpeg'];
