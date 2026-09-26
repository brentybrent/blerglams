export type LastfmSimilarArtist = {
  name: string;
  match: number;
};

type LastfmSimilarResponse = {
  similarartists?: {
    artist?: Array<{ name: string; match: string }>;
  };
  error?: number;
  message?: string;
};

export async function getSimilarArtists(artistName: string, limit = 10): Promise<LastfmSimilarArtist[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY is not configured.");
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.getsimilar");
  url.searchParams.set("artist", artistName);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Last.fm request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as LastfmSimilarResponse;
  if (data.error) {
    throw new Error(`Last.fm error ${data.error}: ${data.message ?? ""}`);
  }

  return (data.similarartists?.artist ?? []).map((a) => ({
    name: a.name,
    match: Number(a.match) || 0,
  }));
}

export type LastfmTag = {
  tag: string;
  /** Normalized 0-1 — Last.fm's own "count" field is a per-artist relative
   *  strength score (0-100), not an absolute/global frequency. */
  weight: number;
};

type LastfmTopTagsResponse = {
  toptags?: {
    tag?: Array<{ name: string; count: number | string }>;
  };
  error?: number;
  message?: string;
};

export async function getTopTags(artistName: string, limit = 6): Promise<LastfmTag[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY is not configured.");
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.gettoptags");
  url.searchParams.set("artist", artistName);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Last.fm request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as LastfmTopTagsResponse;
  if (data.error) {
    throw new Error(`Last.fm error ${data.error}: ${data.message ?? ""}`);
  }

  return (data.toptags?.tag ?? []).slice(0, limit).map((t) => ({
    tag: t.name.toLowerCase(),
    weight: (Number(t.count) || 0) / 100,
  }));
}
