export interface PlaylistCoverReferences {
  complete: true;
  urls: string[];
}

export interface PlaylistCoverStorageStatistics {
  directory: string;
  entries: number;
  bytes: number;
  reclaimableEntries: number;
  reclaimableBytes: number;
}

export interface PlaylistCoverCleanupResult extends PlaylistCoverStorageStatistics {
  removedEntries: number;
  removedBytes: number;
}
