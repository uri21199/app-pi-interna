import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

async function leerBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

function jsonResponse(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Puente SOLO para `npm run dev`: expone algunas funciones de server/ como
// endpoints HTTP para poder probar la app completa en local sin haber
// elegido todavía dónde alojarla. No corre en `vite build`/`vite preview`
// (`apply: 'serve'`). Cuando se elija el hosting, cada uno de estos handlers
// se reemplaza por el equivalente real de esa plataforma (mismos contratos).
export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-bridge',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Alta de militante con contraseña elegida por el admin — requiere
      // service role key, que nunca puede vivir en el bundle del cliente.
      server.middlewares.use('/api/admin/crear-militante', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarAdmin } = await import('./server/verificarAdmin.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          await verificarAdmin(token);

          const body = JSON.parse(await leerBody(req));
          const { nombre, email, password, rol } = body as {
            nombre?: string;
            email?: string;
            password?: string;
            rol?: 'militante' | 'admin';
          };
          if (!nombre || !email || !password) {
            jsonResponse(res, 400, { ok: false, error: 'Faltan nombre, email o password' });
            return;
          }

          const { crearMilitante } = await import('./server/crearMilitante.ts');
          const resultado = await crearMilitante({ nombre, email, password });

          if (rol === 'admin') {
            const { supabaseAdmin } = await import('./server/lib/supabaseAdmin.ts');
            const { error } = await supabaseAdmin.from('militantes').update({ rol: 'admin' }).eq('id', resultado.militanteId);
            if (error) throw new Error(error.message);
          }

          jsonResponse(res, 200, { ok: true, ...resultado });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      // Editar el email de un militante: sincroniza auth.users además de la
      // tabla militantes — también requiere service role.
      server.middlewares.use('/api/admin/actualizar-email', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarAdmin } = await import('./server/verificarAdmin.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          await verificarAdmin(token);

          const body = JSON.parse(await leerBody(req));
          const { militanteId, email } = body as { militanteId?: string; email?: string };
          if (!militanteId || !email) {
            jsonResponse(res, 400, { ok: false, error: 'Faltan militanteId o email' });
            return;
          }

          const { actualizarEmailMilitante } = await import('./server/actualizarEmail.ts');
          await actualizarEmailMilitante(militanteId, email);

          jsonResponse(res, 200, { ok: true });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      // Diagnóstico de Web Push (ver src/features/notificaciones): guardar
      // una suscripción, mandarse una notificación de prueba, o borrar una
      // suscripción vencida. Todos requieren admin, mismo criterio que el
      // resto de /api/admin/*.
      server.middlewares.use('/api/push/suscribir', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarAdmin } = await import('./server/verificarAdmin.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          await verificarAdmin(token);

          const body = JSON.parse(await leerBody(req));
          const { militanteId, endpoint, keys, userAgent } = body as {
            militanteId?: string;
            endpoint?: string;
            keys?: { p256dh?: string; auth?: string };
            userAgent?: string;
          };
          if (!militanteId || !endpoint || !keys?.p256dh || !keys?.auth) {
            jsonResponse(res, 400, { ok: false, error: 'Faltan militanteId, endpoint o keys' });
            return;
          }

          const { suscribirPush } = await import('./server/push.ts');
          await suscribirPush({ militanteId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent });
          jsonResponse(res, 200, { ok: true });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      server.middlewares.use('/api/push/eliminar', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarAdmin } = await import('./server/verificarAdmin.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          await verificarAdmin(token);

          const body = JSON.parse(await leerBody(req));
          const { endpoint } = body as { endpoint?: string };
          if (!endpoint) {
            jsonResponse(res, 400, { ok: false, error: 'Falta endpoint' });
            return;
          }

          const { eliminarSuscripcionPush } = await import('./server/push.ts');
          await eliminarSuscripcionPush(endpoint);
          jsonResponse(res, 200, { ok: true });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      server.middlewares.use('/api/push/enviar-prueba', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarAdmin } = await import('./server/verificarAdmin.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          await verificarAdmin(token);

          const body = JSON.parse(await leerBody(req));
          const { militanteId } = body as { militanteId?: string };
          if (!militanteId) {
            jsonResponse(res, 400, { ok: false, error: 'Falta militanteId' });
            return;
          }

          const { enviarPruebaPush } = await import('./server/push.ts');
          const resultados = await enviarPruebaPush(militanteId);
          jsonResponse(res, 200, { ok: true, resultados });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      // Responder disponibilidad de mesita desde la app (manual o
      // autoconfirmación por horario fijo) — notificaciones_mesita es de
      // solo-lectura para `authenticated`, así que esto tiene que pasar por
      // el servidor con service role. Cualquier militante logueado puede
      // llamarlo (no requiere admin), pero el militanteId se resuelve del
      // propio token, nunca del body.
      server.middlewares.use('/api/mesita/responder', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarSesion } = await import('./server/verificarSesion.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          const { militanteId } = await verificarSesion(token);

          const body = JSON.parse(await leerBody(req));
          const { fecha, disponible, hora_desde, hora_hasta, autoconfirmado } = body as {
            fecha?: string;
            disponible?: boolean;
            hora_desde?: string;
            hora_hasta?: string;
            autoconfirmado?: boolean;
          };
          if (!fecha || typeof disponible !== 'boolean') {
            jsonResponse(res, 400, { ok: false, error: 'Faltan fecha o disponible' });
            return;
          }

          const { responderMesita } = await import('./server/mesita.ts');
          const data = await responderMesita({ militanteId, fecha, disponible, horaDesde: hora_desde, horaHasta: hora_hasta, autoconfirmado });
          jsonResponse(res, 200, { ok: true, data });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      server.middlewares.use('/api/mesita/limpiar-autoconfirmados', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { ok: false, error: 'Método no permitido' });
          return;
        }
        try {
          const { verificarSesion } = await import('./server/verificarSesion.ts');
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
          const { militanteId } = await verificarSesion(token);

          const body = JSON.parse(await leerBody(req));
          const { dia } = body as { dia?: string };
          if (!dia) {
            jsonResponse(res, 400, { ok: false, error: 'Falta dia' });
            return;
          }

          const { limpiarAutoconfirmados } = await import('./server/mesita.ts');
          const borradas = await limpiarAutoconfirmados(militanteId, dia);
          jsonResponse(res, 200, { ok: true, borradas });
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Error interno' });
        }
      });

      // Página pública /grilla/confirmar/:token (sin login: se abre desde el
      // aviso de Home o, a futuro, una notificación push): expone
      // server/confirmar.ts, que hoy no tiene ningún otro lugar donde vivir
      // porque se sacó el redirect /api/* que tenía netlify.toml.
      server.middlewares.use('/api/confirmar', async (req, res) => {
        try {
          const { handler } = await import('./server/confirmar.ts');
          const url = new URL(req.url ?? '/', 'http://localhost');
          const queryStringParameters = Object.fromEntries(url.searchParams.entries());
          const body = req.method === 'POST' ? await leerBody(req) : undefined;

          const resultado = await handler({
            httpMethod: req.method ?? 'GET',
            queryStringParameters,
            body,
          });

          res.statusCode = resultado.statusCode;
          for (const [nombre, valor] of Object.entries(resultado.headers ?? {})) {
            res.setHeader(nombre, valor);
          }
          res.end(resultado.body);
        } catch (err) {
          jsonResponse(res, 500, { error: err instanceof Error ? err.message : 'Error interno' });
        }
      });
    },
  };
}
