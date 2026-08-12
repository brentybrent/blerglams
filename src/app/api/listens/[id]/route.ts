import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: { listenedAt?: Date; note?: string | null } = {};
  if (body.listenedAt) {
    const listenedAt = new Date(body.listenedAt);
    if (Number.isNaN(listenedAt.getTime())) {
      return NextResponse.json({ error: "Invalid listenedAt date." }, { status: 400 });
    }
    data.listenedAt = listenedAt;
  }
  if (body.note !== undefined) {
    data.note = body.note?.trim() || null;
  }

  const listen = await prisma.listen.update({ where: { id }, data });
  return NextResponse.json({ listen });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  await prisma.listen.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
