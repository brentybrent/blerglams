"use client";

import { useEffect, useState } from "react";

type Rating = { average: number; count: number };

export default function DiscogsRatingBadge({ artist, title }: { artist: string; title: string }) {
  const [rating, setRating] = useState<Rating | null | "loading">("loading");

  useEffect(() => {
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
  }, [artist, title]);

  if (rating === "loading" || rating === null) return null;

  return (
    <p className="text-xs text-muted">
      ★ {rating.average.toFixed(1)} <span className="opacity-70">({rating.count})</span> on Discogs
    </p>
  );
}
