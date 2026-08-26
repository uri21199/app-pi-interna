import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Rol = 'militante' | 'admin';

export interface MilitantePerfil {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  rol: Rol;
}

interface AuthContextValue {
  session: Session | null;
  perfil: MilitantePerfil | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<MilitantePerfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(userId: string) {
      const { data } = await supabase
        .from('militantes')
        .select('id, nombre, email, activo, rol')
        .eq('user_id', userId)
        .maybeSingle();
      if (activo) setPerfil(data);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return;
      setSession(session);
      if (session) {
        cargarPerfil(session.user.id).finally(() => {
          if (activo) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        cargarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return <AuthContext.Provider value={{ session, perfil, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
