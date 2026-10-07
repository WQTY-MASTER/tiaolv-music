import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const CACHE_FILE = /^[a-f0-9]{64}\.(png|jpg|webp)$/;

export class BackgroundImageCache {
  private directory: string;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(directory: string) {
    this.directory = path.resolve(directory);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }

  private async ensureDirectory() {
    await mkdir(this.directory, { recursive: true });
    if ((await lstat(this.directory)).isSymbolicLink()) throw new Error("Invalid background cache directory");
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
        return `tiaolv-background://cache/${name}`;
      } finally {
        await file.close();
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      }
    });
  }

  async resolve(url: string): Promise<string> {
    const parsed = new URL(url);
    const name = parsed.pathname.slice(1);
    if (parsed.protocol !== "tiaolv-background:" || parsed.host !== "cache" || parsed.username || parsed.password || !CACHE_FILE.test(name)) {
      throw new Error("Invalid background URL");
    }
    await this.ensureDirectory();
    const file = path.join(this.directory, name);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Invalid cached background");
    return file;
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
