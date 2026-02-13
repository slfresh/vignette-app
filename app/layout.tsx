import type { Metadata } from "next";
import { BRAND } from "@/lib/config/branding";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { FooterNav } from "@/components/layout/FooterNav";
import { TopRightControls } from "@/components/theme/TopRightControls";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        <I18nProvider>
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
          <div className="pointer-events-none fixed top-3 right-3 z-50">
            <div className="pointer-events-auto">
              <TopRightControls />
            </div>
          </div>
          {children}
          <footer className="mt-8 border-t border-zinc-200 bg-white">
            <FooterNav />
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
