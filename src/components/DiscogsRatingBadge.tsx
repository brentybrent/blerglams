"use client";

import { useEffect, useState } from "react";

type Rating = { average: number; count: number };

export default function DiscogsRatingBadge({
  artist,
  title,
  precomputed,
}: {
  artist: string;
  title: string;
  /** When provided, skips the client-side fetch and renders this value directly
   *  (or nothing, if null) — used when the server already resolved the rating. */
  precomputed?: Rating | null;
}) {
  const [rating, setRating] = useState<Rating | null | "loading">(precomputed !== undefined ? precomputed : "loading");

  useEffect(() => {
    if (precomputed !== undefined) return;

    let cancelled = false;
    setRating("loading");

    fetch(`/api/discogs-rating?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRating(data.rating ?? null);
      })
      .catch(() => {
        if (!cancelled) setRating(null);
      });

    return () => {
      cancelled = true;
    };
  }, [artist, title, precomputed]);

  if (rating === "loading" || rating === null) return null;

  return (
    <p className="text-xs text-muted">
      ★ {rating.average.toFixed(1)} <span className="opacity-70">({rating.count})</span> on Discogs
    </p>
  );
}
