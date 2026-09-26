import { prisma } from "@/lib/prisma";
import { searchArtistId } from "@/lib/spotify";
import { getSimilarArtists } from "@/lib/lastfm";

const MAX_LASTFM_CANDIDATES = 8;

// Last.fm match scores range 0-1. Below this, a "similar artist" is often
// only tangentially related (or an artifact of a thin listener base for the
// seed artist) — surfacing those produced off-genre recommendations, so
// they're filtered out rather than treated as real similarity signal.
const MIN_LASTFM_MATCH = 0.15;

// Only ratings at or above this count as positive taste signal for building
// a profile. Ratings below this aren't used yet (no negative weighting) —
// a reasonable follow-up if recommendations still feel off after this.
const MIN_SEED_RATING = 6;

// How many of your rated albums to pull when building the taste profile.
// Higher = a more complete picture of your library, at the cost of more
// artist-resolution lookups.
const MAX_SEED_ALBUMS = 30;

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type SeedAlbum = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  rating: number;
};

async function getRatedAlbums(limit: number): Promise<SeedAlbum[]> {
  const rated = await prisma.album.findMany({
    where: { status: "LIBRARY", rating: { gte: MIN_SEED_RATING } },
    orderBy: { rating: "desc" },
    take: limit,
  });
  return rated.map((a) => ({ id: a.id, title: a.title, artist: a.artist, artistId: a.artistId, rating: a.rating! }));
}

async function resolveSeedArtistId(seed: SeedAlbum): Promise<string | null> {
  if (seed.artistId) return seed.artistId;

  const primaryArtistName = seed.artist.split(",")[0].trim();
  const artistId = await searchArtistId(primaryArtistName).catch((err) => {
    console.error(`searchArtistId failed for "${primaryArtistName}"`, err);
    return null;
  });

  if (artistId) {
    await prisma.album.update({ where: { id: seed.id }, data: { artistId } }).catch((err) => {
      console.error("failed to persist resolved artistId", err);
    });
  }
  return artistId;
}

export type WeightedSeedArtist = {
  artistId: string;
  weight: number;
  /** Highest-rated album by this artist — used to attribute "because you rated X". */
  representativeAlbum: SeedAlbum;
};

/**
 * Builds a weighted taste profile from your whole rated library, rather than
 * treating a few individually-picked albums as isolated recommendation
 * seeds. Every album rated 6+ contributes (rating - 5) points of weight to
 * its artist — so a 9 counts more than a 6, and multiple loved albums by the
 * same artist compound into a stronger signal for that artist. Returns one
 * entry per distinct artist, ranked by total weight.
 */
export async function getWeightedSeedArtists(limit = MAX_SEED_ALBUMS): Promise<WeightedSeedArtist[]> {
  const rated = await getRatedAlbums(limit);

  const resolved = await Promise.all(
    rated.map(async (album) => ({ album, artistId: await resolveSeedArtistId(album) }))
  );

  const byArtist = new Map<string, { weight: number; representativeAlbum: SeedAlbum }>();
  for (const { album, artistId } of resolved) {
    if (!artistId) continue;
    const weight = album.rating - 5;
    const existing = byArtist.get(artistId);
    if (existing) {
      existing.weight += weight;
      if (album.rating > existing.representativeAlbum.rating) {
        existing.representativeAlbum = album;
      }
    } else {
      byArtist.set(artistId, { weight, representativeAlbum: album });
    }
  }

  return [...byArtist.entries()]
    .map(([artistId, v]) => ({ artistId, ...v }))
    .sort((a, b) => b.weight - a.weight);
}

export type SimilarArtistMatch = { artistId: string; match: number };

/**
 * Similar-artist candidates for a seed artist, ranked best-first, with their
 * Last.fm match scores intact so callers can combine them with a seed's
 * taste-profile weight (match x weight) rather than treating every seed as
 * equally important.
 *
 * This used to also fall back to a Spotify genre-tag search when Last.fm had
 * nothing, but that produced clearly wrong results: Spotify's own genre tags
 * are often broad ("rock", "metal"), and ranking a text search for one of
 * those by raw popularity just surfaces whatever's most mainstream under
 * that umbrella — not a real similarity signal. Removed rather than tuned,
 * since a popularity-ranked keyword search isn't a sound basis for "similar
 * artist" matching at any threshold.
 */
export async function findSimilarArtists(
  seedArtistId: string,
  seedArtistName: string,
  excludeIds: Set<string>
): Promise<SimilarArtistMatch[]> {
  const similar = await getSimilarArtists(seedArtistName, MAX_LASTFM_CANDIDATES).catch((err) => {
    console.error(`getSimilarArtists failed for "${seedArtistName}"`, err);
    return [];
  });
  const strongMatches = similar.filter((candidate) => candidate.match >= MIN_LASTFM_MATCH);
  if (strongMatches.length === 0) return [];

  const resolved = await Promise.all(
    strongMatches.map(async (candidate) => {
      const artistId = await searchArtistId(candidate.name).catch((err) => {
        console.error(`searchArtistId failed for "${candidate.name}"`, err);
        return null;
      });
      return artistId ? { artistId, match: candidate.match } : null;
    })
  );

  // Multiple Last.fm names can resolve to the same Spotify artist — dedupe,
  // keeping the best match score seen for each.
  const bestMatchByArtist = new Map<string, number>();
  for (const r of resolved) {
    if (!r) continue;
    if (r.artistId === seedArtistId) continue;
    if (excludeIds.has(r.artistId)) continue;
    const current = bestMatchByArtist.get(r.artistId);
    if (current === undefined || r.match > current) {
      bestMatchByArtist.set(r.artistId, r.match);
    }
  }

  return [...bestMatchByArtist.entries()]
    .map(([artistId, match]) => ({ artistId, match }))
    .sort((a, b) => b.match - a.match);
}
