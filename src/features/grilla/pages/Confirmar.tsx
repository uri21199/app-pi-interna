import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, formatDateLocal, formatFechaLarga } from '../lib/dia';
import { Cargando } from '../../../shared/Spinner';

interface ConfirmarData {
  nombre: string;
  fecha: string;
  eje: string | null;
  clases: { materia: string; hora_inicio: string; hora_fin: string }[];
  yaRespondido: boolean;
  disponible: boolean | null;
  hora_desde: string | null;
  hora_hasta: string | null;
}

type Modo = 'cargando' | 'error' | 'elegir' | 'horario' | 'enviando' | 'listo';

function encabezadoFecha(fechaIso: string): string {
  const hoy = formatDateLocal(new Date());
  if (fechaIso === hoy) return 'Hoy';
  if (fechaIso === addDays(hoy, 1)) return 'Mañana';
  const larga = formatFechaLarga(fechaIso);
  return larga.charAt(0).toUpperCase() + larga.slice(1);
}

export function Confirmar() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ConfirmarData | null>(null);
  const [modo, setModo] = useState<Modo>('cargando');
  const [errorMsg, setErrorMsg] = useState('');
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/confirmar?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<ConfirmarData>;
      })
      .then((d) => {
        setData(d);
        setHoraDesde(d.hora_desde?.slice(0, 5) ?? d.clases[0]?.hora_inicio.slice(0, 5) ?? '');
        setHoraHasta(d.hora_hasta?.slice(0, 5) ?? d.clases[0]?.hora_fin.slice(0, 5) ?? '');

        setModo(d.yaRespondido ? 'listo' : 'elegir');
      })
      .catch(() => setModo('error'));
  }, [token]);

  async function enviar(disponible: boolean, desde?: string, hasta?: string) {
    if (!token) return;
    setModo('enviando');
    setErrorMsg('');
    try {
      const res = await fetch('/api/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, disponible, hora_desde: desde, hora_hasta: hasta }),
      });
      const body = (await res.json()) as ConfirmarData & { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Error al enviar');
      setData(body);
      setModo('listo');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al enviar');
      setModo('horario');
    }
  }

  function handleHorarioSubmit(e: FormEvent) {
    e.preventDefault();
    if (horaDesde >= horaHasta) {
      setErrorMsg('El horario "desde" debe ser anterior al "hasta"');
      return;
    }
    enviar(true, horaDesde, horaHasta);
  }

  if (modo === 'cargando') {
    return <Layout><Cargando className="text-sm text-slate-500" /></Layout>;
  }

  if (modo === 'error' || !data) {
    return (
      <Layout>
        <p className="text-sm text-red-600">
          No pudimos encontrar esta invitación. El link puede haber expirado o estar mal copiado.
        </p>
      </Layout>
    );
  }

  const claseTexto =
    data.clases.length > 0
      ? data.clases.map((c) => `${c.materia} (${c.hora_inicio.slice(0, 5)}–${c.hora_fin.slice(0, 5)})`).join(' y ')
      : null;

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-slate-800">Hola, {data.nombre} 👋</h1>
      <p className="mt-2 text-sm text-slate-600">
        <span className="font-medium">{encabezadoFecha(data.fecha)}</span>
        {claseTexto ? (
          <>
            {' '}tenés <span className="font-medium">{claseTexto}</span>.
          </>
        ) : (
          '.'
        )}{' '}
        ¿Podés cubrir la mesita?
      </p>

      {data.eje && (
        <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          <span className="font-medium">Eje de la semana:</span> {data.eje}
        </p>
      )}

      {modo === 'listo' && (
        <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          {data.disponible ? (
            <p>
              ✅ Anotado: disponible de{' '}
              <span className="font-medium">
                {data.hora_desde?.slice(0, 5)} a {data.hora_hasta?.slice(0, 5)}
              </span>
              .
            </p>
          ) : (
            <p>Anotado: no vas a poder cubrir {encabezadoFecha(data.fecha).toLowerCase()}.</p>
          )}
          <button
            onClick={() => setModo('elegir')}
            className="mt-3 text-sm font-medium text-blue-600"
          >
            Cambiar mi respuesta
          </button>
        </div>
      )}

      {modo === 'elegir' && (
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setModo('horario')}
            className="flex-1 rounded-lg bg-blue-600 py-3 font-medium text-white active:bg-blue-700"
          >
            Sí, puedo
          </button>
          <button
            onClick={() => enviar(false)}
            className="flex-1 rounded-lg border border-slate-300 py-3 font-medium text-slate-700 active:bg-slate-100"
          >
            No puedo
          </button>
        </div>
      )}

      {modo === 'enviando' && <Cargando texto="Enviando..." className="mt-5 text-sm text-slate-500" />}

      {modo === 'horario' && (
        <form onSubmit={handleHorarioSubmit} className="mt-5 space-y-3">
          <div className="flex gap-3">
            <label className="flex-1 text-sm text-slate-600">
              Desde
              <input
                type="time"
                required
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500"
              />
            </label>
            <label className="flex-1 text-sm text-slate-600">
              Hasta
              <input
                type="time"
                required
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500"
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white active:bg-blue-700 disabled:opacity-60"
          >
            Confirmar horario
          </button>
          <button
            type="button"
            onClick={() => setModo('elegir')}
            className="w-full text-center text-sm text-slate-500"
          >
            Volver
          </button>
        </form>
      )}

      {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
        {children}
        <Link to="/" className="mt-5 block text-center text-sm font-medium text-blue-600">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
