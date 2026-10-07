import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const LEGACY_AGGREGATE_PLAYLIST_STORAGE_KEY = "listen-music-aggregate-playlists";
const LEGACY_USER_DATA_DIRECTORY = "tingting-music-electron";
const MAX_LEGACY_STORAGE_FILE_SIZE = 64 * 1024 * 1024;

export function extractLegacyAggregatePlaylistVersions(contents: Buffer): unknown[][] {
  const key = Buffer.from(LEGACY_AGGREGATE_PLAYLIST_STORAGE_KEY, "utf8");
  const versions: unknown[][] = [];
  let offset = 0;

  while ((offset = contents.indexOf(key, offset)) >= 0) {
    const valueStart = findUtf16JsonArrayStart(contents, offset + key.length);
    if (valueStart >= 0) {
      const remainingLength = contents.length - valueStart;
      const decoded = contents
        .subarray(valueStart, valueStart + remainingLength - (remainingLength % 2))
        .toString("utf16le");
      const json = extractBalancedJsonArray(decoded);
      if (json) {
        try {
          const parsed = JSON.parse(json) as unknown;
          if (Array.isArray(parsed)) versions.push(parsed);
        } catch {
          // A later LevelDB record may still contain a complete value.
        }
      }
    }
    offset += key.length;
  }

  return versions;
}

export function readLegacyAggregatePlaylists(appDataPath: string): unknown[] {
  const levelDbDirectory = path.join(
    appDataPath,
    LEGACY_USER_DATA_DIRECTORY,
    "Local Storage",
    "leveldb"
  );
  if (!existsSync(levelDbDirectory)) return [];

  const files = readdirSync(levelDbDirectory)
    .filter((name) => name.endsWith(".log") || name.endsWith(".ldb"))
    .map((name) => {
      const filePath = path.join(levelDbDirectory, name);
      return { filePath, modifiedAt: statSync(filePath).mtimeMs };
    })
    .sort((left, right) => left.modifiedAt - right.modifiedAt || left.filePath.localeCompare(right.filePath));

  let latest: unknown[] = [];
  for (const file of files) {
    try {
      const stats = statSync(file.filePath);
      if (stats.size <= 0 || stats.size > MAX_LEGACY_STORAGE_FILE_SIZE) continue;
      const versions = extractLegacyAggregatePlaylistVersions(readFileSync(file.filePath));
      if (versions.length > 0) latest = versions[versions.length - 1];
    } catch {
      // Ignore unreadable or compacted LevelDB files and continue scanning.
    }
  }
  return latest;
}

function findUtf16JsonArrayStart(contents: Buffer, start: number) {
  const searchEnd = Math.min(contents.length - 1, start + 32);
  for (let index = start; index < searchEnd; index += 1) {
    if (contents[index] === 0x5b && contents[index + 1] === 0x00) return index;
  }
  return -1;
}

function extractBalancedJsonArray(value: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "[" || character === "{") {
      depth += 1;
    } else if (character === "]" || character === "}") {
      depth -= 1;
      if (depth === 0) return value.slice(0, index + 1);
    }
  }
  return "";
}
