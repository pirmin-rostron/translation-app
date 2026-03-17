export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-slate-600">
          Configure translation preferences and workspace defaults here as the app grows.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            No settings are available yet, but this route is now part of the main navigation.
          </p>
        </div>
      </div>
    </main>
  );
}
