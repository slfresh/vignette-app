import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { BRAND } from "@/lib/config/branding";
import { assertLegalProfileConfigured } from "@/lib/config/legal";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { FooterNav } from "@/components/layout/FooterNav";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { TopRightControls } from "@/components/theme/TopRightControls";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const SUPPORTED_LOCALE_CODES = ["en", "de", "tr", "pl", "ro"];

assertLegalProfileConfigured();

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_PUBLIC_URL ?? "https://example.com"),
  title: `${BRAND.name} | ${BRAND.subtitle}`,
  description: BRAND.tagline,
  applicationName: BRAND.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: `${BRAND.name} | ${BRAND.subtitle}`,
    description: BRAND.tagline,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} | ${BRAND.subtitle}`,
    description: BRAND.tagline,
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F0E8",
};

/**
 * JSON-LD structured data for search engines.
 * Describes the app as a WebApplication for European vignette guidance.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `${BRAND.name} | ${BRAND.subtitle}`,
  description: BRAND.tagline,
  url: process.env.APP_PUBLIC_URL ?? "https://example.com",
  applicationCategory: "TravelApplication",
  operatingSystem: "All",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  featureList: [
    "Route-based vignette detection for 30 European countries",
    "Trip cost estimation including fuel and charging",
    "Official toll operator links only",
    "Multi-language support (EN, DE, TR, PL, RO)",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("eurodrive-locale")?.value ?? "en";
  const htmlLang = SUPPORTED_LOCALE_CODES.includes(localeCookie) ? localeCookie : "en";

  const themeBootScript = `(function(){try{var s=localStorage.getItem('eurodrive-theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;var m=s||(d?'dark':'light');if(m==='dark')document.documentElement.classList.add('theme-dark');else document.documentElement.classList.remove('theme-dark')}catch(e){}})();`;

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${playfairDisplay.variable} ${dmSans.variable} ${dmMono.variable} bg-background text-foreground antialiased`}
      >
        <I18nProvider>
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-transform duration-150 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:ring-offset-2"
          >
            Skip to content
          </a>
          <div className="pointer-events-none fixed top-3 right-3 z-50">
            <div className="pointer-events-auto">
              <TopRightControls />
            </div>
          </div>
          {children}
          <footer className="mt-8 border-t border-[var(--border-strong)] bg-[var(--foreground)]">
            <div className="[&_*]:text-[#EDE7D9] [&_p]:text-[#F5F0E8]">
              <FooterNav />
            </div>
          </footer>
          <OfflineBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
