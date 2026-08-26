import { useState, type FormEvent } from 'react';
import { supabase } from './supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setEnviando(false);
    if (error) setErrorMsg('Email o contraseña incorrectos.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
        <h1 className="mb-4 text-lg font-semibold text-slate-800">Proyecto Ingeniería</h1>

        <label htmlFor="login-email" className="block text-xs font-medium text-slate-500">Email</label>
        <input
          id="login-email"
          type="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500"
        />

        <label htmlFor="login-password" className="mt-3 block text-xs font-medium text-slate-500">Contraseña</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500"
        />

        {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="mt-4 w-full rounded-lg bg-blue-600 py-2 font-medium text-white active:bg-blue-700 disabled:opacity-50"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
