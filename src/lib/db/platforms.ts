// ── PLATFORM SEED DATA ────────────────────────────────────────────────────────
// Major streaming platforms with their Watchmode source IDs.
// Run npx prisma db seed to populate the platform table.
// Add more platforms as needed — this is not exhaustive.

export const PLATFORMS = [
  { name: "Netflix",        slug: "netflix",        watchmodeId: 203,  tmdbProviderId: 8,   type: "subscription", regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.netflix.com",     logoUrl: null },
  { name: "Prime Video",    slug: "prime-video",    watchmodeId: 26,   tmdbProviderId: 119, type: "subscription", regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.primevideo.com",  logoUrl: null },
  { name: "Disney+",        slug: "disney-plus",    watchmodeId: 372,  tmdbProviderId: 337, type: "subscription", regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.disneyplus.com",  logoUrl: null },
  { name: "Max",            slug: "max",            watchmodeId: 387,  tmdbProviderId: 1899,type: "subscription", regions: ["US"],                     baseUrl: "https://www.max.com",         logoUrl: null },
  { name: "Hulu",           slug: "hulu",           watchmodeId: 157,  tmdbProviderId: 15,  type: "mixed",        regions: ["US"],                     baseUrl: "https://www.hulu.com",        logoUrl: null },
  { name: "Paramount+",     slug: "paramount-plus", watchmodeId: 444,  tmdbProviderId: 531, type: "subscription", regions: ["US","GB","CA","AU"],      baseUrl: "https://www.paramountplus.com",logoUrl: null },
  { name: "Apple TV+",      slug: "apple-tv-plus",  watchmodeId: 371,  tmdbProviderId: 350, type: "subscription", regions: ["US","GB","CA","AU","IN"], baseUrl: "https://tv.apple.com",        logoUrl: null },
  { name: "Peacock",        slug: "peacock",        watchmodeId: 386,  tmdbProviderId: 386, type: "mixed",        regions: ["US"],                     baseUrl: "https://www.peacocktv.com",   logoUrl: null },
  { name: "Crunchyroll",    slug: "crunchyroll",    watchmodeId: 283,  tmdbProviderId: 283, type: "subscription", regions: ["US","GB","CA","AU"],      baseUrl: "https://www.crunchyroll.com", logoUrl: null },
  { name: "Tubi",           slug: "tubi",           watchmodeId: 73,   tmdbProviderId: 73,  type: "free",         regions: ["US","CA","AU"],           baseUrl: "https://tubitv.com",          logoUrl: null },
  { name: "Pluto TV",       slug: "pluto-tv",       watchmodeId: 300,  tmdbProviderId: 300, type: "free",         regions: ["US","GB","DE"],           baseUrl: "https://pluto.tv",            logoUrl: null },
  { name: "Apple TV",       slug: "apple-tv",       watchmodeId: 371,  tmdbProviderId: 2,   type: "transactional",regions: ["US","GB","CA","AU"],      baseUrl: "https://tv.apple.com",        logoUrl: null },
  { name: "Amazon Video",   slug: "amazon-video",   watchmodeId: 26,   tmdbProviderId: 10,  type: "transactional",regions: ["US","GB","CA","AU"],      baseUrl: "https://www.amazon.com",      logoUrl: null },
  { name: "Vudu",           slug: "vudu",           watchmodeId: 7,    tmdbProviderId: 7,   type: "transactional",regions: ["US"],                     baseUrl: "https://www.vudu.com",        logoUrl: null },
  { name: "YouTube",        slug: "youtube",        watchmodeId: 192,  tmdbProviderId: 192, type: "transactional",regions: ["US","GB","CA","AU","IN"], baseUrl: "https://www.youtube.com",     logoUrl: null },
  { name: "Google Play",    slug: "google-play",    watchmodeId: 191,  tmdbProviderId: 3,   type: "transactional",regions: ["US","GB","CA","AU"],      baseUrl: "https://play.google.com",     logoUrl: null },
  { name: "Fandango At Home",slug: "fandango-home", watchmodeId: 7,    tmdbProviderId: 7,   type: "transactional",regions: ["US"],                     baseUrl: "https://www.fandangonow.com", logoUrl: null },
  { name: "Microsoft Store",slug: "microsoft-store",watchmodeId: 68,   tmdbProviderId: 68,  type: "transactional",regions: ["US","GB","CA"],           baseUrl: "https://www.microsoft.com",   logoUrl: null },
] as const;
