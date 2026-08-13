"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import type { Album } from "@/lib/types";

export default function SavedPage() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/albums?status=saved");
    const data = await res.json();
    setAlbums(data.albums ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function markAsListened(id: string) {
    setBusyId(id);
    await fetch(`/api/albums/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIBRARY" }),
    });
    await refresh();
    setBusyId(null);
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/albums/${id}`, { method: "DELETE" });
    await refresh();
    setBusyId(null);
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-semibold">Saved for later</h1>

        {albums === null && <p className="text-muted">Loading…</p>}

        {albums !== null && albums.length === 0 && (
          <div className="text-center py-20 border border-dashed border-edge rounded-xl">
            <p className="text-muted mb-4">Nothing saved yet.</p>
            <Link href="/search" className="inline-block bg-spotify text-black font-medium px-4 py-2 rounded-lg">
              Find albums to save
            </Link>
          </div>
        )}

        {albums && albums.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((album) => (
              <div key={album.id} className="bg-panel border border-edge rounded-xl overflow-hidden">
                <div className="relative aspect-square bg-panel2">
                  {album.imageUrl ? (
                    <Image
                      src={album.imageUrl}
                      alt={album.title}
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
                    <p className="font-medium leading-tight truncate">{album.title}</p>
                    <p className="text-sm text-muted truncate">{album.artist}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markAsListened(album.id)}
                      disabled={busyId === album.id}
                      className="flex-1 text-sm font-medium rounded-lg py-2 bg-spotify text-black disabled:opacity-60"
                    >
                      Mark as listened
                    </button>
                    <button
                      onClick={() => remove(album.id)}
                      disabled={busyId === album.id}
                      className="text-sm text-red-400 hover:text-red-300 px-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
