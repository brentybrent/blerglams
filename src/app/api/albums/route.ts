import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "added";

  const orderBy =
    sort === "rating"
      ? [{ rating: "desc" as const }, { createdAt: "desc" as const }]
      : sort === "title"
        ? [{ title: "asc" as const }]
        : [{ createdAt: "desc" as const }];

  const albums = await prisma.album.findMany({
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
      imageUrl: body.imageUrl ?? null,
      releaseDate: body.releaseDate ?? null,
      spotifyUrl: body.spotifyUrl ?? null,
    },
    include: { listens: true },
  });

  return NextResponse.json({ album }, { status: 201 });
}
