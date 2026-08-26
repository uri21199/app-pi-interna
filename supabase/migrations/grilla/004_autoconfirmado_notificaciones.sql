-- ============================================================
-- notificaciones_mesita.autoconfirmado
-- Distingue una fila creada automáticamente a partir de un horario
-- fijo (server/lib/crearNotificacion.ts::autoconfirmarPorHorarioFijo,
-- o la materialización que hace MisTurnosMesita en el cliente) de una
-- respuesta real de la persona (mail, o los botones de "Mis próximos
-- turnos"). Hace falta para poder deshacer: si se borra un horario
-- fijo, hay que limpiar las filas futuras que existían SOLO por ese
-- horario — sin esta marca no hay forma de saber cuáles son.
-- ============================================================

alter table notificaciones_mesita
  add column autoconfirmado boolean not null default false;
