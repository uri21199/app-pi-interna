import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../shared/supabase';
import { addDays, formatDateLocal, formatFechaLarga, lunesDeLaSemana } from '../lib/dia';
import type { VistaCoberturaDia } from '../types/db';
import { Cargando } from '../../../shared/Spinner';

interface Clase {
  materia: string;
  hora_clase_inicio: string;
  hora_clase_fin: string;
}

interface NotificacionAgrupada {
  notificacion_id: string;
  fecha: string;
  nombre: string;
  email: string;
  clases: Clase[];
  disponible: boolean | null;
  hora_desde: string | null;
  hora_hasta: string | null;
}

type Estado = 'pendiente' | 'disponible' | 'no_disponible';

const ESTADO_INFO: Record<Estado, { label: string; className: string }> = {
  pendiente: { label: 'Sin responder', className: 'bg-slate-100 text-slate-600' },
  disponible: { label: 'Disponible', className: 'bg-green-100 text-green-700' },
  no_disponible: { label: 'No disponible', className: 'bg-red-100 text-red-700' },
};

function estadoDe(n: NotificacionAgrupada): Estado {
  if (n.disponible === null) return 'pendiente';
  return n.disponible ? 'disponible' : 'no_disponible';
}

function agruparPorFecha(filas: VistaCoberturaDia[]): Record<string, NotificacionAgrupada[]> {
  const porNotificacion = new Map<string, NotificacionAgrupada>();

  for (const f of filas) {
    const clase =
      f.materia && f.hora_clase_inicio && f.hora_clase_fin
        ? { materia: f.materia, hora_clase_inicio: f.hora_clase_inicio, hora_clase_fin: f.hora_clase_fin }
        : null;

    const existente = porNotificacion.get(f.notificacion_id);
    if (existente) {
      if (clase) existente.clases.push(clase);
      continue;
    }

    porNotificacion.set(f.notificacion_id, {
      notificacion_id: f.notificacion_id,
      fecha: f.fecha,
      nombre: f.nombre,
      email: f.email,
      clases: clase ? [clase] : [],
      disponible: f.disponible,
      hora_desde: f.hora_desde,
      hora_hasta: f.hora_hasta,
    });
  }

  const porFecha: Record<string, NotificacionAgrupada[]> = {};
  for (const n of porNotificacion.values()) {
    if (n.disponible === null) continue; // no respondió el mail: no se muestra en la cobertura
    (porFecha[n.fecha] ??= []).push(n);
  }
  for (const lista of Object.values(porFecha)) {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  return porFecha;
}

export function Resumen() {
  const [filas, setFilas] = useState<VistaCoberturaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [modo, setModo] = useState<'dia' | 'semana'>('dia');
  const [fecha, setFecha] = useState(() => formatDateLocal(new Date()));

  useEffect(() => {
    let activo = true;
    setLoading(true);
    supabase
      .from('vista_cobertura_dia')
      .select('*')
      .order('fecha')
      .order('nombre')
      .then(({ data, error }) => {
        if (!activo) return;
        if (error) setErrorMsg(error.message);
        else setFilas(data ?? []);
        setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const agrupadas = useMemo(() => agruparPorFecha(filas), [filas]);

  const fechasVisibles = useMemo(() => {
    if (modo === 'dia') return [fecha];
    const lunes = lunesDeLaSemana(fecha);
    return Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  }, [modo, fecha]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 p-4 pb-16">
      <h1 className="text-lg font-semibold text-slate-800">Resumen de cobertura</h1>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setModo('dia')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            modo === 'dia' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-600'
          }`}
        >
          Día
        </button>
        <button
          onClick={() => setModo('semana')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            modo === 'semana' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-600'
          }`}
        >
          Semana
        </button>
      </div>

      {modo === 'dia' && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setFecha((f) => addDays(f, -1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600"
          >
            ←
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setFecha((f) => addDays(f, 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600"
          >
            →
          </button>
          <button onClick={() => setFecha(formatDateLocal(new Date()))} className="text-sm font-medium text-blue-600">
            Hoy
          </button>
        </div>
      )}

      {loading && <Cargando className="mt-4 text-sm text-slate-500" />}
      {errorMsg && <p className="mt-4 text-sm text-red-600">{errorMsg}</p>}

      {!loading && !errorMsg && (
        <div className="mt-4 space-y-5">
          {fechasVisibles.map((f) => (
            <div key={f}>
              <h2 className="text-sm font-semibold capitalize text-slate-700">{formatFechaLarga(f)}</h2>
              <div className="mt-2 space-y-2">
                {(agrupadas[f] ?? []).length === 0 && (
                  <p className="text-sm text-slate-400">Sin notificaciones para este día.</p>
                )}
                {(agrupadas[f] ?? []).map((n) => {
                  const estado = ESTADO_INFO[estadoDe(n)];
                  return (
                    <div key={n.notificacion_id} className="rounded-lg bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{n.nombre}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.className}`}>
                          {estado.label}
                        </span>
                      </div>
                      {n.clases.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {n.clases
                            .map((c) => `${c.materia} (${c.hora_clase_inicio.slice(0, 5)}–${c.hora_clase_fin.slice(0, 5)})`)
                            .join(' · ')}
                        </p>
                      )}
                      {n.disponible && (
                        <p className="mt-1 text-xs text-green-700">
                          Puede de {n.hora_desde?.slice(0, 5)} a {n.hora_hasta?.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
