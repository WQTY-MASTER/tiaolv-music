export const AGGREGATE_PLAYLIST_STORAGE_KEY = "listen-music-aggregate-playlists";

export interface AggregateTrackSource {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  source: string;
  sourceLabel: string;
  coverUrl?: string;
  audioUrl?: string;
  filePath?: string;
}

export interface AggregateTrackGroup {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl?: string;
  sources: AggregateTrackSource[];
}

export interface AggregatePlaylist {
  id: string;
  name: string;
  identifier: string;
  tracks: AggregateTrackSource[];
  createdAt: string;
  coverUrl?: string;
}

function normalizedText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*([/&,，、·])\s*/g, "$1");
}

export function normalizeTrackIdentity(track: Pick<AggregateTrackSource, "title" | "artist">) {
  return `${normalizedText(track.title)}::${normalizedText(track.artist)}`;
}

export function mergeAggregateTracks(tracks: AggregateTrackSource[]): AggregateTrackGroup[] {
  const groups = new Map<string, AggregateTrackGroup>();

  tracks.forEach((track) => {
    const identity = normalizeTrackIdentity(track);
    const existing = groups.get(identity);
    if (existing) {
      if (!existing.sources.some((source) => source.id === track.id && source.source === track.source)) {
        existing.sources.push({ ...track });
      }
      if (!existing.coverUrl && track.coverUrl) {
        existing.coverUrl = track.coverUrl;
      }
      return;
    }

    groups.set(identity, {
      id: identity,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      coverUrl: track.coverUrl,
      sources: [{ ...track }]
    });
  });

  return Array.from(groups.values());
}

function isAggregateTrackSource(value: unknown): value is AggregateTrackSource {
  if (!value || typeof value !== "object") {
    return false;
  }
  const track = value as Partial<AggregateTrackSource>;
  return Boolean(track.id && track.title && track.artist && track.source && track.sourceLabel);
}

function isAggregatePlaylist(value: unknown): value is AggregatePlaylist {
  if (!value || typeof value !== "object") {
    return false;
  }
  const playlist = value as Partial<AggregatePlaylist>;
  return Boolean(
    playlist.id
    && playlist.name
    && playlist.identifier
    && Array.isArray(playlist.tracks)
    && playlist.tracks.every(isAggregateTrackSource)
  );
}

export function readAggregatePlaylists(storage: Pick<Storage, "getItem"> = window.localStorage): AggregatePlaylist[] {
  try {
    const raw = storage.getItem(AGGREGATE_PLAYLIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAggregatePlaylist) : [];
  } catch {
    return [];
  }
}

export function writeAggregatePlaylists(
  playlists: AggregatePlaylist[],
  storage: Pick<Storage, "setItem"> = window.localStorage
) {
  storage.setItem(AGGREGATE_PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
}

export function createAggregatePlaylist(
  name: string,
  playlists: AggregatePlaylist[],
  now = Date.now()
): AggregatePlaylist {
  const usedIdentifiers = new Set(playlists.map((playlist) => playlist.identifier));
  let sequence = 1;
  while (usedIdentifiers.has(`agg${sequence}`)) {
    sequence += 1;
  }

  return {
    id: `aggregate-${now}-${sequence}`,
    name: name.trim(),
    identifier: `agg${sequence}`,
    tracks: [],
    createdAt: new Date(now).toISOString()
  };
}

export function addTrackToAggregatePlaylist(
  playlist: AggregatePlaylist,
  track: AggregateTrackSource
): { playlist: AggregatePlaylist; added: boolean } {
  const exists = playlist.tracks.some((source) => (
    source.id === track.id && source.source === track.source
  ));
  if (exists) {
    return { playlist, added: false };
  }

  const joinsExistingGroup = playlist.tracks.some((source) => (
    normalizeTrackIdentity(source) === normalizeTrackIdentity(track)
  ));

  return {
    playlist: {
      ...playlist,
      tracks: joinsExistingGroup
        ? [...playlist.tracks, { ...track }]
        : [{ ...track }, ...playlist.tracks]
    },
    added: true
  };
}

export function reorderAggregateTrackGroups(
  playlist: AggregatePlaylist,
  orderedGroupIds: string[]
): AggregatePlaylist {
  const groups = mergeAggregateTracks(playlist.tracks);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const orderedGroups = orderedGroupIds
    .map((id) => groupsById.get(id))
    .filter((group): group is AggregateTrackGroup => Boolean(group));
  const orderedIds = new Set(orderedGroups.map((group) => group.id));
  groups.forEach((group) => {
    if (!orderedIds.has(group.id)) {
      orderedGroups.push(group);
    }
  });

  return {
    ...playlist,
    tracks: orderedGroups.flatMap((group) => group.sources.map((source) => ({ ...source })))
  };
}

export function removeAggregateTrackSource(
  playlist: AggregatePlaylist,
  groupId: string,
  source: string,
  trackId: string
): AggregatePlaylist {
  return {
    ...playlist,
    tracks: playlist.tracks.filter((track) => !(
      normalizeTrackIdentity(track) === groupId
      && track.source === source
      && track.id === trackId
    ))
  };
}

export function removeAggregateTrackGroup(
  playlist: AggregatePlaylist,
  groupId: string
): AggregatePlaylist {
  return {
    ...playlist,
    tracks: playlist.tracks.filter((track) => normalizeTrackIdentity(track) !== groupId)
  };
}
