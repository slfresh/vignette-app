import type { ComplianceNotice } from "@/types/vignette";

export function ComplianceBadge({ compliance }: { compliance: ComplianceNotice }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Independent information portal</p>
      <p className="mt-1">
        Official-source links only. Informational content. Prices last checked: {compliance.price_last_verified_at}.
      </p>
    </div>
  );
}
