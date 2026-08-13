import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtistAlbums, searchArtistId, type SpotifyAlbumResult } from "@/lib/spotify";

const MAX_SEED_ARTISTS = 5;
const MAX_PER_ARTIST = 6;

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

  const owned = await prisma.album.findMany({ select: { spotifyId: true } });
  const ownedIds = new Set(owned.map((a) => a.spotifyId));

  const seenArtists = new Set<string>();
  const groups: RecommendationGroup[] = [];

  for (const album of rated) {
    if (groups.length >= MAX_SEED_ARTISTS) break;

    let artistId = album.artistId;
    if (!artistId) {
      const primaryArtistName = album.artist.split(",")[0].trim();
      artistId = await searchArtistId(primaryArtistName).catch((err) => {
        console.error("searchArtistId failed", err);
        return null;
      });
      if (artistId) {
        await prisma.album.update({ where: { id: album.id }, data: { artistId } }).catch((err) => {
          console.error("failed to persist resolved artistId", err);
        });
      }
    }

    if (!artistId || seenArtists.has(artistId)) continue;
    seenArtists.add(artistId);

    let artistAlbums: SpotifyAlbumResult[];
    try {
      artistAlbums = await getArtistAlbums(artistId);
    } catch (err) {
      console.error(`getArtistAlbums failed for ${album.artist} (${artistId})`, err);
      continue;
    }

    const suggestions = artistAlbums.filter((a) => !ownedIds.has(a.spotifyId)).slice(0, MAX_PER_ARTIST);
    if (suggestions.length === 0) continue;

    groups.push({
      becauseOf: { title: album.title, artist: album.artist, rating: album.rating! },
      albums: suggestions,
    });
  }

  return NextResponse.json({ groups });
}
