import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarAdmin } from '../../server/verificarAdmin.ts';
import { suscribirPush } from '../../server/push.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    await verificarAdmin(token);

    const { militanteId, endpoint, keys, userAgent } = (req.body ?? {}) as {
      militanteId?: string;
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      userAgent?: string;
    };
    if (!militanteId || !endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ ok: false, error: 'Faltan militanteId, endpoint o keys' });
      return;
    }

    await suscribirPush({ militanteId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error interno' });
  }
}
