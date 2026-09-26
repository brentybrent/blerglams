import { prisma } from "@/lib/prisma";
import { searchArtistId } from "@/lib/spotify";
import { getSimilarArtists, getTopTags } from "@/lib/lastfm";

const MAX_LASTFM_CANDIDATES = 8;

// Last.fm match scores range 0-1. Below this, a "similar artist" is often
// only tangentially related (or an artifact of a thin listener base for the
// seed artist) — kept as a first-pass filter, but genre-fit scoring (below)
// is what actually guards against off-taste recommendations now, since this
// threshold alone wasn't a strong enough guardrail on its own.
const MIN_LASTFM_MATCH = 0.15;

// Only ratings at or above this count as positive taste signal for building
// a profile. Ratings below this aren't used yet (no negative weighting) —
// a reasonable follow-up if recommendations still feel off after this.
const MIN_SEED_RATING = 6;

// How many of your rated albums to pull when building the taste profile.
// Higher = a more complete picture of your library, at the cost of more
// artist-resolution lookups.
const MAX_SEED_ALBUMS = 40;

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

export type SimilarArtistMatch = { artistId: string; name: string; match: number };

/**
 * Similar-artist candidates for a seed artist, ranked best-first, with their
 * Last.fm match scores and canonical names intact (the name is needed
 * downstream to look up the candidate's own genre tags for fit-scoring,
 * without a second Spotify round-trip).
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
      return artistId ? { artistId, name: candidate.name, match: candidate.match } : null;
    })
  );

  // Multiple Last.fm names can resolve to the same Spotify artist — dedupe,
  // keeping the best match score seen for each.
  const bestByArtist = new Map<string, { name: string; match: number }>();
  for (const r of resolved) {
    if (!r) continue;
    if (r.artistId === seedArtistId) continue;
    if (excludeIds.has(r.artistId)) continue;
    const current = bestByArtist.get(r.artistId);
    if (current === undefined || r.match > current.match) {
      bestByArtist.set(r.artistId, { name: r.name, match: r.match });
    }
  }

  return [...bestByArtist.entries()]
    .map(([artistId, v]) => ({ artistId, ...v }))
    .sort((a, b) => b.match - a.match);
}

export type TagProfile = Map<string, number>;

/**
 * A single artist's genre-tag fingerprint from Last.fm's community tagging
 * (artist.gettoptags), normalized to 0-1 per tag. This is a different use of
 * genre data than the removed Spotify genre-tag search: it's never used to
 * drive a broad catalog search (the thing that let popularity dominate
 * before) — only to compare one specific artist's tags against your
 * aggregate taste profile.
 */
export async function getArtistTagProfile(artistName: string): Promise<TagProfile> {
  const tags = await getTopTags(artistName).catch((err) => {
    console.error(`getTopTags failed for "${artistName}"`, err);
    return [];
  });
  return new Map(tags.map((t) => [t.tag, t.weight]));
}

/** Adds a weighted artist tag profile into an aggregate profile, in place. */
export function mergeTagProfile(target: TagProfile, tags: TagProfile, seedWeight: number): void {
  for (const [tag, weight] of tags) {
    target.set(tag, (target.get(tag) ?? 0) + weight * seedWeight);
  }
}

/**
 * How well a candidate's own tags overlap with your aggregate weighted taste
 * profile — a dot-product over shared tags. Zero means no shared tags at
 * all, the strongest signal that a candidate genuinely doesn't fit your
 * taste regardless of how strongly Last.fm claims it's "similar" to one
 * specific seed artist.
 */
export function scoreTagOverlap(candidateTags: TagProfile, profile: TagProfile): number {
  let score = 0;
  for (const [tag, weight] of candidateTags) {
    const profileWeight = profile.get(tag);
    if (profileWeight) score += weight * profileWeight;
  }
  return score;
}
