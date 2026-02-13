import { COUNTRY_GUIDES } from "@/lib/content/countryGuides";
import { PRICING_2026 } from "@/lib/config/pricing2026";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return COUNTRY_GUIDES.map((guide) => ({ country: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const guide = COUNTRY_GUIDES.find((item) => item.slug === resolvedParams.country);
  if (!guide) {
    return { title: "Guide not found" };
  }
  return {
    title: `${guide.name} Vignette Guide`,
    description: guide.summary,
  };
}

export default async function CountryGuidePage({ params }: { params: Promise<{ country: string }> }) {
  const resolvedParams = await params;
  const guide = COUNTRY_GUIDES.find((item) => item.slug === resolvedParams.country);
  if (!guide) {
    notFound();
  }

  const pricing = PRICING_2026[guide.code];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/" className="font-medium text-blue-700 underline">
          ← Back to home
        </Link>
        <Link href="/guides" className="font-medium text-blue-700 underline">
          All guides
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">{guide.name} guide</h1>
      <p className="mt-2 text-sm text-zinc-700">{guide.summary}</p>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Key points</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {guide.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">2026 products (reference)</h2>
        <ul className="mt-2 space-y-1 text-sm text-zinc-700">
          {pricing?.products.length ? (
            pricing.products.map((product) => (
              <li key={product.id}>
                {product.label}: {product.price} {product.currency}
              </li>
            ))
          ) : (
            <li>No standard national car vignette table.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
