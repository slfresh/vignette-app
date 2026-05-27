"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { ComplianceNotice } from "@/types/vignette";

export function ComplianceBadge({ compliance }: { compliance: ComplianceNotice }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-[family-name:var(--font-display)] font-medium">{t("compliance.title")}</p>
      <p className="mt-1">
        {t("compliance.body").replace("{date}", compliance.price_last_verified_at)}
      </p>
    </div>
  );
}
