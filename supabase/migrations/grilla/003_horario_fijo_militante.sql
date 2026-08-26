-- ============================================================
-- HORARIO_FIJO_MILITANTE
-- Compromiso recurrente de un militante para cubrir la mesita
-- (ej: "todos los martes de 15 a 17"). A diferencia de
-- notificaciones_mesita (una fila por día puntual), esto se repite
-- solo por día de la semana, sin fecha.
--
-- El cron nocturno (server/notificar-nocturno.ts) lo consulta: si
-- un militante tiene un horario fijo para el día de mañana, NO se
-- le manda el mail preguntando — se crea directamente la fila de
-- notificaciones_mesita ya confirmada con esos horarios. Si un día
-- puntual no puede pese al horario fijo, es responsabilidad suya
-- avisarlo desde "Mis próximos turnos" (en Mi perfil): eso crea la
-- fila de notificaciones_mesita en false ANTES de que corra el cron,
-- así que el cron la encuentra ya existente y no autoconfirma nada
-- ese día — sin tocar ni borrar el horario fijo en sí.
-- ============================================================

create table horario_fijo_militante (
  id uuid primary key default gen_random_uuid(),
  militante_id uuid not null references militantes(id) on delete cascade,
  dia dia_semana not null,
  hora_desde time not null,
  hora_hasta time not null,
  creado_en timestamptz not null default now()
);

create index idx_horario_fijo_militante_dia on horario_fijo_militante (dia);
create index idx_horario_fijo_militante_militante on horario_fijo_militante (militante_id);

alter table horario_fijo_militante enable row level security;
create policy "acceso total anon" on horario_fijo_militante for all using (true) with check (true);
