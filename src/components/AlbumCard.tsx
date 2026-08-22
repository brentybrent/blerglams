import Image from "next/image";
import Link from "next/link";
import type { Album } from "@/lib/types";

export default function AlbumCard({ album }: { album: Album }) {
  const lastListen = album.listens[0];

  return (
    <Link
      href={`/album/${album.id}`}
      className="group block bg-panel border border-edge rounded-xl overflow-hidden hover:border-accent transition-colors"
    >
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
        {album.rating !== null && (
          <div className="absolute top-2 right-2 bg-black/80 text-accent text-xs font-semibold rounded-full px-2 py-1">
            {album.rating}/10
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium leading-tight truncate">{album.title}</p>
        <p className="text-sm text-muted truncate">{album.artist}</p>
        {lastListen && (
          <p className="text-xs text-muted mt-1">
            Last listened {new Date(lastListen.listenedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </Link>
  );
}
