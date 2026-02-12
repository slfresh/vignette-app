import { getLegalOperatorProfile, hasPlaceholderLegalProfile } from "@/lib/config/legal";

export default function ImpressumPage() {
  const profile = getLegalOperatorProfile();
  const hasPlaceholders = hasPlaceholderLegalProfile(profile);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Impressum</h1>
      {hasPlaceholders ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Pre-launch blocker: legal provider details are placeholders. Fill LEGAL_* env values before publishing.
        </p>
      ) : null}
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
        <p>Provider: {profile.fullName}</p>
        <p>Address: {profile.streetAddress}</p>
        <p>Email: {profile.email}</p>
        <p>Phone: {profile.phone}</p>
        <p>VAT ID: {profile.vatId}</p>
      </section>
    </main>
  );
}
