import { COUNTRY_GUIDES } from "@/lib/content/countryGuides";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.APP_PUBLIC_URL ?? "https://example.com";
  const staticRoutes = ["", "/guides", "/impressum", "/datenschutz", "/haftungsausschluss"];

  const staticEntries = staticRoutes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const guideEntries = COUNTRY_GUIDES.map((guide) => ({
    url: `${siteUrl}/guides/${guide.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...guideEntries];
}
