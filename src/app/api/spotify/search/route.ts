import { NextRequest, NextResponse } from "next/server";
import { searchAlbums } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchAlbums(q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Spotify search failed. Check SPOTIFY_CLIENT_ID/SECRET." },
      { status: 502 }
    );
  }
}
