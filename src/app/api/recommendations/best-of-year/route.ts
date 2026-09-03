import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtistAlbums, type SpotifyAlbumResult } from "@/lib/spotify";
import { getAlbumRating, type DiscogsRating } from "@/lib/discogs";
import { getRatedSeedAlbums, resolveSeedArtistId, findSimilarArtistIds, shuffle } from "@/lib/recommendations";

// This is a separate, independently-timing-out endpoint from the main
// /api/recommendations route on purpose: it does its own round of Discogs
// lookups (two requests per candidate album) on top of the usual Spotify/
// Last.fm calls, so if Discogs is slow or rate-limited, it only delays this
// section — the main recommendation groups load unaffected.

const MAX_SEED_ARTISTS = 4;
const MAX_SIMILAR_ARTISTS_PER_SEED = 3;
const MAX_RATING_LOOKUPS = 8; // caps Discogs calls to 2x this per request
const MAX_RESULTS = 5;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type BestOfYearAlbum = SpotifyAlbumResult & { discogsRating: DiscogsRating };

export async function GET() {
  const rated = shuffle(await getRatedSeedAlbums());
  if (rated.length === 0) {
    return NextResponse.json({ albums: [] });
  }

  const owned = await prisma.album.findMany({ select: { spotifyId: true, artistId: true } });
  const ownedAlbumIds = new Set(owned.map((a) => a.spotifyId));
  const knownArtistIds = new Set(owned.map((a) => a.artistId).filter((id): id is string => Boolean(id)));

  const seenSeedArtists = new Set<string>();
  const candidateArtistIds = new Set<string>();

  for (const seed of rated) {
    if (seenSeedArtists.size >= MAX_SEED_ARTISTS) break;

    const seedArtistId = await resolveSeedArtistId(seed);
    if (!seedArtistId || seenSeedArtists.has(seedArtistId)) continue;
    seenSeedArtists.add(seedArtistId);
    knownArtistIds.add(seedArtistId);

    const primaryArtistName = seed.artist.split(",")[0].trim();
    const excludeIds = new Set([...knownArtistIds, ...candidateArtistIds]);
    const similarIds = await findSimilarArtistIds(seedArtistId, primaryArtistName, excludeIds);
    similarIds.slice(0, MAX_SIMILAR_ARTISTS_PER_SEED).forEach((id) => candidateArtistIds.add(id));
  }

  if (candidateArtistIds.size === 0) {
    return NextResponse.json({ albums: [] });
  }

  const albumLists = await Promise.all(
    [...candidateArtistIds].map((id) =>
      getArtistAlbums(id).catch((err) => {
        console.error(`getArtistAlbums failed for ${id}`, err);
        return [] as SpotifyAlbumResult[];
      })
    )
  );

  const now = Date.now();
  const seenAlbumIds = new Set<string>();
  const recentCandidates = albumLists.flat().filter((album) => {
    if (ownedAlbumIds.has(album.spotifyId) || seenAlbumIds.has(album.spotifyId)) return false;
    if (!album.releaseDate) return false;
    const releasedAt = Date.parse(album.releaseDate);
    if (Number.isNaN(releasedAt) || releasedAt > now || now - releasedAt > ONE_YEAR_MS) return false;
    seenAlbumIds.add(album.spotifyId);
    return true;
  });

  const toCheck = shuffle(recentCandidates).slice(0, MAX_RATING_LOOKUPS);

  const withRatings = await Promise.all(
    toCheck.map(async (album) => {
      const rating = await getAlbumRating(album.artist, album.title).catch((err) => {
        console.error(`getAlbumRating failed for "${album.artist} - ${album.title}"`, err);
        return null;
      });
      return rating ? { ...album, discogsRating: rating } : null;
    })
  );

  const albums: BestOfYearAlbum[] = withRatings
    .filter((a): a is BestOfYearAlbum => a !== null)
    .sort(
      (a, b) => b.discogsRating.average - a.discogsRating.average || b.discogsRating.count - a.discogsRating.count
    )
    .slice(0, MAX_RESULTS);

  return NextResponse.json({ albums });
}
