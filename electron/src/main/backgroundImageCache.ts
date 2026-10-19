import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import type { PlaylistCoverStorageStatistics, PlaylistCoverCleanupResult } from "../shared/playlistCoverStorage";

const CACHE_FILE = /^[a-f0-9]{64}\.(png|jpg|webp)$/;
const IMPORT_GRACE_MS = 24 * 60 * 60 * 1000;

export class BackgroundImageCache {
  private readonly directory: string;
  private readonly scheme: string;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(directory: string, scheme = "tiaolv-background") {
    this.directory = path.resolve(directory);
    this.scheme = scheme;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }

  private async ensureDirectory() {
    // Inspect every ancestor before creating a child, including Windows junctions.
    const root = path.parse(this.directory).root;
    const directories = [root];
    for (const segment of this.directory.slice(root.length).split(path.sep).filter(Boolean)) {
      directories.push(path.join(directories[directories.length - 1], segment));
    }
    for (const directory of directories) {
      let info;
      try { info = await lstat(directory); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        try { await mkdir(directory); }
        catch (mkdirError) { if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError; }
        info = await lstat(directory);
      }
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Invalid background cache directory");
    }
  }

  importImage(imagePath: string): Promise<string> {
    return this.serialize(async () => {
      const source = imagePath.startsWith("file:") ? fileURLToPath(imagePath) : imagePath;
      if (!path.isAbsolute(source) || !/\.(png|jpe?g|webp)$/i.test(source)) {
        throw new Error("请选择 JPG、PNG 或 WebP 图片。");
      }
      await this.ensureDirectory();
      const file = await open(source, "r");
      const temporary = path.join(this.directory, `${randomUUID()}.tmp`);
      try {
        if (!(await file.stat()).isFile()) throw new Error("请选择图片文件。");
        const header = Buffer.alloc(12);
        await file.read(header, 0, header.length, 0);
        const extension = header.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ? "png"
          : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff ? "jpg"
          : header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP" ? "webp" : "";
        if (!extension) throw new Error("文件不是有效的 JPG、PNG 或 WebP 图片。");
        const hash = createHash("sha256");
        // Stream the original bytes to disk; large images never cross IPC as Base64.
        await pipeline(file.createReadStream({ start: 0, autoClose: false }), async function* (chunks) {
          for await (const chunk of chunks) { hash.update(chunk); yield chunk; }
        }, createWriteStream(temporary, { flags: "wx" }));
        const name = `${hash.digest("hex")}.${extension}`;
        await rename(temporary, path.join(this.directory, name));
        return `${this.scheme}://cache/${name}`;
      } finally {
        await file.close();
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      }
    });
  }

  async resolve(url: string): Promise<string> {
    const parsed = new URL(url);
    const name = parsed.pathname.slice(1);
    if (parsed.protocol !== `${this.scheme}:` || parsed.host !== "cache" || parsed.username || parsed.password || !CACHE_FILE.test(name)) {
      throw new Error("Invalid background URL");
    }
    await this.ensureDirectory();
    const file = path.join(this.directory, name);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Invalid cached background");
    return file;
  }

  private referencedNames(payload: unknown): Set<string> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid cover references");
    const value = payload as Record<string, unknown>;
    if (Object.keys(value).length !== 2 || value.complete !== true || !Array.isArray(value.urls) || value.urls.length > 100000) {
      throw new Error("Incomplete cover references");
    }
    const names = new Set<string>();
    for (const raw of value.urls) {
      if (typeof raw !== "string") throw new Error("Invalid cover reference URL");
      let parsed: URL;
      try { parsed = new URL(raw); } catch { throw new Error("Invalid cover reference URL"); }
      const name = parsed.pathname.slice(1);
      // Validate the raw form too: URL parsing normalizes dot segments and whitespace.
      const exact = new RegExp(`^${this.scheme}://cache/[a-f0-9]{64}\\.(png|jpg|webp)$`, "i");
      if (parsed.protocol !== `${this.scheme}:` || parsed.host !== "cache" || parsed.username || parsed.password
        || parsed.search || parsed.hash || !CACHE_FILE.test(name) || !exact.test(raw)) throw new Error("Invalid cover reference URL");
      names.add(name);
    }
    return names;
  }

  private async scanOriginals(names: Set<string>) {
    await this.ensureDirectory();
    const statistics: PlaylistCoverStorageStatistics = { directory: this.directory, entries: 0, bytes: 0, reclaimableEntries: 0, reclaimableBytes: 0 };
    const candidates: { name: string; size: number; dev: number; ino: number; mtimeMs: number }[] = [];
    const cutoff = Date.now() - IMPORT_GRACE_MS;
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !CACHE_FILE.test(entry.name)) continue;
      const info = await lstat(path.join(this.directory, entry.name));
      if (!info.isFile() || info.isSymbolicLink()) continue;
      statistics.entries++;
      statistics.bytes += info.size;
      if (names.has(entry.name) || info.nlink !== 1 || !Number.isFinite(info.mtimeMs) || info.mtimeMs >= cutoff) continue;
      statistics.reclaimableEntries++;
      statistics.reclaimableBytes += info.size;
      candidates.push({ name: entry.name, size: info.size, dev: info.dev, ino: info.ino, mtimeMs: info.mtimeMs });
    }
    return { statistics, candidates };
  }

  originalStatistics(payload: unknown): Promise<PlaylistCoverStorageStatistics> {
    return this.serialize(async () => (await this.scanOriginals(this.referencedNames(payload))).statistics);
  }

  pruneOriginals(payload: unknown): Promise<PlaylistCoverCleanupResult> {
    return this.serialize(async () => {
      const names = this.referencedNames(payload);
      const { candidates } = await this.scanOriginals(names);
      let removedEntries = 0;
      let removedBytes = 0;
      for (const candidate of candidates) {
        await this.ensureDirectory();
        const file = path.join(this.directory, candidate.name);
        const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.dev !== candidate.dev || info.ino !== candidate.ino
          || info.size !== candidate.size || info.mtimeMs !== candidate.mtimeMs || info.mtimeMs >= Date.now() - IMPORT_GRACE_MS) continue;
        await unlink(file);
        removedEntries++;
        removedBytes += info.size;
      }
      return { ...(await this.scanOriginals(names)).statistics, removedEntries, removedBytes };
    });
  }

  statistics() {
    return this.serialize(async () => {
      await this.ensureDirectory();
      let bytes = 0;
      let entries = 0;
      for (const entry of await readdir(this.directory, { withFileTypes: true })) {
        if (!entry.isFile() || !CACHE_FILE.test(entry.name)) continue;
        const info = await lstat(path.join(this.directory, entry.name));
        if (!info.isFile() || info.isSymbolicLink()) continue;
        bytes += info.size;
        entries++;
      }
      return { directory: this.directory, bytes, entries };
    });
  }

  clear() {
    return this.serialize(async () => {
      await this.ensureDirectory();
      // Only our hash-named files are removable; never recursively delete a user directory.
      for (const entry of await readdir(this.directory, { withFileTypes: true })) {
        if (entry.isFile() && CACHE_FILE.test(entry.name)) await unlink(path.join(this.directory, entry.name));
      }
    });
  }
}
