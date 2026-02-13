"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import Link from "next/link";

export function FooterNav() {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-4 text-sm text-zinc-700 sm:px-6">
      <Link href="/impressum" className="underline">
        {t("footer.imprint")}
      </Link>
      <Link href="/datenschutz" className="underline">
        {t("footer.privacy")}
      </Link>
      <Link href="/haftungsausschluss" className="underline">
        {t("footer.disclaimer")}
      </Link>
      <Link href="/guides" className="underline">
        {t("footer.guides")}
      </Link>
    </div>
  );
}
