"use client";

export default function RatingControl({
  rating,
  onChange,
}: {
  rating: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(rating === n ? null : n)}
            className={`aspect-square rounded-md text-sm font-semibold transition-colors ${
              rating !== null && n <= rating
                ? "bg-accent text-panel"
                : "bg-panel2 text-muted hover:text-ink"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted mt-2">
        {rating !== null ? `Rated ${rating}/10 — tap the same number to clear.` : "Tap a number to rate this album."}
      </p>
    </div>
  );
}
