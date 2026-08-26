import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { Spinner } from './Spinner';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { perfil, loading } = useAuth();

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-2 bg-slate-100 text-sm text-slate-500">
        <Spinner />
        Cargando...
      </div>
    );
  }
  if (perfil?.rol !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-center">
        <p className="text-sm text-slate-600">No tenés permisos de administrador para ver esta sección.</p>
      </div>
    );
  }
  return <>{children}</>;
}
