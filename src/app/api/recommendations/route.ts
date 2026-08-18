import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getArtist,
  getArtistAlbums,
  searchArtistId,
  searchArtistsByGenre,
  type SpotifyAlbumResult,
} from "@/lib/spotify";
import { getSimilarArtists } from "@/lib/lastfm";

const MAX_SEED_ARTISTS = 3;
const MAX_LASTFM_CANDIDATES = 8;
const MAX_GENRES_PER_SEED = 3;
const MAX_SIMILAR_ARTISTS_PER_SEED = 2;
const MAX_ALBUMS_PER_SIMILAR_ARTIST = 2;
const MAX_ALBUMS_FALLBACK = 4;

type RecommendationGroup = {
  becauseOf: { title: string; artist: string; rating: number };
  albums: SpotifyAlbumResult[];
};

type Filters = {
  knownArtistIds: Set<string>;
  usedSimilarArtists: Set<string>;
  ownedAlbumIds: Set<string>;
};

export async function GET() {
  const rated = await prisma.album.findMany({
    where: { status: "LIBRARY", rating: { gte: 7 } },
    orderBy: { rating: "desc" },
    take: 20,
  });

  if (rated.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const owned = await prisma.album.findMany({ select: { spotifyId: true, artistId: true } });
  const filters: Filters = {
    ownedAlbumIds: new Set(owned.map((a) => a.spotifyId)),
    knownArtistIds: new Set(owned.map((a) => a.artistId).filter((id): id is string => Boolean(id))),
    usedSimilarArtists: new Set<string>(),
  };

  const seenSeedArtists = new Set<string>();
  const groups: RecommendationGroup[] = [];

  for (const album of rated) {
    if (groups.length >= MAX_SEED_ARTISTS) break;

    const primaryArtistName = album.artist.split(",")[0].trim();
    let seedArtistId = album.artistId;
    if (!seedArtistId) {
      seedArtistId = await searchArtistId(primaryArtistName).catch((err) => {
        console.error("searchArtistId failed", err);
        return null;
      });
      if (seedArtistId) {
        filters.knownArtistIds.add(seedArtistId);
        await prisma.album.update({ where: { id: album.id }, data: { artistId: seedArtistId } }).catch((err) => {
          console.error("failed to persist resolved artistId", err);
        });
      }
    }

    if (!seedArtistId || seenSeedArtists.has(seedArtistId)) continue;
    seenSeedArtists.add(seedArtistId);

    const albums = await findSimilarArtistAlbums(seedArtistId, primaryArtistName, filters);
    if (albums.length === 0) continue;

    groups.push({
      becauseOf: { title: album.title, artist: album.artist, rating: album.rating! },
      albums,
    });
  }

  return NextResponse.json({ groups });
}

/**
 * Three-tier similarity search, each tried only if the previous one comes up empty:
 *   1. Last.fm's artist.getsimilar — purpose-built for this, based on real listening data.
 *   2. Spotify genre-tag overlap — Spotify's own genre tags are often sparse/missing,
 *      so this is a weaker signal, kept only as a secondary net.
 *   3. More albums from the seed artist itself — last resort so a section never goes empty.
 */
async function findSimilarArtistAlbums(
  seedArtistId: string,
  seedArtistName: string,
  filters: Filters
): Promise<SpotifyAlbumResult[]> {
  const viaLastfm = await similarArtistsViaLastfm(seedArtistId, seedArtistName, filters);
  if (viaLastfm.length > 0) return viaLastfm;

  const viaGenre = await similarArtistsViaGenre(seedArtistId, filters);
  if (viaGenre.length > 0) return viaGenre;

  const fallbackAlbums = await getArtistAlbums(seedArtistId).catch((err) => {
    console.error(`getArtistAlbums fallback failed for ${seedArtistId}`, err);
    return [] as SpotifyAlbumResult[];
  });
  return fallbackAlbums.filter((a) => !filters.ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_FALLBACK);
}

async function similarArtistsViaLastfm(
  seedArtistId: string,
  seedArtistName: string,
  filters: Filters
): Promise<SpotifyAlbumResult[]> {
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
    if (filters.knownArtistIds.has(r.artistId)) continue;
    if (filters.usedSimilarArtists.has(r.artistId)) continue;
    const current = bestMatchByArtist.get(r.artistId);
    if (current === undefined || r.match > current) {
      bestMatchByArtist.set(r.artistId, r.match);
    }
  }

  const ranked = [...bestMatchByArtist.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_SIMILAR_ARTISTS_PER_SEED)
    .map(([artistId]) => artistId);

  return fetchAlbumsForArtists(ranked, filters);
}

async function similarArtistsViaGenre(seedArtistId: string, filters: Filters): Promise<SpotifyAlbumResult[]> {
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
      if (filters.knownArtistIds.has(candidate.id)) continue;
      if (filters.usedSimilarArtists.has(candidate.id)) continue;

      const existing = candidates.get(candidate.id);
      if (existing) {
        existing.matches += 1;
      } else {
        candidates.set(candidate.id, { matches: 1, popularity: candidate.popularity });
      }
    }
  }

  const ranked = [...candidates.entries()]
    .sort(([, a], [, b]) => b.matches - a.matches || b.popularity - a.popularity)
    .slice(0, MAX_SIMILAR_ARTISTS_PER_SEED)
    .map(([artistId]) => artistId);

  return fetchAlbumsForArtists(ranked, filters);
}

async function fetchAlbumsForArtists(artistIds: string[], filters: Filters): Promise<SpotifyAlbumResult[]> {
  if (artistIds.length === 0) return [];
  artistIds.forEach((id) => filters.usedSimilarArtists.add(id));

  const albumLists = await Promise.all(
    artistIds.map((artistId) =>
      getArtistAlbums(artistId).catch((err) => {
        console.error(`getArtistAlbums failed for ${artistId}`, err);
        return [] as SpotifyAlbumResult[];
      })
    )
  );

  return albumLists
    .map((list) =>
      list.filter((a) => !filters.ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_PER_SIMILAR_ARTIST)
    )
    .flat();
}
