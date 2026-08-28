import { SearchBar } from "@/components/search/SearchBar";

const EXAMPLE_QUERIES = [
  "Where can I watch Oppenheimer?",
  "Is Interstellar on Netflix?",
  "Find me a thriller under $4",
  "What's the cheapest way to watch Dune?",
  "I have Prime Video — what can I watch for free?",
];

export default function HomePage() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center min-h-screen px-4 py-16"
      style={{ background: "var(--background)" }}>

      {/* Logo / Brand */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <span style={{ fontSize: 28 }}>🎬</span>
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Finder
          </span>
        </div>
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Find where to watch anything.
        </h1>
        <p className="text-base max-w-md mx-auto" style={{ color: "var(--muted)" }}>
          Ask in plain English. Get streaming availability, rental prices,
          and the cheapest way to watch — instantly.
        </p>
      </div>

      {/* Search */}
      <div className="w-full max-w-2xl">
        <SearchBar />
      </div>

      {/* Example queries */}
      <div className="mt-8 flex flex-wrap gap-2 justify-center max-w-2xl">
        {EXAMPLE_QUERIES.map((q) => (
          <a
            key={q}
            href={`/search?q=${encodeURIComponent(q)}`}
            className="text-sm px-3 py-1.5 rounded-full border transition-colors"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted)",
              background: "var(--surface)",
            }}
          >
            {q}
          </a>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-16 text-xs" style={{ color: "var(--subtle)" }}>
        Legal streaming sources only · US region · Data from TMDB &amp; Watchmode
      </p>
    </main>
  );
}
