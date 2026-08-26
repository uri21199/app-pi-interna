-- ============================================================
-- SCHEMA: Inventario de materiales de campaña (volantes, afiches,
-- cintas, banderines, etc.)
-- ============================================================
-- Un pizarrón compartido: cualquier militante ve qué hay y qué no,
-- y puede marcar "lo compro yo" para que no se duplique la compra.
-- Vive en el mismo proyecto de Supabase que grilla/pasadas (ya
-- referencia militantes(id) directamente).
-- ============================================================

create extension if not exists "pgcrypto";

create table materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  en_stock boolean not null default true,
  -- Quién se anotó para comprarlo mientras está sin stock. Null = nadie.
  comprando_militante_id uuid references militantes(id) on delete set null,
  comprando_desde timestamptz,
  notas text,
  creado_en timestamptz not null default now()
);

create index idx_materiales_en_stock on materiales (en_stock);

-- ------------------------------------------------------------
-- VISTA: materiales con el nombre de quién lo está comprando
-- (evita otro round-trip al frontend para resolver el nombre).
-- ------------------------------------------------------------
create view vista_materiales as
select
  m.id,
  m.nombre,
  m.en_stock,
  m.comprando_militante_id,
  mi.nombre as comprando_nombre,
  m.comprando_desde,
  m.notas,
  m.creado_en
from materiales m
left join militantes mi on mi.id = m.comprando_militante_id;

-- ------------------------------------------------------------
-- RLS: mismo criterio que el resto de la app (grilla/pasadas) —
-- acceso abierto a nivel de policy, protegido por las rutas del
-- frontend (RequireAuth), no por RLS real.
-- ------------------------------------------------------------
alter table materiales enable row level security;
create policy "acceso total anon" on materiales for all using (true) with check (true);
