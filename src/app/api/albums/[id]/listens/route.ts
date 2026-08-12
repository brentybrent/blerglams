import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.listenedAt) {
    return NextResponse.json({ error: "listenedAt is required." }, { status: 400 });
  }

  const listenedAt = new Date(body.listenedAt);
  if (Number.isNaN(listenedAt.getTime())) {
    return NextResponse.json({ error: "Invalid listenedAt date." }, { status: 400 });
  }

  const listen = await prisma.listen.create({
    data: {
      albumId: id,
      listenedAt,
      note: body.note?.trim() || null,
    },
  });

  return NextResponse.json({ listen }, { status: 201 });
}
