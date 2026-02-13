"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function DatenschutzPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">{t("legal.privacy.title")}</h1>
      <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
        <p>{t("legal.privacy.p1")}</p>
        <p>{t("legal.privacy.p2")}</p>
        <p>{t("legal.privacy.p3")}</p>
        <p>{t("legal.privacy.p4")}</p>
        <p>{t("legal.privacy.p5")}</p>
      </div>
    </main>
  );
}
