import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarAdmin } from '../../server/verificarAdmin.ts';
import { eliminarSuscripcionPush } from '../../server/push.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    await verificarAdmin(token);

    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    if (!endpoint) {
      res.status(400).json({ ok: false, error: 'Falta endpoint' });
      return;
    }

    await eliminarSuscripcionPush(endpoint);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error interno' });
  }
}
