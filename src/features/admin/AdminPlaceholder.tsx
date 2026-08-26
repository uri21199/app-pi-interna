export function AdminPlaceholder({ titulo }: { titulo: string }) {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-slate-800">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-500">Esta sección todavía no está implementada.</p>
    </div>
  );
}
