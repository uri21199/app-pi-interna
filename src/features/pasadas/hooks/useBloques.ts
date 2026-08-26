import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../shared/supabase';
import type { VistaBloqueEstado } from '../types/db';

interface UseBloquesResult {
  bloques: VistaBloqueEstado[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  marcarPasada: (comisionId: string) => Promise<void>;
}

export function useBloques(): UseBloquesResult {
  const [bloques, setBloques] = useState<VistaBloqueEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBloques = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('vista_bloques_estado')
      .select('*')
      .order('dia', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setBloques((data ?? []) as VistaBloqueEstado[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBloques();
  }, [fetchBloques]);

  const marcarPasada = useCallback(async (comisionId: string) => {
    const hoy = new Date().toISOString().slice(0, 10);

    setBloques((prev) =>
      prev.map((b) =>
        b.comision_id === comisionId
          ? { ...b, pasada_esta_semana: true, ultima_pasada: hoy, total_pasadas: b.total_pasadas + 1 }
          : b
      )
    );

    const { error: insertError } = await supabase
      .from('pasadas')
      .insert({ comision_id: comisionId, fecha: hoy });

    if (insertError) {
      setError(insertError.message);
      await fetchBloques();
    }
  }, [fetchBloques]);

  return { bloques, loading, error, refetch: fetchBloques, marcarPasada };
}
