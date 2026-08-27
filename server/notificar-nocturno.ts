import { supabaseAdmin } from './lib/supabaseAdmin';
import { diaSemanaDe } from './lib/dia';
import { crearPendiente, autoconfirmarPorHorarioFijo } from './lib/crearNotificacion';

// Argentina no usa horario de verano: offset fijo UTC-3.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

function fechaArgentina(offsetDias: number): string {
  const t = new Date(Date.now() - AR_OFFSET_MS + offsetDias * 24 * 60 * 60 * 1000);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Pensado para correr todas las noches vía un cron/scheduler externo (a
// definir según el hosting elegido — antes era una Netlify Scheduled
// Function). Crea la fila pendiente de militantes activos que: (a) cursan
// mañana, o (b) no tienen ninguna cursada/trabajo cargado todavía (no sabemos
// si están ocupados, así que se les pregunta igual). No manda nada por sí
// solo — el aviso (hoy el banner de Home, a futuro push) es un canal aparte.
// Nunca duplica una notificación ya creada para esa fecha, así que reintentar
// el cron el mismo día es inofensivo.
export const handler = async () => {
  const manana = fechaArgentina(1);
  const diaManana = diaSemanaDe(manana);

  // Sábado y domingo no hay mesita: no se notifica a nadie, ni siquiera a
  // quien no tiene horario cargado.
  if (diaManana === 'Sabado' || diaManana === 'Domingo') {
    console.log(`notificar-nocturno: ${manana} (${diaManana}) — sin mesita, no se notifica.`);
    return { statusCode: 200 };
  }

  const [{ data: militantes }, { data: cursadas }, { data: trabajos }, { data: yaNotificados }, { data: horariosFijos }] =
    await Promise.all([
      supabaseAdmin.from('militantes').select('id, nombre').eq('activo', true),
      supabaseAdmin.from('cursada_militante').select('militante_id, dia'),
      supabaseAdmin.from('trabajo_militante').select('militante_id'),
      supabaseAdmin.from('notificaciones_mesita').select('militante_id').eq('fecha', manana),
      supabaseAdmin.from('horario_fijo_militante').select('militante_id, hora_desde, hora_hasta').eq('dia', diaManana),
    ]);

  const diasPorMilitante = new Map<string, Set<string>>();
  for (const c of cursadas ?? []) {
    if (!diasPorMilitante.has(c.militante_id)) diasPorMilitante.set(c.militante_id, new Set());
    diasPorMilitante.get(c.militante_id)!.add(c.dia);
  }
  const conTrabajo = new Set((trabajos ?? []).map((t) => t.militante_id));
  const yaNotificadosSet = new Set((yaNotificados ?? []).map((n) => n.militante_id));

  // Si tiene más de un horario fijo el mismo día (no debería pasar, pero por
  // las dudas no se rompe), nos quedamos con el primero.
  const fijoPorMilitante = new Map<string, { hora_desde: string; hora_hasta: string }>();
  for (const h of horariosFijos ?? []) {
    if (!fijoPorMilitante.has(h.militante_id)) {
      fijoPorMilitante.set(h.militante_id, { hora_desde: h.hora_desde, hora_hasta: h.hora_hasta });
    }
  }

  const pendientes = (militantes ?? []).filter((m) => !yaNotificadosSet.has(m.id));

  // Quien tiene horario fijo para mañana no se le pregunta nada: se
  // autoconfirma directo con esos horarios (ver server/lib/crearNotificacion.ts).
  const autoconfirmar = pendientes.filter((m) => fijoPorMilitante.has(m.id));
  const candidatosPendiente = pendientes.filter((m) => {
    if (fijoPorMilitante.has(m.id)) return false;
    const diasCursada = diasPorMilitante.get(m.id);
    const tieneClaseManana = diasCursada?.has(diaManana) ?? false;
    const sinHorarioCargado = (diasCursada?.size ?? 0) === 0 && !conTrabajo.has(m.id);
    return tieneClaseManana || sinHorarioCargado;
  });

  const [resultadosAuto, resultadosPendiente] = await Promise.all([
    Promise.allSettled(
      autoconfirmar.map((m) => {
        const fijo = fijoPorMilitante.get(m.id)!;
        return autoconfirmarPorHorarioFijo(m.id, manana, fijo.hora_desde, fijo.hora_hasta);
      }),
    ),
    Promise.allSettled(candidatosPendiente.map((m) => crearPendiente(m.id, manana))),
  ]);

  const autoconfirmados = resultadosAuto.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  const creados = resultadosPendiente.filter((r) => r.status === 'fulfilled' && r.value.ok).length;

  console.log(
    `notificar-nocturno: ${manana} (${diaManana}) — ${autoconfirmados} autoconfirmados por horario fijo, ${creados} de ${candidatosPendiente.length} candidatos quedaron pendientes de responder.`,
  );
  return { statusCode: 200 };
};
