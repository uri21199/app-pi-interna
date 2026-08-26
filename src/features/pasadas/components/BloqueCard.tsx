import { useState } from 'react';
import { supabase } from '../../../shared/supabase';
import type { PasadaHistorial, VistaBloqueEstado } from '../types/db';
import { formatDia } from '../lib/dia';
import { Cargando } from '../../../shared/Spinner';

function formatHora(hora: string): string {
  return hora.slice(0, 5);
}

interface BloqueCardProps {
  bloque: VistaBloqueEstado;
  onMarcarPasada: (comisionId: string) => Promise<void>;
}

export function BloqueCard({ bloque, onMarcarPasada }: BloqueCardProps) {
  const hecho = bloque.pasada_esta_semana;
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [historial, setHistorial] = useState<PasadaHistorial[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [marcando, setMarcando] = useState(false);

  async function fetchHistorial() {
    setCargandoHistorial(true);
    const { data } = await supabase
      .from('pasadas')
      .select('fecha, nota')
      .eq('comision_id', bloque.comision_id)
      .order('fecha', { ascending: false });
    setHistorial((data ?? []) as PasadaHistorial[]);
    setCargandoHistorial(false);
  }

  function toggleHistorial() {
    const abrir = !historialAbierto;
    setHistorialAbierto(abrir);
    if (abrir && historial === null) fetchHistorial();
  }

  async function handleMarcarPasada() {
    setMarcando(true);
    try {
      await onMarcarPasada(bloque.comision_id);
      if (historialAbierto) fetchHistorial();
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{bloque.materia}</p>
          <p className="text-sm text-slate-500">
            {bloque.nombre_comision}
            {bloque.tipo ? ` · ${bloque.tipo}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            hecho ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {hecho ? 'Hecho' : 'Pendiente'}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
        <span>
          {formatDia(bloque.dia)} {formatHora(bloque.hora_inicio)}–{formatHora(bloque.hora_fin)}
        </span>
        <span className="flex items-center gap-1">
          Aula {bloque.aula ?? '-'}
          {bloque.aula_cambia_durante_cuatri && (
            <span title="El aula cambia durante el cuatrimestre" className="text-amber-600">
              ⚠
            </span>
          )}
        </span>
      </div>

      {bloque.aula_cambia_durante_cuatri && bloque.aula_detalle && (
        <details className="mt-1 text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Detalle de aula</summary>
          <p className="mt-1">{bloque.aula_detalle}</p>
        </details>
      )}

      {bloque.carreras.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {bloque.carreras.map((c) => (
            <span
              key={c}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {bloque.total_pasadas > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          <button onClick={toggleHistorial} className="underline">
            Pasado {bloque.total_pasadas} {bloque.total_pasadas === 1 ? 'vez' : 'veces'}
            {bloque.ultima_pasada ? ` · última: ${bloque.ultima_pasada}` : ''}
          </button>

          {historialAbierto && (
            <div className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-2">
              {cargandoHistorial && <Cargando className="text-xs text-slate-500" />}
              {!cargandoHistorial &&
                historial?.map((h, i) => (
                  <p key={`${h.fecha}-${i}`}>
                    {h.fecha}
                    {h.nota ? ` — ${h.nota}` : ''}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleMarcarPasada}
        disabled={marcando}
        className={`mt-3 w-full rounded-lg py-2 text-sm font-medium disabled:opacity-60 ${
          hecho
            ? 'bg-emerald-50 text-emerald-700 active:bg-emerald-100'
            : 'bg-blue-600 text-white active:bg-blue-700'
        }`}
      >
        {marcando ? 'Guardando...' : hecho ? '✓ Marcar otra pasada' : 'Marcar pasada'}
      </button>
    </div>
  );
}
