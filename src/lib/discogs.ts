export type DiscogsRating = { average: number; count: number };

async function discogsFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) {
    throw new Error("DISCOGS_TOKEN is not configured.");
  }

  const url = new URL(`https://api.discogs.com${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("token", token);

  const res = await fetch(url, {
    headers: {
      // Discogs requires a descriptive User-Agent identifying the app.
      "User-Agent": "brentco-album-tracker/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discogs request failed: ${res.status} ${body}`);
  }

  return res.json();
}

type DiscogsSearchResponse = {
  results?: Array<{ id: number }>;
};

type DiscogsReleaseResponse = {
  community?: {
    rating?: {
      average?: number;
      count?: number;
    };
  };
};

export async function getAlbumRating(artist: string, title: string): Promise<DiscogsRating | null> {
  const search = (await discogsFetch("/database/search", {
    q: `${artist} ${title}`,
    type: "release",
  })) as DiscogsSearchResponse;

  const topResultId = search.results?.[0]?.id;
  if (!topResultId) return null;

  const release = (await discogsFetch(`/releases/${topResultId}`)) as DiscogsReleaseResponse;
  const rating = release.community?.rating;
  if (!rating?.count || !rating.average) return null;

  return { average: rating.average, count: rating.count };
}
