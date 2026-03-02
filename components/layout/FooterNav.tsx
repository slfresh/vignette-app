"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { BRAND } from "@/lib/config/branding";
import Link from "next/link";

export function FooterNav() {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-primary)]">
        {BRAND.name}
      </p>
      <nav className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
        <Link href="/impressum" className="transition-colors hover:text-[var(--accent)]">
          {t("footer.imprint")}
        </Link>
        <Link href="/datenschutz" className="transition-colors hover:text-[var(--accent)]">
          {t("footer.privacy")}
        </Link>
        <Link href="/haftungsausschluss" className="transition-colors hover:text-[var(--accent)]">
          {t("footer.disclaimer")}
        </Link>
        <Link href="/guides" className="transition-colors hover:text-[var(--accent)]">
          {t("footer.guides")}
        </Link>
      </nav>
    </div>
  );
}
