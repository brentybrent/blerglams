export type Listen = {
  id: string;
  albumId: string;
  listenedAt: string;
  note: string | null;
  createdAt: string;
};

export type Album = {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  releaseDate: string | null;
  spotifyUrl: string | null;
  rating: number | null;
  createdAt: string;
  listens: Listen[];
};
