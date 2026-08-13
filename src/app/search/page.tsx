"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import SpotifyResultCard from "@/components/SpotifyResultCard";
import { useCatalogActions } from "@/hooks/useCatalogActions";
import type { SpotifyAlbumResult } from "@/lib/spotify";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyAlbumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { states, addToLibrary, saveForLater } = useCatalogActions();

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Search failed.");
          setResults([]);
        } else {
          setResults(data.results ?? []);
        }
      } catch {
        setError("Search failed.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-semibold">Add an album</h1>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Spotify's catalog by album or artist"
          className="w-full rounded-lg bg-panel border border-edge px-4 py-3 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-spotify"
        />

        {loading && <p className="text-muted text-sm">Searching…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map((result) => (
            <SpotifyResultCard
              key={result.spotifyId}
              result={result}
              state={states[result.spotifyId] ?? "idle"}
              onAddToLibrary={() => addToLibrary(result)}
              onSaveForLater={() => saveForLater(result)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
