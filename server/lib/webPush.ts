import webpush from 'web-push';

const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publicKey || !privateKey || !subject) {
  throw new Error('Faltan VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT en el entorno.');
}

webpush.setVapidDetails(subject, publicKey, privateKey);

export interface SuscripcionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface ResultadoEnvio {
  ok: boolean;
  statusCode?: number;
  motivo?: string;
}

// Wrapper fino sobre webpush.sendNotification: nunca tira, siempre devuelve
// el resultado (incluido el motivo del error) para poder mostrarlo en la
// pantalla de diagnóstico en vez de que falle en silencio.
export async function enviarPush(suscripcion: SuscripcionPush, payload: unknown): Promise<ResultadoEnvio> {
  try {
    const res = await webpush.sendNotification(suscripcion, JSON.stringify(payload));
    return { ok: true, statusCode: res.statusCode };
  } catch (err) {
    const statusCode = typeof err === 'object' && err && 'statusCode' in err ? Number(err.statusCode) : undefined;
    const body = typeof err === 'object' && err && 'body' in err ? String(err.body) : undefined;
    const motivo = body || (err instanceof Error ? err.message : 'Error desconocido');
    return { ok: false, statusCode, motivo };
  }
}
