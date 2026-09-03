import Image from "next/image";
import type { SpotifyAlbumResult } from "@/lib/spotify";
import type { ResultAddState } from "@/hooks/useCatalogActions";
import DiscogsRatingBadge from "@/components/DiscogsRatingBadge";

export default function SpotifyResultCard({
  result,
  state,
  onAddToLibrary,
  onSaveForLater,
  showRating = false,
  precomputedRating,
}: {
  result: SpotifyAlbumResult;
  state: ResultAddState;
  onAddToLibrary: () => void;
  onSaveForLater: () => void;
  /** Lazily fetches and shows a Discogs rating for this album. */
  showRating?: boolean;
  /** Already-known rating (e.g. resolved server-side) — skips the fetch entirely. */
  precomputedRating?: { average: number; count: number } | null;
}) {
  const busy = state === "addingLibrary" || state === "addingSaved";
  const done = state === "addedLibrary" || state === "addedSaved";

  return (
    <div className="bg-panel border border-edge rounded-xl overflow-hidden">
      <div className="relative aspect-square bg-panel2">
        {result.imageUrl ? (
          <Image
            src={result.imageUrl}
            alt={result.title}
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
          <p className="font-medium leading-tight truncate">{result.title}</p>
          <p className="text-sm text-muted truncate">{result.artist}</p>
          {result.releaseDate && <p className="text-xs text-muted">{result.releaseDate.slice(0, 4)}</p>}
          {(showRating || precomputedRating !== undefined) && (
            <DiscogsRatingBadge artist={result.artist} title={result.title} precomputed={precomputedRating} />
          )}
        </div>

        {done ? (
          <p className="text-sm font-medium text-accent text-center py-2">
            {state === "addedLibrary" ? "Added to library ✓" : "Saved for later ✓"}
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onAddToLibrary}
              disabled={busy}
              className="flex-1 text-sm font-medium rounded-lg py-2 bg-accent text-panel disabled:opacity-60"
            >
              {state === "addingLibrary" ? "Adding…" : "Add"}
            </button>
            <button
              onClick={onSaveForLater}
              disabled={busy}
              className="flex-1 text-sm font-medium rounded-lg py-2 bg-mint text-ink disabled:opacity-60"
            >
              {state === "addingSaved" ? "Saving…" : "Save for later"}
            </button>
          </div>
        )}

        {state === "error" && <p className="text-xs text-red-400">Something went wrong — try again.</p>}
      </div>
    </div>
  );
}
