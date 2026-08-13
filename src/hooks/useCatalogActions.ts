"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SpotifyAlbumResult } from "@/lib/spotify";
import type { AlbumStatus } from "@/lib/types";

export type ResultAddState =
  | "idle"
  | "addingLibrary"
  | "addingSaved"
  | "addedLibrary"
  | "addedSaved"
  | "error";

export function useCatalogActions() {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, ResultAddState>>({});

  async function addAlbum(result: SpotifyAlbumResult, status: AlbumStatus) {
    setStates((s) => ({ ...s, [result.spotifyId]: status === "LIBRARY" ? "addingLibrary" : "addingSaved" }));
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();

      setStates((s) => ({ ...s, [result.spotifyId]: status === "LIBRARY" ? "addedLibrary" : "addedSaved" }));
      if (status === "LIBRARY") {
        setTimeout(() => router.push(`/album/${data.album.id}`), 500);
      }
    } catch {
      setStates((s) => ({ ...s, [result.spotifyId]: "error" }));
    }
  }

  return {
    states,
    addToLibrary: (result: SpotifyAlbumResult) => addAlbum(result, "LIBRARY"),
    saveForLater: (result: SpotifyAlbumResult) => addAlbum(result, "SAVED"),
  };
}
