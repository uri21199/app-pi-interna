import { useMemo, useState } from 'react';
import { useBloques } from '../hooks/useBloques';
import { FiltersBar } from '../components/FiltersBar';
import { BloqueCard } from '../components/BloqueCard';
import { FILTROS_INICIALES } from '../types/filters';
import { diaDeHoy, distanciaDesdeAhora, distanciaDiaDesdeHoy, formatDia } from '../lib/dia';
import { coincide } from '../lib/texto';
import { Cargando } from '../../../shared/Spinner';

export function Home() {
  const { bloques, loading, error, refetch, marcarPasada } = useBloques();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  const carrerasDisponibles = useMemo(() => {
    const set = new Set<string>();
    bloques.forEach((b) => b.carreras.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [bloques]);

  const hayBusqueda = filtros.texto.trim().length > 0;

  const bloquesFiltrados = useMemo(() => {
    const hoy = diaDeHoy();
    return bloques.filter((b) => {
      // Con texto buscado, el filtro de día se ignora: si escribís "Anatomía"
      // un miércoles, tiene que aparecer aunque solo se curse los martes.
      if (!hayBusqueda) {
        if (filtros.dia === 'hoy' && b.dia !== hoy) return false;
        if (filtros.dia !== 'hoy' && filtros.dia !== 'semana' && b.dia !== filtros.dia) return false;
      }

      if (filtros.carreras.length > 0 && !b.carreras.some((c) => filtros.carreras.includes(c))) {
        return false;
      }

      const horaInicio = b.hora_inicio.slice(0, 5);
      if (filtros.horaDesde && horaInicio < filtros.horaDesde) return false;
      if (filtros.horaHasta && horaInicio > filtros.horaHasta) return false;

      if (hayBusqueda && !coincide(`${b.materia} ${b.nombre_comision} ${b.aula ?? ''}`, filtros.texto)) {
        return false;
      }

      if (filtros.estado === 'pendiente' && b.pasada_esta_semana) return false;
      if (filtros.estado === 'hecho' && !b.pasada_esta_semana) return false;

      return true;
    });
  }, [bloques, filtros, hayBusqueda]);

  const bloquesOrdenados = useMemo(() => {
    if (hayBusqueda) {
      const hoy = diaDeHoy();
      return [...bloquesFiltrados].sort((a, b) => {
        const distanciaA = distanciaDiaDesdeHoy(a.dia, hoy);
        const distanciaB = distanciaDiaDesdeHoy(b.dia, hoy);
        return distanciaA !== distanciaB ? distanciaA - distanciaB : a.hora_inicio.localeCompare(b.hora_inicio);
      });
    }
    const ahora = new Date();
    return [...bloquesFiltrados].sort(
      (a, b) => distanciaDesdeAhora(a.dia, a.hora_inicio, ahora) - distanciaDesdeAhora(b.dia, b.hora_inicio, ahora)
    );
  }, [bloquesFiltrados, hayBusqueda]);

  const mostrarEncabezadoDia = filtros.dia === 'semana' || hayBusqueda;
  let diaAnterior: string | null = null;

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 pb-8">
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900">Pasadas FIUBA</h1>
        <button
          onClick={() => refetch()}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 active:bg-slate-200"
        >
          ↻ Actualizar
        </button>
      </div>

      <FiltersBar
        filtros={filtros}
        onChange={setFiltros}
        carrerasDisponibles={carrerasDisponibles}
      />

      <div className="space-y-3 p-3">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {loading && <Cargando className="justify-center p-4 text-sm text-slate-400" />}

        {!loading && bloquesOrdenados.length === 0 && (
          <p className="p-4 text-center text-sm text-slate-400">
            No hay bloques que coincidan con los filtros.
          </p>
        )}

        {bloquesOrdenados.map((b) => {
          const mostrarHeader = mostrarEncabezadoDia && b.dia !== diaAnterior;
          if (mostrarHeader) diaAnterior = b.dia;
          return (
            <div key={b.bloque_id}>
              {mostrarHeader && (
                <h2 className="mb-2 mt-4 text-sm font-semibold uppercase text-slate-400">
                  {formatDia(b.dia)}
                </h2>
              )}
              <BloqueCard bloque={b} onMarcarPasada={marcarPasada} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
