-- ============================================================
-- SCHEMA: Gestión de Pasadas por Cursos - FIUBA
-- ============================================================
-- Diseñado para Supabase (Postgres). Corre este script completo
-- en el SQL Editor de tu proyecto de Supabase.
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- CARRERAS
-- ------------------------------------------------------------
create table carreras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

-- ------------------------------------------------------------
-- MATERIAS
-- ------------------------------------------------------------
create table materias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text,
  unique (nombre)
);

-- ------------------------------------------------------------
-- COMISIONES
-- Una comisión = materia + curso/docente. NUNCA se duplica por
-- carrera (eso lo resuelve la tabla puente comision_carreras).
-- ------------------------------------------------------------
create table comisiones (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid not null references materias(id) on delete cascade,
  nombre_comision text not null,   -- ej. "CURSO 02 - LOPEZ"
  observaciones text,
  unique (materia_id, nombre_comision)
);

-- ------------------------------------------------------------
-- COMISION_CARRERAS (tabla puente many-to-many)
-- ------------------------------------------------------------
create table comision_carreras (
  comision_id uuid not null references comisiones(id) on delete cascade,
  carrera_id uuid not null references carreras(id) on delete cascade,
  primary key (comision_id, carrera_id)
);

-- ------------------------------------------------------------
-- BLOQUES_HORARIO
-- Una fila por franja horaria real (teórica y práctica separadas).
-- Esto reemplaza el texto pegado tipo "07:00-09:00 Teo.\n09:00-11:00 Prác."
-- ------------------------------------------------------------
create type dia_semana as enum (
  'Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'
);

create table bloques_horario (
  id uuid primary key default gen_random_uuid(),
  comision_id uuid not null references comisiones(id) on delete cascade,
  dia dia_semana not null,
  hora_inicio time not null,
  hora_fin time not null,
  tipo text,                 -- 'Teo.', 'Prác.', 'T-P', 'Desarrol', etc.
  aula text,
  aula_cambia_durante_cuatri boolean default false,  -- viene de un "→" en la fuente original
  aula_detalle text          -- texto crudo original si hay cambios de aula, para no perder info
);

create index idx_bloques_dia on bloques_horario (dia);
create index idx_bloques_comision on bloques_horario (comision_id);

-- ------------------------------------------------------------
-- PASADAS
-- Log histórico: cada vez que se marca una comisión como pasada
-- queda un registro con fecha. Nunca se borra ni se pisa.
-- El "pendiente / hecho de esta semana" se calcula, no se guarda.
-- ------------------------------------------------------------
create table pasadas (
  id uuid primary key default gen_random_uuid(),
  comision_id uuid not null references comisiones(id) on delete cascade,
  fecha date not null default current_date,
  -- lunes de la semana correspondiente a "fecha". Se calcula con extract(isodow)
  -- (lunes=1 ... domingo=7) en vez de date_trunc (que sobre date resuelve a una
  -- función STABLE), y con make_interval en vez de concatenar texto (el
  -- operador || para armar un interval no está marcado IMMUTABLE en Postgres).
  semana date generated always as (
    (fecha - make_interval(days => (extract(isodow from fecha)::int - 1)))::date
  ) stored,
  nota text,
  creado_en timestamptz not null default now()
);

create index idx_pasadas_comision_semana on pasadas (comision_id, semana);

-- ------------------------------------------------------------
-- VISTA: estado actual de cada comisión (para la pantalla principal)
-- Devuelve, por cada bloque de horario, si esa comisión ya tiene
-- una pasada registrada en la semana actual.
-- ------------------------------------------------------------
create view vista_bloques_estado as
select
  b.id as bloque_id,
  c.id as comision_id,
  m.nombre as materia,
  c.nombre_comision,
  b.dia,
  b.hora_inicio,
  b.hora_fin,
  b.tipo,
  b.aula,
  b.aula_cambia_durante_cuatri,
  coalesce(
    array_agg(distinct cr.nombre) filter (where cr.nombre is not null),
    '{}'
  ) as carreras,
  exists (
    select 1 from pasadas p
    where p.comision_id = c.id
      and p.semana = (current_date - make_interval(days => (extract(isodow from current_date)::int - 1)))::date
  ) as pasada_esta_semana,
  (
    select max(p.fecha) from pasadas p where p.comision_id = c.id
  ) as ultima_pasada
from bloques_horario b
join comisiones c on c.id = b.comision_id
join materias m on m.id = c.materia_id
left join comision_carreras cc on cc.comision_id = c.id
left join carreras cr on cr.id = cc.carrera_id
group by b.id, c.id, m.nombre, c.nombre_comision, b.dia, b.hora_inicio,
         b.hora_fin, b.tipo, b.aula, b.aula_cambia_durante_cuatri;

-- ------------------------------------------------------------
-- RLS (Row Level Security)
-- Es una app interna sin login individual (clave compartida a nivel
-- app, controlada en el frontend). Habilitamos RLS mínimo y damos
-- acceso completo al rol anónimo. La protección real es que el link
-- y la clave de acceso a la app no se comparten fuera de la agrupación.
-- ------------------------------------------------------------
alter table carreras enable row level security;
alter table materias enable row level security;
alter table comisiones enable row level security;
alter table comision_carreras enable row level security;
alter table bloques_horario enable row level security;
alter table pasadas enable row level security;

create policy "acceso total anon" on carreras for all using (true) with check (true);
create policy "acceso total anon" on materias for all using (true) with check (true);
create policy "acceso total anon" on comisiones for all using (true) with check (true);
create policy "acceso total anon" on comision_carreras for all using (true) with check (true);
create policy "acceso total anon" on bloques_horario for all using (true) with check (true);
create policy "acceso total anon" on pasadas for all using (true) with check (true);
