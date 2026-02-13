"use client";

import { LanguageSwitcher } from "@/components/theme/LanguageSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function TopRightControls() {
  return (
    <div className="inline-flex items-center gap-2">
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );
}
