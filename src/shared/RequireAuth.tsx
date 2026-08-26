import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { Login } from './Login';
import { Spinner } from './Spinner';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, perfil, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-2 bg-slate-100 text-sm text-slate-500">
        <Spinner />
        Cargando...
      </div>
    );
  }
  if (!session) return <Login />;

  if (perfil && !perfil.activo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
        <p className="text-sm text-slate-600">Tu cuenta fue desactivada. Contactá a un administrador.</p>
        <button onClick={signOut} className="text-sm font-medium text-blue-600 underline">
          Cerrar sesión
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
