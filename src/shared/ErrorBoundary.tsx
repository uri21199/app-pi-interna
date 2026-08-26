import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('Error no controlado:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-md">
            <p className="text-sm font-medium text-slate-800">Algo salió mal.</p>
            <p className="mt-1 text-sm text-slate-500">
              Probá recargar la página. Si el problema sigue, avisale a un admin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white active:bg-blue-700"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
