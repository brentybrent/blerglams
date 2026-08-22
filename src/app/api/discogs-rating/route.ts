import { NextRequest, NextResponse } from "next/server";
import { getAlbumRating } from "@/lib/discogs";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const title = req.nextUrl.searchParams.get("title");
  if (!artist || !title) {
    return NextResponse.json({ rating: null });
  }

  try {
    const rating = await getAlbumRating(artist, title);
    return NextResponse.json({ rating });
  } catch (err) {
    // Rating is a nice-to-have, not a critical part of the page — log for
    // debugging but never surface this as an error to the client.
    console.error(`getAlbumRating failed for "${artist} - ${title}"`, err);
    return NextResponse.json({ rating: null });
  }
}
