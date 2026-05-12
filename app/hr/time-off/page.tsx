export default function TimeOffTestPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-10 text-slate-900">
      <h1 className="text-3xl font-bold">Time-Off Route Works</h1>

      <p className="mt-4 text-sm text-slate-600">
        If you can see this page, /hr/time-off is working.
      </p>

      <a
        href="/hr"
        className="mt-6 inline-block rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
      >
        Back to HR
      </a>
    </main>
  );
}