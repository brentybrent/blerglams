import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtistAlbums, type SpotifyAlbumResult } from "@/lib/spotify";
import { getRatedSeedAlbums, resolveSeedArtistId, findSimilarArtistIds, shuffle } from "@/lib/recommendations";

const MAX_SEED_ARTISTS = 3;
const SIMILAR_ARTIST_WINDOW = 4; // shuffle within the top-N best matches for variety
const MAX_SIMILAR_ARTISTS_PER_SEED = 2;
const MAX_ALBUMS_PER_SIMILAR_ARTIST = 2;
const MAX_ALBUMS_FALLBACK = 4;

type RecommendationGroup = {
  becauseOf: { title: string; artist: string; rating: number };
  albums: SpotifyAlbumResult[];
};

export async function GET() {
  const rated = shuffle(await getRatedSeedAlbums());
  if (rated.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const owned = await prisma.album.findMany({ select: { spotifyId: true, artistId: true } });
  const ownedAlbumIds = new Set(owned.map((a) => a.spotifyId));
  const knownArtistIds = new Set(owned.map((a) => a.artistId).filter((id): id is string => Boolean(id)));

  const seenSeedArtists = new Set<string>();
  const usedSimilarArtists = new Set<string>();
  const groups: RecommendationGroup[] = [];

  for (const seed of rated) {
    if (groups.length >= MAX_SEED_ARTISTS) break;

    const seedArtistId = await resolveSeedArtistId(seed);
    if (!seedArtistId || seenSeedArtists.has(seedArtistId)) continue;
    seenSeedArtists.add(seedArtistId);
    knownArtistIds.add(seedArtistId);

    const primaryArtistName = seed.artist.split(",")[0].trim();
    const excludeIds = new Set([...knownArtistIds, ...usedSimilarArtists]);
    const similarIds = await findSimilarArtistIds(seedArtistId, primaryArtistName, excludeIds);

    // Shuffle within a window of the best matches rather than always taking
    // the exact same top N, so repeat visits surface some variety.
    const chosen = shuffle(similarIds.slice(0, SIMILAR_ARTIST_WINDOW)).slice(0, MAX_SIMILAR_ARTISTS_PER_SEED);

    let albums: SpotifyAlbumResult[] = [];
    if (chosen.length > 0) {
      chosen.forEach((id) => usedSimilarArtists.add(id));
      const albumLists = await Promise.all(
        chosen.map((id) =>
          getArtistAlbums(id).catch((err) => {
            console.error(`getArtistAlbums failed for ${id}`, err);
            return [] as SpotifyAlbumResult[];
          })
        )
      );
      albums = albumLists
        .map((list) => list.filter((a) => !ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_PER_SIMILAR_ARTIST))
        .flat();
    }

    if (albums.length === 0) {
      // No usable similar artists (or all their albums were already owned) —
      // fall back to more from the seed artist itself so this seed isn't wasted.
      const fallbackAlbums = await getArtistAlbums(seedArtistId).catch((err) => {
        console.error(`getArtistAlbums fallback failed for ${seedArtistId}`, err);
        return [] as SpotifyAlbumResult[];
      });
      albums = fallbackAlbums.filter((a) => !ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_FALLBACK);
    }

    if (albums.length === 0) continue;

    groups.push({
      becauseOf: { title: seed.title, artist: seed.artist, rating: seed.rating },
      albums,
    });
  }

  return NextResponse.json({ groups });
}
