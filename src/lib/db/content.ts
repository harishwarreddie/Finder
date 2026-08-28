// ── CONTENT DB LAYER ──────────────────────────────────────────────────────────
// All database operations for the Content model.

import { prisma } from "./client";
import type { ContentType } from "@prisma/client";
import type { ContentSummary } from "@/lib/api/types";
import { tmdbPosterUrl } from "@/lib/api/tmdb";

// ── UPSERT ────────────────────────────────────────────────────────────────────

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

export async function upsertContent(input: UpsertContentInput) {
  const { genreIds, ...data } = input;

  const content = await prisma.content.upsert({
    where: { tmdbId: data.tmdbId },
    create: {
      ...data,
      metadata: data.metadata ?? {},
    },
    update: {
      ...data,
      updatedAt: new Date(),
    },
  });

  // Sync genres
  if (genreIds && genreIds.length > 0) {
    await prisma.contentGenre.deleteMany({ where: { contentId: content.id } });
    await prisma.contentGenre.createMany({
      data: genreIds.map((genreId) => ({ contentId: content.id, genreId })),
      skipDuplicates: true,
    });
  }

  return content;
}

// ── QUERIES ───────────────────────────────────────────────────────────────────

export async function getContentByTmdbId(tmdbId: number) {
  return prisma.content.findUnique({
    where: { tmdbId },
    include: { genres: { include: { genre: true } } },
  });
}

export async function getContentById(id: string) {
  return prisma.content.findUnique({
    where: { id },
    include: { genres: { include: { genre: true } } },
  });
}

export async function getContentBySlug(slug: string) {
  return prisma.content.findUnique({
    where: { slug },
    include: { genres: { include: { genre: true } } },
  });
}

// ── NORMALIZERS ───────────────────────────────────────────────────────────────

export function toContentSummary(
  content: Awaited<ReturnType<typeof getContentByTmdbId>>
): ContentSummary | null {
  if (!content) return null;

  const releaseYear = content.releaseDate
    ? new Date(content.releaseDate).getFullYear()
    : null;

  return {
    id: content.id,
    tmdbId: content.tmdbId,
    contentType: content.contentType,
    title: content.title,
    slug: content.slug,
    overview: content.overview,
    posterUrl: tmdbPosterUrl(content.posterPath),
    releaseYear,
    runtimeMins: content.runtimeMins,
    voteAverage: content.voteAverage,
    genres: content.genres.map((g: { genre: { id: number; name: string } }) => ({
      id: g.genre.id,
      name: g.genre.name,
    })),
  };
}

// ── SLUG HELPERS ──────────────────────────────────────────────────────────────

export function createSlug(title: string, year?: number | null): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return year ? `${base}-${year}` : base;
}
