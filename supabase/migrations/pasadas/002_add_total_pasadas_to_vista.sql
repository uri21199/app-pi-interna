-- Agrega el conteo total de pasadas históricas por comisión a la vista,
-- para poder mostrar "pasado N veces" además de la última fecha.
-- Reemplazo aditivo, no destructivo.
--
-- Requiere haber corrido antes 001_add_aula_detalle_to_vista.sql: Postgres
-- solo permite agregar columnas al FINAL de una vista, así que total_pasadas
-- va después de aula_detalle (la última columna que agregó 001).
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
  b.aula_detalle,
  (
    select count(*) from pasadas p where p.comision_id = c.id
  ) as total_pasadas
from bloques_horario b
join comisiones c on c.id = b.comision_id
join materias m on m.id = c.materia_id
left join comision_carreras cc on cc.comision_id = c.id
left join carreras cr on cr.id = cc.carrera_id
group by b.id, c.id, m.nombre, c.nombre_comision, b.dia, b.hora_inicio,
         b.hora_fin, b.tipo, b.aula, b.aula_cambia_durante_cuatri, b.aula_detalle;
