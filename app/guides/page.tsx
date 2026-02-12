import { COUNTRY_GUIDES } from "@/lib/content/countryGuides";
import Link from "next/link";

export default function GuidesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Country guides</h1>
      <p className="mt-2 text-sm text-zinc-700">Quick references for national vignette systems and common pitfalls.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COUNTRY_GUIDES.map((guide) => (
          <article key={guide.code} className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold">{guide.name}</h2>
            <p className="mt-1 text-sm text-zinc-700">{guide.summary}</p>
            <Link className="mt-3 inline-block text-sm font-medium text-blue-700 underline" href={`/guides/${guide.slug}`}>
              Open guide
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
