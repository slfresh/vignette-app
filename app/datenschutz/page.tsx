export default function DatenschutzPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Datenschutzerklaerung</h1>
      <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
        <p>
          This website is an independent information service and not an official government portal.
        </p>
        <p>
          This portal minimizes data processing. Route start and destination are sent to routing providers and processed in-memory.
        </p>
        <p>
          Map tiles may be loaded from OpenStreetMap servers, which can receive your IP address as part of normal web delivery.
        </p>
        <p>
          Optional affiliate and analytics integrations are disabled until explicit consent is provided.
        </p>
        <p>
          This text is a starting template and should be reviewed by legal counsel for production deployment.
        </p>
      </div>
    </main>
  );
}
