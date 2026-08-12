"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import AlbumCard from "@/components/AlbumCard";
import type { Album } from "@/lib/types";

type Sort = "added" | "rating" | "title";

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [sort, setSort] = useState<Sort>("added");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/albums?sort=${sort}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAlbums(data.albums ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  const filtered = useMemo(() => {
    if (!albums) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [albums, filter]);

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold">Your library</h1>
          <div className="flex gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by title or artist"
              className="rounded-lg bg-panel border border-edge px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-spotify"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg bg-panel border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotify"
            >
              <option value="added">Recently added</option>
              <option value="rating">Highest rated</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>

        {filtered === null && <p className="text-muted">Loading…</p>}

        {filtered !== null && filtered.length === 0 && (
          <div className="text-center py-20 border border-dashed border-edge rounded-xl">
            <p className="text-muted mb-4">
              {albums && albums.length > 0
                ? "No albums match that filter."
                : "No albums yet. Start by adding one from Spotify."}
            </p>
            {albums && albums.length === 0 && (
              <Link
                href="/search"
                className="inline-block bg-spotify text-black font-medium px-4 py-2 rounded-lg"
              >
                Add your first album
              </Link>
            )}
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
