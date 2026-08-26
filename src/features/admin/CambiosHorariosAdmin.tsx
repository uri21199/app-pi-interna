import { useEffect, useState } from 'react';
import { supabase } from '../../shared/supabase';
import { Cargando, Spinner } from '../../shared/Spinner';

interface HistorialRow {
  id: string;
  militante_id: string;
  tabla: string;
  registro_id: string | null;
  campo_modificado: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  accion: 'crear' | 'editar' | 'eliminar';
  modificado_en: string;
  modificado_por: string;
}

interface MilitanteBasico {
  id: string;
  nombre: string;
}

const ACCION_LABEL: Record<HistorialRow['accion'], string> = {
  crear: 'Alta',
  editar: 'Edición',
  eliminar: 'Baja',
};

const TAMANO_PAGINA = 100;

async function cargarPaginaHistorial(pagina: number): Promise<HistorialRow[]> {
  const desde = pagina * TAMANO_PAGINA;
  const hasta = desde + TAMANO_PAGINA - 1;
  const { data } = await supabase
    .from('historial_disponibilidad')
    .select('*')
    .order('modificado_en', { ascending: false })
    .range(desde, hasta);
  return (data as HistorialRow[]) ?? [];
}

export function CambiosHorariosAdmin() {
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [militantes, setMilitantes] = useState<MilitanteBasico[]>([]);
  const [filtroMilitante, setFiltroMilitante] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(true);

  useEffect(() => {
    Promise.all([cargarPaginaHistorial(0), supabase.from('militantes').select('id, nombre').order('nombre')]).then(
      ([filas, { data: m }]) => {
        setHistorial(filas);
        setHayMas(filas.length === TAMANO_PAGINA);
        setMilitantes((m as MilitanteBasico[]) ?? []);
        setCargando(false);
      },
    );
  }, []);

  const cargarMas = async () => {
    setCargandoMas(true);
    const siguiente = pagina + 1;
    const filas = await cargarPaginaHistorial(siguiente);
    setHistorial((prev) => [...prev, ...filas]);
    setHayMas(filas.length === TAMANO_PAGINA);
    setPagina(siguiente);
    setCargandoMas(false);
  };

  function nombreDe(id: string): string {
    return militantes.find((m) => m.id === id)?.nombre ?? id;
  }

  const filtrado = filtroMilitante === 'todos' ? historial : historial.filter((h) => h.militante_id === filtroMilitante);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <h1 className="text-lg font-semibold text-slate-800">Cambios de horarios</h1>

      <select
        value={filtroMilitante}
        onChange={(e) => setFiltroMilitante(e.target.value)}
        className="mt-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="todos">Todos los militantes</option>
        {militantes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>

      {cargando && <Cargando className="mt-4 text-sm text-slate-400" />}

      <div className="mt-3 space-y-2">
        {!cargando && filtrado.length === 0 && <p className="text-sm text-slate-400">Sin cambios registrados.</p>}
        {filtrado.map((h) => (
          <div key={h.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{nombreDe(h.militante_id)}</span>
              <span className="text-xs text-slate-400">{new Date(h.modificado_en).toLocaleString('es-AR')}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {ACCION_LABEL[h.accion]} en {h.tabla} · {h.campo_modificado}
              {h.modificado_por !== h.militante_id && ` · por ${nombreDe(h.modificado_por)}`}
            </p>
            <p className="mt-1 text-xs text-slate-700">
              {h.valor_anterior ?? '—'} → {h.valor_nuevo ?? '—'}
            </p>
          </div>
        ))}

        {!cargando && hayMas && (
          <button
            onClick={cargarMas}
            disabled={cargandoMas}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-600 disabled:opacity-50"
          >
            {cargandoMas && <Spinner className="h-4 w-4" />}
            {cargandoMas ? 'Cargando...' : 'Cargar más'}
          </button>
        )}
      </div>
    </div>
  );
}
