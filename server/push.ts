import { supabaseAdmin } from './lib/supabaseAdmin.ts';
import { enviarPush, type SuscripcionPush } from './lib/webPush.ts';

interface DatosSuscripcion {
  militanteId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export async function suscribirPush(datos: DatosSuscripcion): Promise<void> {
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      militante_id: datos.militanteId,
      endpoint: datos.endpoint,
      p256dh: datos.keys.p256dh,
      auth: datos.keys.auth,
      user_agent: datos.userAgent ?? null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

export async function eliminarSuscripcionPush(endpoint: string): Promise<void> {
  const { error } = await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}

interface ResultadoPorSuscripcion {
  endpoint: string;
  ok: boolean;
  statusCode?: number;
  motivo?: string;
}

// Manda una notificación de prueba a TODAS las suscripciones activas del
// militante (puede tener varios dispositivos). Si el push service devuelve
// 404/410 (suscripción vencida/inválida), la borramos de una vez.
export async function enviarPruebaPush(militanteId: string): Promise<ResultadoPorSuscripcion[]> {
  const { data: suscripciones, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('militante_id', militanteId);
  if (error) throw new Error(error.message);
  if (!suscripciones || suscripciones.length === 0) {
    throw new Error('No hay ninguna suscripción guardada para este militante todavía.');
  }

  const resultados: ResultadoPorSuscripcion[] = [];
  for (const s of suscripciones) {
    const suscripcion: SuscripcionPush = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    const resultado = await enviarPush(suscripcion, {
      title: 'PI Interna',
      body: 'Notificación de prueba — si ves esto, el push funciona.',
      url: '/',
    });
    resultados.push({ endpoint: s.endpoint, ...resultado });
    if (!resultado.ok && (resultado.statusCode === 404 || resultado.statusCode === 410)) {
      await eliminarSuscripcionPush(s.endpoint);
    }
  }
  return resultados;
}
