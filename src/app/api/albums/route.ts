import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AlbumStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "added";
  const statusParam = req.nextUrl.searchParams.get("status");
  const status: AlbumStatus | undefined =
    statusParam === "saved" ? "SAVED" : statusParam === "library" ? "LIBRARY" : undefined;

  const orderBy =
    sort === "rating"
      ? [{ rating: "desc" as const }, { createdAt: "desc" as const }]
      : sort === "title"
        ? [{ title: "asc" as const }]
        : sort === "releaseDate"
          ? [{ releaseDate: { sort: "desc" as const, nulls: "last" as const } }]
          : [{ createdAt: "desc" as const }];

  const albums = await prisma.album.findMany({
    where: status ? { status } : undefined,
    orderBy,
    include: {
      listens: { orderBy: { listenedAt: "desc" } },
    },
  });

  return NextResponse.json({ albums });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.spotifyId !== "string" || typeof body.title !== "string") {
    return NextResponse.json({ error: "Missing required album fields." }, { status: 400 });
  }

  const status: AlbumStatus = body.status === "SAVED" ? "SAVED" : "LIBRARY";

  const existing = await prisma.album.findUnique({
    where: { spotifyId: body.spotifyId },
    include: { listens: { orderBy: { listenedAt: "desc" } } },
  });
  if (existing) {
    return NextResponse.json({ album: existing, alreadyExists: true });
  }

  const album = await prisma.album.create({
    data: {
      spotifyId: body.spotifyId,
      title: body.title,
      artist: body.artist ?? "Unknown artist",
      artistId: body.artistId ?? null,
      imageUrl: body.imageUrl ?? null,
      releaseDate: body.releaseDate ?? null,
      spotifyUrl: body.spotifyUrl ?? null,
      status,
    },
    include: { listens: true },
  });

  return NextResponse.json({ album }, { status: 201 });
}
