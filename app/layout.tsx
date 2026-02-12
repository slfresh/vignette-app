import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "European Vignette Portal",
  description: "Independent route-based guidance with official toll operator links.",
  applicationName: "European Vignette Portal",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: "European Vignette Portal",
    description: "Independent route-based guidance with official toll operator links.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "European Vignette Portal",
    description: "Independent route-based guidance with official toll operator links.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        {children}
        <footer className="mt-8 border-t border-zinc-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-4 text-sm text-zinc-700 sm:px-6">
            <Link href="/impressum" className="underline">
              Impressum
            </Link>
            <Link href="/datenschutz" className="underline">
              Datenschutz
            </Link>
            <Link href="/haftungsausschluss" className="underline">
              Haftungsausschluss
            </Link>
            <Link href="/guides" className="underline">
              Country guides
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
