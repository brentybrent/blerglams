"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import RatingControl from "@/components/RatingControl";
import ListenLog from "@/components/ListenLog";
import type { Album } from "@/lib/types";

export default function AlbumDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/albums/${params.id}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setAlbum(data.album);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function updateRating(rating: number | null) {
    if (!album) return;
    setAlbum({ ...album, rating });
    await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
  }

  async function addListen(date: string, note: string) {
    if (!album) return;
    await fetch(`/api/albums/${album.id}/listens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listenedAt: date, note }),
    });
    refresh();
  }

  async function updateListen(id: string, date: string, note: string) {
    await fetch(`/api/listens/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listenedAt: date, note }),
    });
    refresh();
  }

  async function deleteListen(id: string) {
    await fetch(`/api/listens/${id}`, { method: "DELETE" });
    refresh();
  }

  async function deleteAlbum() {
    if (!album) return;
    if (!confirm(`Remove "${album.title}" from your library? This deletes its rating and listen log too.`)) {
      return;
    }
    await fetch(`/api/albums/${album.id}`, { method: "DELETE" });
    router.push("/");
  }

  if (notFound) {
    return (
      <div>
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-muted mb-4">Album not found.</p>
          <Link href="/" className="text-accent">
            Back to library
          </Link>
        </main>
      </div>
    );
  }

  if (!album) {
    return (
      <div>
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center text-muted">Loading…</main>
      </div>
    );
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="relative w-full sm:w-56 aspect-square rounded-xl overflow-hidden bg-panel2 shrink-0">
            {album.imageUrl ? (
              <Image src={album.imageUrl} alt={album.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                No artwork
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-semibold leading-tight">{album.title}</h1>
            <p className="text-muted">{album.artist}</p>
            {album.releaseDate && (
              <p className="text-sm text-muted">Released {album.releaseDate}</p>
            )}
            {album.spotifyUrl && (
              <a
                href={album.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-accent hover:underline"
              >
                Open in Spotify ↗
              </a>
            )}
            <div>
              <button onClick={deleteAlbum} className="text-sm text-red-400 hover:text-red-300 mt-4">
                Remove from library
              </button>
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Your rating</h2>
          <RatingControl rating={album.rating} onChange={updateRating} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Listen log</h2>
          <ListenLog
            listens={album.listens}
            onAdd={addListen}
            onUpdate={updateListen}
            onDelete={deleteListen}
          />
        </section>
      </main>
    </div>
  );
}
