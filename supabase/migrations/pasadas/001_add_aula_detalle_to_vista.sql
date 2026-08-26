-- La vista original (schema_supabase.sql) no expone aula_detalle,
-- pero la pantalla principal necesita mostrarlo cuando
-- aula_cambia_durante_cuatri es true. Reemplazo aditivo, no destructivo.
--
-- Postgres solo permite agregar columnas al FINAL de una vista con
-- CREATE OR REPLACE VIEW (no se puede insertar en el medio ni reordenar),
-- por eso aula_detalle va después de las columnas originales.
create or replace view vista_bloques_estado as
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
  ) as ultima_pasada,
  b.aula_detalle
from bloques_horario b
join comisiones c on c.id = b.comision_id
join materias m on m.id = c.materia_id
left join comision_carreras cc on cc.comision_id = c.id
left join carreras cr on cr.id = cc.carrera_id
group by b.id, c.id, m.nombre, c.nombre_comision, b.dia, b.hora_inicio,
         b.hora_fin, b.tipo, b.aula, b.aula_cambia_durante_cuatri, b.aula_detalle;
