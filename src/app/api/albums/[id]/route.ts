import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const album = await prisma.album.findUnique({
    where: { id },
    include: { listens: { orderBy: { listenedAt: "desc" } } },
  });
  if (!album) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ album });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.rating !== undefined && body.rating !== null) {
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return NextResponse.json({ error: "Rating must be an integer 1-10." }, { status: 400 });
    }
  }

  const album = await prisma.album.update({
    where: { id },
    data: {
      rating: body.rating === null ? null : body.rating !== undefined ? Number(body.rating) : undefined,
    },
    include: { listens: { orderBy: { listenedAt: "desc" } } },
  });

  return NextResponse.json({ album });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  await prisma.album.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
