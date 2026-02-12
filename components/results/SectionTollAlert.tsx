import type { SectionTollNotice } from "@/types/vignette";
import { Construction, Leaf, Ship } from "lucide-react";

function getWarningIcon(notice: SectionTollNotice) {
  const text = `${notice.label} ${notice.description}`.toLowerCase();
  if (text.includes("ulez") || text.includes("crit'air") || text.includes("umwelt") || text.includes("emission")) {
    return <Leaf className="h-4 w-4 text-green-700" />;
  }
  if (text.includes("channel") || text.includes("ferry") || text.includes("tunnel") || text.includes("eurotunnel")) {
    return <Ship className="h-4 w-4 text-sky-700" />;
  }
  return <Construction className="h-4 w-4 text-orange-700" />;
}

export function SectionTollAlert({ notices }: { notices: SectionTollNotice[] }) {
  if (!notices.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
      <h3 className="font-semibold">Additional toll warnings</h3>
      <ul className="mt-2 space-y-2">
        {notices.map((notice) => (
          <li key={`${notice.countryCode}-${notice.label}`}>
            <p className="inline-flex items-center gap-2 font-medium">
              {getWarningIcon(notice)}
              {notice.label}
            </p>
            <p>{notice.description}</p>
            {notice.officialUrl ? (
              <a className="text-blue-700 underline" href={notice.officialUrl} target="_blank" rel="noreferrer noopener">
                Open official payment page
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
