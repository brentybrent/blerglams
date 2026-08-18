import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getArtist,
  getArtistAlbums,
  searchArtistId,
  searchArtistsByGenre,
  type SpotifyAlbumResult,
} from "@/lib/spotify";

const MAX_SEED_ARTISTS = 3;
const MAX_GENRES_PER_SEED = 3;
const MAX_SIMILAR_ARTISTS_PER_SEED = 2;
const MAX_ALBUMS_PER_SIMILAR_ARTIST = 2;
const MAX_ALBUMS_FALLBACK = 4;

type RecommendationGroup = {
  becauseOf: { title: string; artist: string; rating: number };
  albums: SpotifyAlbumResult[];
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
  const ownedAlbumIds = new Set(owned.map((a) => a.spotifyId));
  const knownArtistIds = new Set(owned.map((a) => a.artistId).filter((id): id is string => Boolean(id)));

  const seenSeedArtists = new Set<string>();
  const usedSimilarArtists = new Set<string>();
  const groups: RecommendationGroup[] = [];

  for (const album of rated) {
    if (groups.length >= MAX_SEED_ARTISTS) break;

    let seedArtistId = album.artistId;
    if (!seedArtistId) {
      const primaryArtistName = album.artist.split(",")[0].trim();
      seedArtistId = await searchArtistId(primaryArtistName).catch((err) => {
        console.error("searchArtistId failed", err);
        return null;
      });
      if (seedArtistId) {
        knownArtistIds.add(seedArtistId);
        await prisma.album.update({ where: { id: album.id }, data: { artistId: seedArtistId } }).catch((err) => {
          console.error("failed to persist resolved artistId", err);
        });
      }
    }

    if (!seedArtistId || seenSeedArtists.has(seedArtistId)) continue;
    seenSeedArtists.add(seedArtistId);

    const albums = await buildSimilarArtistAlbums({
      seedArtistId,
      knownArtistIds,
      usedSimilarArtists,
      ownedAlbumIds,
    });

    if (albums.length === 0) continue;

    groups.push({
      becauseOf: { title: album.title, artist: album.artist, rating: album.rating! },
      albums,
    });
  }

  return NextResponse.json({ groups });
}

async function buildSimilarArtistAlbums({
  seedArtistId,
  knownArtistIds,
  usedSimilarArtists,
  ownedAlbumIds,
}: {
  seedArtistId: string;
  knownArtistIds: Set<string>;
  usedSimilarArtists: Set<string>;
  ownedAlbumIds: Set<string>;
}): Promise<SpotifyAlbumResult[]> {
  const seedArtist = await getArtist(seedArtistId).catch((err) => {
    console.error(`getArtist failed for ${seedArtistId}`, err);
    return null;
  });

  const genres = (seedArtist?.genres ?? []).slice(0, MAX_GENRES_PER_SEED);

  if (genres.length > 0) {
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
        if (knownArtistIds.has(candidate.id)) continue;
        if (usedSimilarArtists.has(candidate.id)) continue;

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

    if (ranked.length > 0) {
      ranked.forEach((artistId) => usedSimilarArtists.add(artistId));

      const albumLists = await Promise.all(
        ranked.map((artistId) =>
          getArtistAlbums(artistId).catch((err) => {
            console.error(`getArtistAlbums failed for ${artistId}`, err);
            return [] as SpotifyAlbumResult[];
          })
        )
      );

      return albumLists
        .map((list) => list.filter((a) => !ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_PER_SIMILAR_ARTIST))
        .flat();
    }
  }

  // No usable genre data, or every genre-matched artist was already known — fall
  // back to more from the seed artist itself rather than showing nothing.
  const fallbackAlbums = await getArtistAlbums(seedArtistId).catch((err) => {
    console.error(`getArtistAlbums fallback failed for ${seedArtistId}`, err);
    return [] as SpotifyAlbumResult[];
  });
  return fallbackAlbums.filter((a) => !ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_FALLBACK);
}
