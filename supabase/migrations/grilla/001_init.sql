-- ============================================================
-- SCHEMA: Disponibilidad y cobertura de mesita - Agrupación
-- ============================================================
-- Proyecto separado del de "pasadas por curso". Pensado para
-- correr en su propio proyecto de Supabase (o en uno nuevo,
-- da igual, no depende de las tablas del otro módulo).
-- ============================================================

create extension if not exists "pgcrypto";

-- Reutilizamos el mismo tipo que en el proyecto de pasadas.
-- Si este módulo vive en el MISMO proyecto de Supabase que el
-- de pasadas, borrá este bloque: el tipo ya existe.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dia_semana') then
    create type dia_semana as enum (
      'Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'
    );
  end if;
end$$;

-- ------------------------------------------------------------
-- Función auxiliar: dado un date, devuelve el dia_semana
-- correspondiente. Immutable a propósito (útil para joins e índices).
-- ------------------------------------------------------------
create or replace function dia_semana_de(f date)
returns dia_semana
language sql
immutable
as $$
  select (array['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'])[extract(isodow from f)::int]::dia_semana
$$;

-- ------------------------------------------------------------
-- MILITANTES
-- ------------------------------------------------------------
create table militantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  activo boolean not null default true
);

-- ------------------------------------------------------------
-- CURSADA_MILITANTE
-- La grilla personal de cada militante (no depende del proyecto
-- de pasadas: es la materia como la conoce el militante, texto libre).
-- Un militante puede tener varias filas (varias clases en la semana).
-- ------------------------------------------------------------
create table cursada_militante (
  id uuid primary key default gen_random_uuid(),
  militante_id uuid not null references militantes(id) on delete cascade,
  materia text not null,
  dia dia_semana not null,
  hora_inicio time not null,
  hora_fin time not null
);

create index idx_cursada_militante_dia on cursada_militante (dia);
create index idx_cursada_militante_militante on cursada_militante (militante_id);

-- ------------------------------------------------------------
-- EJES_SEMANALES
-- Un texto libre por semana (identificada por el lunes de esa semana).
-- ------------------------------------------------------------
create table ejes_semanales (
  id uuid primary key default gen_random_uuid(),
  semana date not null unique,  -- lunes de la semana
  texto text not null
);

-- ------------------------------------------------------------
-- NOTIFICACIONES_MESITA
-- Una fila por (militante, fecha a cubrir). Se crea cuando se manda
-- el mail, y se completa cuando responde (o queda sin responder).
-- El token es lo que identifica el link único de un solo uso.
-- ------------------------------------------------------------
create table notificaciones_mesita (
  id uuid primary key default gen_random_uuid(),
  militante_id uuid not null references militantes(id) on delete cascade,
  fecha date not null,               -- el día que se le está preguntando si puede cubrir
  token uuid not null default gen_random_uuid() unique,
  enviado_en timestamptz not null default now(),
  respondido_en timestamptz,
  disponible boolean,                -- null = todavía no contestó
  hora_desde time,
  hora_hasta time,
  unique (militante_id, fecha)       -- nunca se notifica dos veces el mismo día a la misma persona
);

create index idx_notif_fecha on notificaciones_mesita (fecha);
create index idx_notif_token on notificaciones_mesita (token);

-- ------------------------------------------------------------
-- VISTA: cobertura por día
-- Junta notificaciones con la clase que motivó la pregunta (si hay
-- varias clases ese día, puede devolver más de una fila por notificación,
-- que es lo esperable).
-- ------------------------------------------------------------
create view vista_cobertura_dia as
select
  n.id as notificacion_id,
  n.fecha,
  mi.id as militante_id,
  mi.nombre,
  mi.email,
  cm.materia,
  cm.hora_inicio as hora_clase_inicio,
  cm.hora_fin as hora_clase_fin,
  n.enviado_en,
  n.respondido_en,
  n.disponible,
  n.hora_desde,
  n.hora_hasta
from notificaciones_mesita n
join militantes mi on mi.id = n.militante_id
left join cursada_militante cm
  on cm.militante_id = n.militante_id
 and cm.dia = dia_semana_de(n.fecha);

-- ------------------------------------------------------------
-- RLS
-- Igual criterio que el proyecto de pasadas: sin login individual,
-- acceso abierto a nivel de policy, protegido por la clave de la app
-- a nivel frontend (no a nivel de base de datos).
--
-- OJO: la página pública de confirmación (a la que llega el link del
-- mail, SIN login) va a pegarle a Supabase con la misma anon key que
-- el resto de la app. Con esta policy abierta, esa key también puede
-- leer la tabla completa de militantes (nombres y mails de todos).
-- Para un uso puramente interno esto puede ser aceptable, pero si
-- quieren blindarlo mejor, en la etapa técnica conviene que la página
-- de confirmación NO pegue directo a la tabla, sino a una Supabase
-- Edge Function que reciba el token y devuelva/actualice solo esa fila.
-- Lo dejamos anotado para decidirlo cuando armemos el envío de mails.
-- ------------------------------------------------------------
alter table militantes enable row level security;
alter table cursada_militante enable row level security;
alter table ejes_semanales enable row level security;
alter table notificaciones_mesita enable row level security;

create policy "acceso total anon" on militantes for all using (true) with check (true);
create policy "acceso total anon" on cursada_militante for all using (true) with check (true);
create policy "acceso total anon" on ejes_semanales for all using (true) with check (true);
create policy "acceso total anon" on notificaciones_mesita for all using (true) with check (true);