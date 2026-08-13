export type Listen = {
  id: string;
  albumId: string;
  listenedAt: string;
  note: string | null;
  createdAt: string;
};

export type AlbumStatus = "LIBRARY" | "SAVED";

export type Album = {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  artistId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  spotifyUrl: string | null;
  rating: number | null;
  status: AlbumStatus;
  createdAt: string;
  listens: Listen[];
};
