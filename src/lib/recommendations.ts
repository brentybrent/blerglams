import { prisma } from "@/lib/prisma";
import { searchArtistId } from "@/lib/spotify";
import { getSimilarArtists } from "@/lib/lastfm";

const MAX_LASTFM_CANDIDATES = 8;

// Last.fm match scores range 0-1. Below this, a "similar artist" is often
// only tangentially related (or an artifact of a thin listener base for the
// seed artist) — surfacing those produced off-genre recommendations, so
// they're filtered out rather than treated as real similarity signal.
const MIN_LASTFM_MATCH = 0.15;

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
 * Similar-artist Spotify IDs for a seed artist, ranked best-first, from
 * Last.fm's real listening/tagging-based similarity data. Weak matches
 * (below MIN_LASTFM_MATCH) are dropped rather than returned, since a low
 * confidence score is often only tangentially related to the seed artist —
 * callers should fall back to something safer (e.g. more from the seed
 * artist itself) when this returns an empty list, rather than guessing.
 *
 * This used to also fall back to a Spotify genre-tag search when Last.fm had
 * nothing, but that produced clearly wrong results: Spotify's own genre tags
 * are often broad ("rock", "metal"), and ranking a text search for one of
 * those by raw popularity just surfaces whatever's most mainstream under
 * that umbrella — not a real similarity signal. Removed rather than tuned,
 * since a popularity-ranked keyword search isn't a sound basis for "similar
 * artist" recommendations at any threshold.
 */
export async function findSimilarArtistIds(
  seedArtistId: string,
  seedArtistName: string,
  excludeIds: Set<string>
): Promise<string[]> {
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

  return [...bestMatchByArtist.entries()].sort(([, a], [, b]) => b - a).map(([id]) => id);
}
