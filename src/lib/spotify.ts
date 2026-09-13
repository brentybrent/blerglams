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
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify auth failed: ${res.status} ${body}`);
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
  artistId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  spotifyUrl: string | null;
};

type SpotifyRawAlbum = {
  id: string;
  name: string;
  release_date?: string;
  images?: Array<{ url: string }>;
  artists?: Array<{ id: string; name: string }>;
  external_urls?: { spotify?: string };
};

function mapSpotifyAlbum(item: SpotifyRawAlbum): SpotifyAlbumResult {
  return {
    spotifyId: item.id,
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(", ") ?? "Unknown artist",
    artistId: item.artists?.[0]?.id ?? null,
    imageUrl: item.images?.[0]?.url ?? null,
    releaseDate: item.release_date ?? null,
    spotifyUrl: item.external_urls?.spotify ?? null,
  };
}

type SpotifySearchResponse = {
  albums?: { items: SpotifyRawAlbum[] };
};

export async function searchAlbums(query: string): Promise<SpotifyAlbumResult[]> {
  const token = await getAccessToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "album");
  url.searchParams.set("market", "US");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify search failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as SpotifySearchResponse;
  return (data.albums?.items ?? []).map(mapSpotifyAlbum);
}

type SpotifyArtistSearchResponse = {
  artists?: { items: Array<{ id: string; name: string }> };
};

export async function searchArtistId(artistName: string): Promise<string | null> {
  const token = await getAccessToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", artistName);
  url.searchParams.set("type", "artist");
  url.searchParams.set("market", "US");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as SpotifyArtistSearchResponse;
  return data.artists?.items?.[0]?.id ?? null;
}

type SpotifyArtistAlbumsResponse = {
  items?: SpotifyRawAlbum[];
};

export async function getArtistAlbums(artistId: string): Promise<SpotifyAlbumResult[]> {
  const token = await getAccessToken();
  const url = new URL(`https://api.spotify.com/v1/artists/${artistId}/albums`);
  url.searchParams.set("include_groups", "album");
  url.searchParams.set("market", "US");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify artist albums failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as SpotifyArtistAlbumsResponse;
  const mapped = (data.items ?? []).map(mapSpotifyAlbum);

  // Artists often have several duplicate editions (deluxe, remaster, anniversary) of
  // the same album on Spotify — keep only the first one we see per title.
  const byTitle = new Map<string, SpotifyAlbumResult>();
  for (const album of mapped) {
    const key = album.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, album);
  }
  return [...byTitle.values()];
}
