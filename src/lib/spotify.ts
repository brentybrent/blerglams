let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not configured.");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export type SpotifyAlbumResult = {
  spotifyId: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  releaseDate: string | null;
  spotifyUrl: string | null;
};

type SpotifySearchResponse = {
  albums?: {
    items: Array<{
      id: string;
      name: string;
      release_date?: string;
      images?: Array<{ url: string }>;
      artists?: Array<{ name: string }>;
      external_urls?: { spotify?: string };
    }>;
  };
};

export async function searchAlbums(query: string): Promise<SpotifyAlbumResult[]> {
  const token = await getAccessToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "album");
  url.searchParams.set("limit", "20");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = (await res.json()) as SpotifySearchResponse;
  const items = data.albums?.items ?? [];

  return items.map((item) => ({
    spotifyId: item.id,
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(", ") ?? "Unknown artist",
    imageUrl: item.images?.[0]?.url ?? null,
    releaseDate: item.release_date ?? null,
    spotifyUrl: item.external_urls?.spotify ?? null,
  }));
}
