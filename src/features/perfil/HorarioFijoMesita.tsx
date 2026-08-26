import { useEffect, useState } from 'react';
import { supabase } from '../../shared/supabase';
import { Cargando } from '../../shared/Spinner';
import { DIAS_SEMANA, type DiaSemana, type HorarioFijoMilitante } from '../grilla/types/db';
import { useAuth, type MilitantePerfil } from '../../shared/AuthProvider';

type NuevoHorarioFijo = { dia: DiaSemana; hora_desde: string; hora_hasta: string };

const HORARIO_VACIO: NuevoHorarioFijo = { dia: 'Lunes', hora_desde: '', hora_hasta: '' };

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

interface Props {
  perfil: MilitantePerfil;
  onCambio: () => void;
}

export function HorarioFijoMesita({ perfil, onCambio }: Props) {
  const { session } = useAuth();
  const [horarios, setHorarios] = useState<HorarioFijoMilitante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [nuevo, setNuevo] = useState<NuevoHorarioFijo>(HORARIO_VACIO);

  useEffect(() => {
    let activo = true;
    supabase
      .from('horario_fijo_militante')
      .select('*')
      .eq('militante_id', perfil.id)
      .order('dia')
      .then(({ data }) => {
        if (!activo) return;
        setHorarios(data ?? []);
        setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [perfil.id]);

  const ordenados = [...horarios].sort(
    (a, b) => DIAS_SEMANA.indexOf(a.dia) - DIAS_SEMANA.indexOf(b.dia) || a.hora_desde.localeCompare(b.hora_desde)
  );

  async function agregar() {
    if (!nuevo.hora_desde || !nuevo.hora_hasta) return;
    if (nuevo.hora_desde >= nuevo.hora_hasta) {
      setMensaje('Error: el horario "desde" tiene que ser antes que "hasta".');
      return;
    }
    setGuardando(true);
    setMensaje(null);
    const { data, error } = await supabase
      .from('horario_fijo_militante')
      .insert({ militante_id: perfil.id, ...nuevo })
      .select('*')
      .single();
    setGuardando(false);
    if (error || !data) {
      setMensaje(errorAmigable('agregar el horario fijo', error));
      return;
    }
    setHorarios((prev) => [...prev, data]);
    setNuevo(HORARIO_VACIO);
    setMostrarAgregar(false);
    setMensaje('Horario fijo agregado.');
    onCambio();
  }

  async function eliminar(h: HorarioFijoMilitante) {
    if (!session) return;
    if (
      !window.confirm(
        `¿Eliminar el horario fijo de ${h.dia} ${h.hora_desde.slice(0, 5)}-${h.hora_hasta.slice(0, 5)}? Dejás de autoconfirmarte ese día.`
      )
    ) {
      return;
    }
    setOcupadoId(h.id);
    setMensaje(null);
    const { error } = await supabase.from('horario_fijo_militante').delete().eq('id', h.id);
    if (error) {
      setOcupadoId(null);
      setMensaje(errorAmigable('eliminar el horario fijo', error));
      return;
    }

    // Las filas de notificaciones_mesita que se autoconfirmaron por este
    // horario fijo dejan de tener sentido si se lo borra: si no las
    // limpiamos, la mesita queda con turnos "confirmados" para un
    // compromiso que ya no existe. notificaciones_mesita es de solo-lectura
    // para el cliente (RLS), así que el borrado lo hace el servidor — nunca
    // toca una respuesta real de la persona (autoconfirmado: false).
    try {
      const res = await fetch('/api/mesita/limpiar-autoconfirmados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ dia: h.dia }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'No se pudo limpiar la mesita');
    } catch (err) {
      console.error(err);
    }

    setOcupadoId(null);
    setHorarios((prev) => prev.filter((x) => x.id !== h.id));
    setMensaje('Horario fijo eliminado.');
    onCambio();
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Horario fijo de mesita</h2>
        <button onClick={() => setMostrarAgregar((v) => !v)} className="text-sm font-medium text-blue-600">
          {mostrarAgregar ? 'Cancelar' : '+ Agregar'}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Los días que fijes acá se autoconfirman: no te van a preguntar de nuevo, se anota directo que podés cubrir ese
        horario. Si un día puntual no podés, cancelalo en "Mis próximos turnos" sin borrar el horario fijo.
      </p>

      {cargando && <Cargando className="mt-2 text-sm text-slate-400" />}
      <Mensaje texto={mensaje} />

      {!cargando && ordenados.length === 0 && !mostrarAgregar && (
        <p className="mt-2 text-sm text-slate-400">Todavía no fijaste ningún horario.</p>
      )}

      <div className="mt-2 space-y-1.5">
        {ordenados.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
            <p className="text-sm text-slate-800">
              <span className="font-medium">{h.dia}</span> {h.hora_desde.slice(0, 5)}–{h.hora_hasta.slice(0, 5)}
            </p>
            <button
              onClick={() => eliminar(h)}
              disabled={ocupadoId === h.id}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
              aria-label="Eliminar"
              title="Eliminar"
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {mostrarAgregar && (
        <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Día"
              value={nuevo.dia}
              onChange={(e) => setNuevo({ ...nuevo, dia: e.target.value as DiaSemana })}
              className="col-span-2 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Desde"
              value={nuevo.hora_desde}
              onChange={(e) => setNuevo({ ...nuevo, hora_desde: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
            <input
              type="time"
              aria-label="Hasta"
              value={nuevo.hora_hasta}
              onChange={(e) => setNuevo({ ...nuevo, hora_hasta: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={agregar}
            disabled={guardando}
            className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}
