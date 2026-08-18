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
  const [error, setError] = useState<string | null>(null);
  const { states, addToLibrary, saveForLater } = useCatalogActions();

  useEffect(() => {
    fetch("/api/recommendations")
      .then((res) => res.json())
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => setError("Couldn't load recommendations."));
  }, []);

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">
        <div>
          <h1 className="text-xl font-semibold">Recommended for you</h1>
          <p className="text-sm text-muted mt-1">
            Artists similar to the ones behind albums you've rated 7 or higher.
          </p>
        </div>

        {groups === null && !error && <p className="text-muted">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {groups !== null && groups.length === 0 && !error && (
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
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
