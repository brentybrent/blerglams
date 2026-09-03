"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import SpotifyResultCard from "@/components/SpotifyResultCard";
import { useCatalogActions } from "@/hooks/useCatalogActions";
import type { SpotifyAlbumResult } from "@/lib/spotify";
import type { DiscogsRating } from "@/lib/discogs";

type Group = {
  becauseOf: { title: string; artist: string; rating: number };
  albums: SpotifyAlbumResult[];
};

type BestOfYearAlbum = SpotifyAlbumResult & { discogsRating: DiscogsRating };

export default function RecommendationsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [bestOfYear, setBestOfYear] = useState<BestOfYearAlbum[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { states, addToLibrary, saveForLater } = useCatalogActions();

  useEffect(() => {
    setGroups(null);
    setGroupsError(null);
    fetch("/api/recommendations")
      .then((res) => res.json())
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => setGroupsError("Couldn't load recommendations."));

    // Independent fetch — this one does its own round of Discogs lookups on
    // top of Spotify/Last.fm, so if it's slow it never holds up the groups above.
    setBestOfYear(null);
    fetch("/api/recommendations/best-of-year")
      .then((res) => res.json())
      .then((data) => setBestOfYear(data.albums ?? []))
      .catch(() => setBestOfYear([]));
  }, [refreshKey]);

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Recommended for you</h1>
            <p className="text-sm text-muted mt-1">
              Artists similar to the ones behind albums you've rated 7 or higher. Reshuffles each visit —
              hit shuffle for a new set any time.
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="shrink-0 text-sm font-medium rounded-lg px-4 py-2 bg-panel2 border border-edge text-ink hover:border-accent transition-colors"
          >
            🔀 Shuffle
          </button>
        </div>

        {bestOfYear && bestOfYear.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm text-muted">
              <span className="text-ink font-medium">Best rated from the last year</span> — recent releases
              from artists you might like, ranked by Discogs community rating
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {bestOfYear.map((album) => (
                <SpotifyResultCard
                  key={album.spotifyId}
                  result={album}
                  state={states[album.spotifyId] ?? "idle"}
                  onAddToLibrary={() => addToLibrary(album)}
                  onSaveForLater={() => saveForLater(album)}
                  precomputedRating={album.discogsRating}
                />
              ))}
            </div>
          </section>
        )}

        {groups === null && !groupsError && <p className="text-muted">Loading…</p>}
        {groupsError && <p className="text-red-400 text-sm">{groupsError}</p>}

        {groups !== null && groups.length === 0 && !groupsError && (!bestOfYear || bestOfYear.length === 0) && (
          <div className="text-center py-20 border border-dashed border-edge rounded-xl">
            <p className="text-muted">
              Rate a few albums 7 or higher and check back — recommendations are pulled from artists
              similar to the ones behind them.
            </p>
          </div>
        )}

        {groups?.map((group) => (
          <section key={`${group.becauseOf.title}-${group.becauseOf.artist}`} className="space-y-3">
            <h2 className="text-sm text-muted">
              Because you rated <span className="text-ink font-medium">{group.becauseOf.title}</span> by{" "}
              {group.becauseOf.artist} {group.becauseOf.rating}/10
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {group.albums.map((album) => (
                <SpotifyResultCard
                  key={album.spotifyId}
                  result={album}
                  state={states[album.spotifyId] ?? "idle"}
                  onAddToLibrary={() => addToLibrary(album)}
                  onSaveForLater={() => saveForLater(album)}
                  showRating
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
