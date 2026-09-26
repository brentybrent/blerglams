"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import SpotifyResultCard from "@/components/SpotifyResultCard";
import { useCatalogActions } from "@/hooks/useCatalogActions";
import type { SpotifyAlbumResult } from "@/lib/spotify";

type Group = {
  becauseOf: { title: string; artist: string; rating: number };
  albums: SpotifyAlbumResult[];
};

export default function RecommendationsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { states, addToLibrary, saveForLater } = useCatalogActions();

  useEffect(() => {
    setGroups(null);
    setGroupsError(null);
    fetch("/api/recommendations")
      .then((res) => res.json())
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => setGroupsError("Couldn't load recommendations."));
  }, [refreshKey]);

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Recommended for you</h1>
            <p className="text-sm text-muted mt-1">
              Based on a weighted profile of everything you've rated 6 or higher — not just a few picks.
              Reshuffles each visit — hit shuffle for a new set any time.
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="shrink-0 text-sm font-medium rounded-lg px-4 py-2 bg-panel2 border border-edge text-ink hover:border-accent transition-colors"
          >
            🔀 Shuffle
          </button>
        </div>

        {groups === null && !groupsError && <p className="text-muted">Loading…</p>}
        {groupsError && <p className="text-red-400 text-sm">{groupsError}</p>}

        {groups !== null && groups.length === 0 && !groupsError && (
          <div className="text-center py-20 border border-dashed border-edge rounded-xl">
            <p className="text-muted">
              Rate a few albums 6 or higher and check back — recommendations are built from a weighted
              profile of your library.
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
