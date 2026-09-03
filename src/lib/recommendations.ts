import { prisma } from "@/lib/prisma";
import { getArtist, searchArtistId, searchArtistsByGenre } from "@/lib/spotify";
import { getSimilarArtists } from "@/lib/lastfm";

const MAX_LASTFM_CANDIDATES = 8;
const MAX_GENRES_PER_SEED = 3;

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

export async function getRatedSeedAlbums(limit = 20): Promise<SeedAlbum[]> {
  const rated = await prisma.album.findMany({
    where: { status: "LIBRARY", rating: { gte: 7 } },
    orderBy: { rating: "desc" },
    take: limit,
  });
  return rated.map((a) => ({ id: a.id, title: a.title, artist: a.artist, artistId: a.artistId, rating: a.rating! }));
}

export async function resolveSeedArtistId(seed: SeedAlbum): Promise<string | null> {
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

/**
 * Similar-artist Spotify IDs for a seed artist, ranked best-first. Tries
 * Last.fm's real similarity data first, falling back to Spotify genre-tag
 * overlap (a weaker signal — Spotify's own tags are often sparse/missing)
 * only if Last.fm has nothing. Returns the full ranked list; callers decide
 * how many to use.
 */
export async function findSimilarArtistIds(
  seedArtistId: string,
  seedArtistName: string,
  excludeIds: Set<string>
): Promise<string[]> {
  const viaLastfm = await similarArtistIdsViaLastfm(seedArtistId, seedArtistName, excludeIds);
  if (viaLastfm.length > 0) return viaLastfm;
  return similarArtistIdsViaGenre(seedArtistId, excludeIds);
}

async function similarArtistIdsViaLastfm(
  seedArtistId: string,
  seedArtistName: string,
  excludeIds: Set<string>
): Promise<string[]> {
  const similar = await getSimilarArtists(seedArtistName, MAX_LASTFM_CANDIDATES).catch((err) => {
    console.error(`getSimilarArtists failed for "${seedArtistName}"`, err);
    return [];
  });
  if (similar.length === 0) return [];

  const resolved = await Promise.all(
    similar.map(async (candidate) => {
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

  return [...bestMatchByArtist.entries()].sort(([, a], [, b]) => b - a).map(([id]) => id);
}

async function similarArtistIdsViaGenre(seedArtistId: string, excludeIds: Set<string>): Promise<string[]> {
  const seedArtist = await getArtist(seedArtistId).catch((err) => {
    console.error(`getArtist failed for ${seedArtistId}`, err);
    return null;
  });
  const genres = (seedArtist?.genres ?? []).slice(0, MAX_GENRES_PER_SEED);
  if (genres.length === 0) return [];

  const genreResults = await Promise.all(
    genres.map((genre) =>
      searchArtistsByGenre(genre).catch((err) => {
        console.error(`searchArtistsByGenre failed for "${genre}"`, err);
        return [];
      })
    )
  );

  const candidates = new Map<string, { matches: number; popularity: number }>();
  for (const results of genreResults) {
    for (const candidate of results) {
      if (candidate.id === seedArtistId) continue;
      if (excludeIds.has(candidate.id)) continue;

      const existing = candidates.get(candidate.id);
      if (existing) {
        existing.matches += 1;
      } else {
        candidates.set(candidate.id, { matches: 1, popularity: candidate.popularity });
      }
    }
  }

  return [...candidates.entries()]
    .sort(([, a], [, b]) => b.matches - a.matches || b.popularity - a.popularity)
    .map(([id]) => id);
}
