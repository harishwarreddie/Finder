// ── DATABASE SEED ─────────────────────────────────────────────────────────────
// Populates platforms and base genres.
// Run: npx prisma db seed
// Self-contained — no local imports to avoid ESM resolution issues.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLATFORMS = [
  { name: "Netflix",         slug: "netflix",        watchmodeId: 203, tmdbProviderId: 8,    type: "subscription",  regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.netflix.com",      logoUrl: null },
  { name: "Prime Video",     slug: "prime-video",    watchmodeId: 26,  tmdbProviderId: 119,  type: "subscription",  regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.primevideo.com",   logoUrl: null },
  { name: "Disney+",         slug: "disney-plus",    watchmodeId: 372, tmdbProviderId: 337,  type: "subscription",  regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.disneyplus.com",   logoUrl: null },
  { name: "Max",             slug: "max",            watchmodeId: 387, tmdbProviderId: 1899, type: "subscription",  regions: ["US"],                     baseUrl: "https://www.max.com",          logoUrl: null },
  { name: "Hulu",            slug: "hulu",           watchmodeId: 157, tmdbProviderId: 15,   type: "mixed",         regions: ["US"],                     baseUrl: "https://www.hulu.com",         logoUrl: null },
  { name: "Paramount+",      slug: "paramount-plus", watchmodeId: 444, tmdbProviderId: 531,  type: "subscription",  regions: ["US","GB","CA","AU"],      baseUrl: "https://www.paramountplus.com",logoUrl: null },
  { name: "Apple TV+",       slug: "apple-tv-plus",  watchmodeId: 371, tmdbProviderId: 350,  type: "subscription",  regions: ["US","GB","CA","AU","IN"], baseUrl: "https://tv.apple.com",         logoUrl: null },
  { name: "Peacock",         slug: "peacock",        watchmodeId: 386, tmdbProviderId: 386,  type: "mixed",         regions: ["US"],                     baseUrl: "https://www.peacocktv.com",    logoUrl: null },
  { name: "Crunchyroll",     slug: "crunchyroll",    watchmodeId: 283, tmdbProviderId: 283,  type: "subscription",  regions: ["US","GB","CA","AU"],      baseUrl: "https://www.crunchyroll.com",  logoUrl: null },
  { name: "Tubi",            slug: "tubi",           watchmodeId: 73,  tmdbProviderId: 73,   type: "free",          regions: ["US","CA","AU"],           baseUrl: "https://tubitv.com",           logoUrl: null },
  { name: "Pluto TV",        slug: "pluto-tv",       watchmodeId: 300, tmdbProviderId: 300,  type: "free",          regions: ["US","GB","DE"],           baseUrl: "https://pluto.tv",             logoUrl: null },
  { name: "Apple TV",        slug: "apple-tv",       watchmodeId: 371, tmdbProviderId: 2,    type: "transactional", regions: ["US","GB","CA","AU"],      baseUrl: "https://tv.apple.com",         logoUrl: null },
  { name: "Amazon Video",    slug: "amazon-video",   watchmodeId: 26,  tmdbProviderId: 10,   type: "transactional", regions: ["US","GB","CA","AU"],      baseUrl: "https://www.amazon.com",       logoUrl: null },
  { name: "Vudu",            slug: "vudu",           watchmodeId: 7,   tmdbProviderId: 7,    type: "transactional", regions: ["US"],                     baseUrl: "https://www.vudu.com",         logoUrl: null },
  { name: "YouTube",         slug: "youtube",        watchmodeId: 192, tmdbProviderId: 192,  type: "transactional", regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.youtube.com",      logoUrl: null },
  { name: "Google Play",     slug: "google-play",    watchmodeId: 191, tmdbProviderId: 3,    type: "transactional", regions: ["US","GB","CA","AU"],      baseUrl: "https://play.google.com",      logoUrl: null },
  { name: "Fandango At Home",slug: "fandango-home",  watchmodeId: 7,   tmdbProviderId: 7,    type: "transactional", regions: ["US"],                     baseUrl: "https://www.fandangonow.com",  logoUrl: null },
  { name: "Microsoft Store", slug: "microsoft-store",watchmodeId: 68,  tmdbProviderId: 68,   type: "transactional", regions: ["US","GB","CA"],           baseUrl: "https://www.microsoft.com",    logoUrl: null },
];

const GENRES = [
  { id: 28,    name: "Action" },
  { id: 12,    name: "Adventure" },
  { id: 16,    name: "Animation" },
  { id: 35,    name: "Comedy" },
  { id: 80,    name: "Crime" },
  { id: 99,    name: "Documentary" },
  { id: 18,    name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14,    name: "Fantasy" },
  { id: 36,    name: "History" },
  { id: 27,    name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648,  name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878,   name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53,    name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37,    name: "Western" },
  { id: 10759, name: "Action & Adventure" },
  { id: 10762, name: "Kids" },
  { id: 10763, name: "News" },
  { id: 10764, name: "Reality" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Soap" },
  { id: 10767, name: "Talk" },
  { id: 10768, name: "War & Politics" },
];

async function main() {
  console.log("🌱 Seeding database...");

  console.log("  → Seeding platforms...");
  for (const platform of PLATFORMS) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      create: {
        name: platform.name,
        slug: platform.slug,
        watchmodeId: platform.watchmodeId,
        tmdbProviderId: platform.tmdbProviderId,
        type: platform.type,
        regions: [...platform.regions],
        baseUrl: platform.baseUrl,
        logoUrl: platform.logoUrl,
      },
      update: {
        name: platform.name,
        watchmodeId: platform.watchmodeId,
        tmdbProviderId: platform.tmdbProviderId,
        type: platform.type,
        regions: [...platform.regions],
      },
    });
  }
  console.log(`  ✓ ${PLATFORMS.length} platforms seeded`);

  console.log("  → Seeding genres...");
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { id: genre.id },
      create: { id: genre.id, name: genre.name, tmdbId: genre.id },
      update: { name: genre.name },
    });
  }
  console.log(`  ✓ ${GENRES.length} genres seeded`);

  console.log("✅ Database seed complete");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
