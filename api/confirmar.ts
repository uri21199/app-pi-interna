import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler as confirmarHandler } from '../server/confirmar.ts';

// Página pública /grilla/confirmar/:token (sin login: se abre desde el aviso
// de Home o, a futuro, una notificación push): adapta el request/response de
// Vercel al contrato genérico que ya espera server/confirmar.ts (mismo shape
// que usa devApiPlugin.ts en dev).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tokenParam = req.query.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  const resultado = await confirmarHandler({
    httpMethod: req.method ?? 'GET',
    queryStringParameters: { token },
    body: req.body ? JSON.stringify(req.body) : undefined,
  });

  res.status(resultado.statusCode);
  for (const [nombre, valor] of Object.entries(resultado.headers ?? {})) {
    res.setHeader(nombre, valor);
  }
  res.send(resultado.body);
}
