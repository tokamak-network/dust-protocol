import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/dashboard`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/swap`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/pools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  const docsPages: { slug: string; priority: number }[] = [
    { slug: "overview", priority: 0.9 },
    { slug: "how-it-works", priority: 0.9 },
    { slug: "stealth-transfers", priority: 0.85 },
    { slug: "privacy-pool", priority: 0.85 },
    { slug: "privacy-swaps", priority: 0.85 },
    { slug: "key-management", priority: 0.8 },
    { slug: "payment-links", priority: 0.8 },
    { slug: "eip-7702", priority: 0.75 },
    { slug: "contracts", priority: 0.7 },
    { slug: "faq", priority: 0.85 },
  ];

  const docsSitemap: MetadataRoute.Sitemap = docsPages.map(({ slug, priority }) => ({
    url: `${SITE_URL}/docs/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority,
  }));

  return [...staticPages, ...docsSitemap];
}
