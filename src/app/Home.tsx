import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../shared/AuthProvider';
import { supabase } from '../shared/supabase';
import { addDays, formatDateLocal } from '../features/grilla/lib/dia';
import type { NotificacionMesita } from '../features/grilla/types/db';

type ProximoTurno = Pick<NotificacionMesita, 'fecha' | 'hora_desde' | 'hora_hasta'>;

function labelFecha(fechaIso: string): string {
  const hoy = formatDateLocal(new Date());
  if (fechaIso === hoy) return 'Hoy';
  if (fechaIso === addDays(hoy, 1)) return 'Mañana';
  return fechaIso;
}

interface NotificacionPendiente {
  fecha: string;
  token: string;
}

export function Home() {
  const { perfil } = useAuth();
  // undefined = cargando, null = sin turnos.
  const [proximoTurno, setProximoTurno] = useState<ProximoTurno | null | undefined>(undefined);
  const [pendiente, setPendiente] = useState<NotificacionPendiente | null>(null);
  const [sinStock, setSinStock] = useState<string[]>([]);

  useEffect(() => {
    if (!perfil) return;
    let activo = true;
    supabase
      .from('notificaciones_mesita')
      .select('fecha, hora_desde, hora_hasta')
      .eq('militante_id', perfil.id)
      .eq('disponible', true)
      .gte('fecha', formatDateLocal(new Date()))
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setProximoTurno(data);
      });
    return () => {
      activo = false;
    };
  }, [perfil]);

  useEffect(() => {
    if (!perfil) return;
    let activo = true;
    supabase
      .from('notificaciones_mesita')
      .select('fecha, token')
      .eq('militante_id', perfil.id)
      .is('disponible', null)
      .gte('fecha', formatDateLocal(new Date()))
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setPendiente(data);
      });
    return () => {
      activo = false;
    };
  }, [perfil]);

  useEffect(() => {
    if (!perfil) return;
    let activo = true;
    supabase
      .from('materiales')
      .select('nombre')
      .eq('en_stock', false)
      .order('nombre')
      .then(({ data }) => {
        if (activo) setSinStock((data ?? []).map((m) => m.nombre));
      });
    return () => {
      activo = false;
    };
  }, [perfil]);

  const subtituloMesita =
    proximoTurno === undefined
      ? 'Cargando...'
      : proximoTurno && proximoTurno.hora_desde && proximoTurno.hora_hasta
        ? `${labelFecha(proximoTurno.fecha)} ${proximoTurno.hora_desde.slice(0, 5)} a ${proximoTurno.hora_hasta.slice(0, 5)} hs`
        : 'Te avisamos cuando te toque cubrir';

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <h2 className="text-lg font-semibold text-slate-800">Hola, {perfil?.nombre ?? ''}</h2>
      <p className="text-sm text-slate-500">¿Qué querés hacer hoy?</p>

      {pendiente && (
        <Link
          to={`/grilla/confirmar/${pendiente.token}`}
          className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 active:bg-amber-100"
        >
          Todavía no respondiste si podés cubrir la mesita el {labelFecha(pendiente.fecha)} — tocá para confirmar →
        </Link>
      )}

      {sinStock.length > 0 && (
        <Link
          to="/materiales"
          className="mt-3 block rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 active:bg-red-100"
        >
          Sin stock: {sinStock.join(', ')} — tocá para ver →
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/pasadas" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
          <p className="font-semibold text-slate-800">Pasadas</p>
          <p className="mt-1 text-xs text-slate-500">Ver comisiones</p>
        </Link>
        <Link to="/grilla" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
          <p className="font-semibold text-slate-800">Mesita</p>
          <p className="mt-1 text-xs text-slate-500">{subtituloMesita}</p>
        </Link>
      </div>

      <Link
        to="/perfil"
        className="mt-3 block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
      >
        <p className="font-semibold text-slate-800">Mi perfil</p>
        <p className="mt-1 text-xs text-slate-500">Horarios de disponibilidad</p>
      </Link>
    </div>
  );
}
