export interface PlaylistCoverDescriptor {
  imageUrl?: string;
  coverPath?: string;
  source?: string;
  userManaged?: boolean;
}

export interface PlaylistCoverTrack {
  coverUrl?: string;
}

export function mediaPathToUrl(path: string | undefined) {
  if (!path) {
    return undefined;
  }
  if (/^(?:data:|blob:|file:|https?:)/i.test(path)) {
    return path;
  }
  return `file:///${path.replace(/\\/g, "/")}`;
}

export function resolvePlaylistCover(
  playlist: PlaylistCoverDescriptor,
  orderedTracks: PlaylistCoverTrack[],
  customCoverPath?: string,
  resolveTrackCover: (url: string | undefined) => string | undefined = (url) => url
) {
  const customCover = mediaPathToUrl(customCoverPath || playlist.coverPath);
  if (customCover) {
    return customCover;
  }

  const isLocallyManaged = playlist.userManaged || playlist.source === "local-user";
  if (!isLocallyManaged && playlist.imageUrl) {
    return playlist.imageUrl;
  }

  return resolveTrackCover(orderedTracks[0]?.coverUrl);
}
