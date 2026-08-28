// Database layer — not configured in this deployment.
// Functions are stubbed so the project compiles without @prisma/client.
// To re-enable: add prisma and @prisma/client to package.json and set DATABASE_URL.
import type { ContentSummary } from "@/lib/api/types";

type ContentType = "movie" | "tv";

interface UpsertContentInput {
  tmdbId: number;
  contentType: ContentType;
  title: string;
  slug: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: Date | null;
  runtimeMins?: number | null;
  status?: string | null;
  voteAverage?: number | null;
  voteCount?: number | null;
  genreIds?: number[];
  metadata?: Record<string, unknown>;
}

export async function upsertContent(_input: UpsertContentInput) { return null; }
export async function getContentByTmdbId(_tmdbId: number) { return null; }
export async function getContentById(_id: string) { return null; }
export async function getContentBySlug(_slug: string) { return null; }
export function toContentSummary(_content: unknown): ContentSummary | null { return null; }

export function createSlug(title: string, year?: number | null): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return year ? `${base}-${year}` : base;
}
