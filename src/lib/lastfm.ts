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
