import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { BRAND } from "@/lib/config/branding";
import { assertLegalProfileConfigured } from "@/lib/config/legal";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { FooterNav } from "@/components/layout/FooterNav";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { TopRightControls } from "@/components/theme/TopRightControls";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const SUPPORTED_LOCALE_CODES = ["en", "de", "tr", "pl", "ro"];

// Fail fast in production if LEGAL_* env vars are missing
assertLegalProfileConfigured();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#2563eb",
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
  // Read locale from cookie (set by I18nProvider on the client)
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("eurodrive-locale")?.value ?? "en";
  const htmlLang = SUPPORTED_LOCALE_CODES.includes(localeCookie) ? localeCookie : "en";
  const themeBootScript = `
    (function(){
      try {
        var stored = localStorage.getItem('eurodrive-theme');
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var mode = stored || (prefersDark ? 'dark' : 'light');
        if (mode === 'dark') document.documentElement.classList.add('theme-dark');
        else document.documentElement.classList.remove('theme-dark');
      } catch (e) {}
    })();
  `;

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        {/* Structured data for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        <I18nProvider>
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-transform duration-150 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Skip to content
          </a>
          <div className="pointer-events-none fixed top-3 right-3 z-50">
            <div className="pointer-events-auto">
              <TopRightControls />
            </div>
          </div>
          {children}
          <footer className="mt-8 border-t border-zinc-200 bg-white">
            <FooterNav />
          </footer>
          <OfflineBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
