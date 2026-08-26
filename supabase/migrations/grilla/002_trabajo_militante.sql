-- ------------------------------------------------------------
-- TRABAJO_MILITANTE
-- Horarios de trabajo de cada militante (informativo, no dispara
-- notificaciones — el trigger de la mesita es la cursada, no el
-- trabajo). Mismo criterio que cursada_militante: texto libre,
-- varias filas por militante.
-- ------------------------------------------------------------
create table trabajo_militante (
  id uuid primary key default gen_random_uuid(),
  militante_id uuid not null references militantes(id) on delete cascade,
  dia dia_semana not null,
  hora_inicio time not null,
  hora_fin time not null
);

create index idx_trabajo_militante_dia on trabajo_militante (dia);
create index idx_trabajo_militante_militante on trabajo_militante (militante_id);

alter table trabajo_militante enable row level security;
create policy "acceso total anon" on trabajo_militante for all using (true) with check (true);
