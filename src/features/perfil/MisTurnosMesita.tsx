import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/supabase';
import { Cargando } from '../../shared/Spinner';
import { addDays, diaSemanaDe, formatDateLocal, formatFechaLarga } from '../grilla/lib/dia';
import type { HorarioFijoMilitante, NotificacionMesita } from '../grilla/types/db';
import { useAuth, type MilitantePerfil } from '../../shared/AuthProvider';

const DIAS_A_MOSTRAR = 10; // días hábiles (se saltea sábado/domingo, sin mesita esos días)

function Mensaje({ texto }: { texto: string | null }) {
  if (!texto) return null;
  const esError = texto.startsWith('Error');
  return (
    <p
      role="alert"
      aria-live={esError ? 'assertive' : 'polite'}
      className={`mt-2 rounded-lg p-2 text-sm ${esError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
    >
      {texto}
    </p>
  );
}

function errorAmigable(accion: string, error: unknown): string {
  console.error(error);
  return `Error: no se pudo ${accion}. Probá de nuevo en un momento.`;
}

interface RespuestaMesita {
  fecha: string;
  disponible: boolean;
  horaDesde?: string;
  horaHasta?: string;
  autoconfirmado?: boolean;
}

// notificaciones_mesita es de solo-lectura para `authenticated` (RLS): toda
// escritura real tiene que pasar por este endpoint, que usa la service role
// key server-side (ver server/mesita.ts).
async function responderMesitaApi(accessToken: string, input: RespuestaMesita): Promise<NotificacionMesita> {
  const res = await fetch('/api/mesita/responder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      fecha: input.fecha,
      disponible: input.disponible,
      hora_desde: input.horaDesde,
      hora_hasta: input.horaHasta,
      autoconfirmado: input.autoconfirmado,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'No se pudo guardar la respuesta');
  return body.data as NotificacionMesita;
}

interface Props {
  perfil: MilitantePerfil;
  // Se incrementa desde HorarioFijoMesita cuando se agrega/borra un horario
  // fijo: sin esto, esta lista quedaría desactualizada hasta el próximo
  // refresh de página (son componentes hermanos, no comparten estado solos).
  refrescarSenal: number;
}

export function MisTurnosMesita({ perfil, refrescarSenal }: Props) {
  const { session } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Record<string, NotificacionMesita>>({});
  const [horariosFijos, setHorariosFijos] = useState<HorarioFijoMilitante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [editandoFecha, setEditandoFecha] = useState<string | null>(null);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');

  const fechas = useMemo(() => {
    const hoy = formatDateLocal(new Date());
    const lista: string[] = [];
    for (let i = 0; lista.length < DIAS_A_MOSTRAR; i++) {
      const f = addDays(hoy, i);
      const dia = diaSemanaDe(f);
      if (dia !== 'Sabado' && dia !== 'Domingo') lista.push(f);
    }
    return lista;
  }, []);

  useEffect(() => {
    if (!session) return;
    let activo = true;
    setCargando(true);
    Promise.all([
      supabase
        .from('notificaciones_mesita')
        .select('*')
        .eq('militante_id', perfil.id)
        .gte('fecha', fechas[0])
        .lte('fecha', fechas[fechas.length - 1]),
      supabase.from('horario_fijo_militante').select('*').eq('militante_id', perfil.id),
    ]).then(async ([{ data: n }, { data: h }]) => {
      if (!activo) return;
      const porFecha: Record<string, NotificacionMesita> = Object.fromEntries((n ?? []).map((row) => [row.fecha, row]));
      const fijos = h ?? [];

      // El cron nocturno es el que en teoría autoconfirma los días con
      // horario fijo, pero todavía no tiene disparador (no corre solo) —
      // así que mientras tanto, esta pantalla escribe directo (vía el
      // servidor, ver server/mesita.ts) apenas detecta un día con horario
      // fijo sin fila todavía. Así "Mis próximos turnos" no es solo una
      // proyección: lo que se ve acá es lo que va a aparecer en el Resumen
      // de cobertura.
      const faltantes = fechas.filter((f) => !porFecha[f] && fijos.some((hf) => hf.dia === diaSemanaDe(f)));
      let fallaronAlgunas = false;
      for (const fecha of faltantes) {
        const fijo = fijos.find((hf) => hf.dia === diaSemanaDe(fecha))!;
        try {
          porFecha[fecha] = await responderMesitaApi(session.access_token, {
            fecha,
            disponible: true,
            horaDesde: fijo.hora_desde,
            horaHasta: fijo.hora_hasta,
            autoconfirmado: true,
          });
        } catch (err) {
          console.error(err);
          fallaronAlgunas = true;
        }
      }

      if (!activo) return;
      setNotificaciones(porFecha);
      setHorariosFijos(fijos);
      setCargando(false);
      if (fallaronAlgunas) {
        setMensaje('Error: no se pudo autoconfirmar alguno de tus días con horario fijo. Probá recargar la página.');
      }
    });
    return () => {
      activo = false;
    };
    // fechas se deriva de "hoy" en el primer render, no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.id, session, refrescarSenal]);

  function abrirEdicion(fecha: string, fijo?: HorarioFijoMilitante) {
    setEditandoFecha(fecha);
    setHoraDesde(fijo?.hora_desde.slice(0, 5) ?? '');
    setHoraHasta(fijo?.hora_hasta.slice(0, 5) ?? '');
    setMensaje(null);
  }

  async function guardarRespuesta(fecha: string, disponible: boolean) {
    if (!session) return;
    if (disponible && (!horaDesde || !horaHasta || horaDesde >= horaHasta)) {
      setMensaje('Error: revisá el horario (desde tiene que ser antes que hasta).');
      return;
    }
    setOcupada(fecha);
    setMensaje(null);
    try {
      const data = await responderMesitaApi(session.access_token, {
        fecha,
        disponible,
        horaDesde: disponible ? horaDesde : undefined,
        horaHasta: disponible ? horaHasta : undefined,
        autoconfirmado: false,
      });
      setNotificaciones((prev) => ({ ...prev, [fecha]: data }));
      setEditandoFecha(null);
      setMensaje(disponible ? 'Disponibilidad guardada.' : 'Anotado que no vas a poder.');
    } catch (err) {
      setMensaje(errorAmigable('guardar tu respuesta', err));
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-slate-700">Mis próximos turnos de mesita</h2>
      <p className="mt-1 text-xs text-slate-500">
        Los días con horario fijo se autoconfirman solos. Si alguno puntual no te sirve, cancelalo acá sin tocar el
        horario fijo.
      </p>

      {cargando && <Cargando className="mt-2 text-sm text-slate-400" />}
      <Mensaje texto={mensaje} />

      {!cargando && (
        <div className="mt-2 space-y-1.5">
          {fechas.map((fecha) => {
            const notif = notificaciones[fecha];
            const fijo = horariosFijos.find((h) => h.dia === diaSemanaDe(fecha));
            const enEdicion = editandoFecha === fecha;
            const ocupado = ocupada === fecha;

            return (
              <div key={fecha} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <p className="text-xs font-medium capitalize text-slate-400">{formatFechaLarga(fecha)}</p>

                {enEdicion ? (
                  <div className="mt-1.5 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-slate-600">
                      Desde
                      <input
                        type="time"
                        value={horaDesde}
                        onChange={(e) => setHoraDesde(e.target.value)}
                        className="mt-0.5 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Hasta
                      <input
                        type="time"
                        value={horaHasta}
                        onChange={(e) => setHoraHasta(e.target.value)}
                        className="mt-0.5 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      onClick={() => guardarRespuesta(fecha, true)}
                      disabled={ocupado}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Puedo
                    </button>
                    <button
                      onClick={() => guardarRespuesta(fecha, false)}
                      disabled={ocupado}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
                    >
                      No puedo
                    </button>
                    <button
                      onClick={() => setEditandoFecha(null)}
                      className="text-xs font-medium text-slate-400"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : notif ? (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-700">
                      {notif.disponible === null && 'Pendiente de respuesta.'}
                      {notif.disponible === true && (
                        <>
                          Disponible {notif.hora_desde?.slice(0, 5)}–{notif.hora_hasta?.slice(0, 5)}
                          {fijo && <span className="text-xs text-slate-400"> (horario fijo)</span>}
                        </>
                      )}
                      {notif.disponible === false && 'No vas a cubrir este día.'}
                    </p>
                    <button
                      onClick={() => abrirEdicion(fecha, fijo)}
                      className="shrink-0 text-xs font-medium text-blue-600"
                    >
                      {notif.disponible === null ? 'Responder' : 'Cambiar'}
                    </button>
                  </div>
                ) : fijo ? (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-700">
                      Vas a cubrir automáticamente {fijo.hora_desde.slice(0, 5)}–{fijo.hora_hasta.slice(0, 5)}{' '}
                      <span className="text-xs text-slate-400">(horario fijo)</span>
                    </p>
                    <button
                      onClick={() => guardarRespuesta(fecha, false)}
                      disabled={ocupado}
                      className="shrink-0 text-xs font-medium text-red-600 disabled:opacity-50"
                    >
                      No puedo este día
                    </button>
                  </div>
                ) : (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-400">Sin compromiso este día.</p>
                    <button
                      onClick={() => abrirEdicion(fecha)}
                      className="shrink-0 text-xs font-medium text-blue-600"
                    >
                      Marcar disponibilidad
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
