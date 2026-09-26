import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtistAlbums, type SpotifyAlbumResult } from "@/lib/spotify";
import {
  getWeightedSeedArtists,
  findSimilarArtists,
  getArtistTagProfile,
  mergeTagProfile,
  scoreTagOverlap,
  shuffle,
  type SeedAlbum,
  type TagProfile,
} from "@/lib/recommendations";

// How many of your top-weighted artists we bother querying Last.fm for.
// Aggregating across more of your profile gives a fuller picture of your
// taste, at the cost of more (fully parallel) outbound requests per load.
const MAX_SEEDS_QUERIED = 10;

// Of the raw-score-ranked candidates, how many get a genre-tag lookup for
// fit-scoring against your aggregate profile. Bounded separately from the
// raw candidate count since Last.fm calls aren't free.
const GENRE_FIT_SHORTLIST = 15;

// After genre-fit scoring, the best-scoring candidates are shuffled from
// this pool before the final pick — so recommendations stay grounded in
// your actual weighted taste (never pulling from a low-relevance tail)
// while the Shuffle button still has a meaningfully different pool to draw
// a fresh set from each time.
const QUALIFIED_POOL_SIZE = 12;
const MAX_RESULT_ARTISTS = 6;

const MAX_ALBUMS_PER_ARTIST = 2;
const MAX_ALBUMS_FALLBACK = 4;

type RecommendationGroup = {
  becauseOf: { title: string; artist: string; rating: number };
  albums: SpotifyAlbumResult[];
};

type Candidate = {
  name: string;
  score: number;
  bestSeed: SeedAlbum;
  bestContribution: number;
};

export async function GET() {
  const seedArtists = await getWeightedSeedArtists();
  if (seedArtists.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const owned = await prisma.album.findMany({ select: { spotifyId: true, artistId: true } });
  const ownedAlbumIds = new Set(owned.map((a) => a.spotifyId));
  const knownArtistIds = new Set([
    ...owned.map((a) => a.artistId).filter((id): id is string => Boolean(id)),
    ...seedArtists.map((s) => s.artistId),
  ]);

  const topSeeds = seedArtists.slice(0, MAX_SEEDS_QUERIED);

  // For every seed artist, in parallel: find similar artists (Last.fm) AND
  // fetch its own genre tags — the tags build your aggregate taste profile
  // (the "lake"), which every candidate then has to actually fit, rather
  // than surfacing anything a single seed's neighbor list happens to include.
  const perSeedResults = await Promise.all(
    topSeeds.map(async (seed) => {
      const seedArtistName = seed.representativeAlbum.artist.split(",")[0].trim();
      const [similar, tags] = await Promise.all([
        findSimilarArtists(seed.artistId, seedArtistName, knownArtistIds),
        getArtistTagProfile(seedArtistName),
      ]);
      return { seed, similar, tags };
    })
  );

  const genreProfile: TagProfile = new Map();
  for (const { seed, tags } of perSeedResults) {
    mergeTagProfile(genreProfile, tags, seed.weight);
  }

  const candidates = new Map<string, Candidate>();
  for (const { seed, similar } of perSeedResults) {
    for (const { artistId, name, match } of similar) {
      const contribution = seed.weight * match;
      const existing = candidates.get(artistId);
      if (existing) {
        existing.score += contribution;
        if (contribution > existing.bestContribution) {
          existing.bestContribution = contribution;
          existing.bestSeed = seed.representativeAlbum;
        }
      } else {
        candidates.set(artistId, {
          name,
          score: contribution,
          bestSeed: seed.representativeAlbum,
          bestContribution: contribution,
        });
      }
    }
  }

  const shortlist = [...candidates.entries()].sort(([, a], [, b]) => b.score - a.score).slice(0, GENRE_FIT_SHORTLIST);

  // Require candidates to actually share some genre ground with your
  // profile — this is the real guardrail against a lucky-but-unrelated
  // match from a single seed slipping through on raw similarity score alone.
  const withGenreFit = await Promise.all(
    shortlist.map(async ([artistId, info]) => {
      const tags = await getArtistTagProfile(info.name);
      const fit = scoreTagOverlap(tags, genreProfile);
      return { artistId, info, fit };
    })
  );

  const genreFiltered = withGenreFit.filter((c) => c.fit > 0);
  // If genre data was unavailable across the board (rather than genuinely no
  // overlap), fall back to the raw shortlist so a Last.fm hiccup doesn't
  // wipe out the whole page.
  const finalCandidates = genreFiltered.length > 0 ? genreFiltered : withGenreFit;

  const ranked = finalCandidates
    .map((c) => ({ ...c, combinedScore: c.info.score * (1 + c.fit) }))
    .sort((a, b) => b.combinedScore - a.combinedScore);

  const qualifiedPool = ranked.slice(0, QUALIFIED_POOL_SIZE);
  const topArtists = shuffle(qualifiedPool).slice(0, MAX_RESULT_ARTISTS);

  const albumsByArtist = await Promise.all(
    topArtists.map(async ({ artistId }) => {
      const albums = await getArtistAlbums(artistId).catch((err) => {
        console.error(`getArtistAlbums failed for ${artistId}`, err);
        return [] as SpotifyAlbumResult[];
      });
      return { artistId, albums: albums.filter((a) => !ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_PER_ARTIST) };
    })
  );

  const groups: RecommendationGroup[] = [];
  const groupIndexBySeedId = new Map<string, number>();

  for (const { artistId, info } of topArtists) {
    const albumsForArtist = albumsByArtist.find((a) => a.artistId === artistId)?.albums ?? [];
    if (albumsForArtist.length === 0) continue;

    const seedId = info.bestSeed.id;
    let index = groupIndexBySeedId.get(seedId);
    if (index === undefined) {
      index = groups.length;
      groupIndexBySeedId.set(seedId, index);
      groups.push({
        becauseOf: { title: info.bestSeed.title, artist: info.bestSeed.artist, rating: info.bestSeed.rating },
        albums: [],
      });
    }
    groups[index].albums.push(...albumsForArtist);
  }

  if (groups.length === 0) {
    // Nothing surfaced via Last.fm across your whole profile — fall back to
    // more from your single highest-weighted artist rather than an empty page.
    const topSeed = seedArtists[0];
    const fallbackAlbums = await getArtistAlbums(topSeed.artistId).catch((err) => {
      console.error(`getArtistAlbums fallback failed for ${topSeed.artistId}`, err);
      return [] as SpotifyAlbumResult[];
    });
    const filtered = fallbackAlbums.filter((a) => !ownedAlbumIds.has(a.spotifyId)).slice(0, MAX_ALBUMS_FALLBACK);
    if (filtered.length > 0) {
      groups.push({
        becauseOf: {
          title: topSeed.representativeAlbum.title,
          artist: topSeed.representativeAlbum.artist,
          rating: topSeed.representativeAlbum.rating,
        },
        albums: filtered,
      });
    }
  }

  return NextResponse.json({ groups });
}
