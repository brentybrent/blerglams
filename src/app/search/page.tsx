"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import type { SpotifyAlbumResult } from "@/lib/spotify";

type AddState = "idle" | "adding" | "added" | "error";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyAlbumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addState, setAddState] = useState<Record<string, AddState>>({});

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

  async function addAlbum(result: SpotifyAlbumResult) {
    setAddState((s) => ({ ...s, [result.spotifyId]: "adding" }));
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setAddState((s) => ({ ...s, [result.spotifyId]: "added" }));
      setTimeout(() => router.push(`/album/${data.album.id}`), 500);
    } catch {
      setAddState((s) => ({ ...s, [result.spotifyId]: "error" }));
    }
  }

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
          {results.map((r) => {
            const state = addState[r.spotifyId] ?? "idle";
            return (
              <div key={r.spotifyId} className="bg-panel border border-edge rounded-xl overflow-hidden">
                <div className="relative aspect-square bg-panel2">
                  {r.imageUrl ? (
                    <Image
                      src={r.imageUrl}
                      alt={r.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 220px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                      No artwork
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="font-medium leading-tight truncate">{r.title}</p>
                    <p className="text-sm text-muted truncate">{r.artist}</p>
                    {r.releaseDate && (
                      <p className="text-xs text-muted">{r.releaseDate.slice(0, 4)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => addAlbum(r)}
                    disabled={state === "adding" || state === "added"}
                    className="w-full text-sm font-medium rounded-lg py-2 bg-spotify text-black disabled:opacity-60"
                  >
                    {state === "adding" && "Adding…"}
                    {state === "added" && "Added ✓"}
                    {state === "error" && "Try again"}
                    {state === "idle" && "Add to library"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
