const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');

if (typeof electron === 'string') {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(electron, [__filename, ...process.argv.slice(2)], { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const { app, nativeImage } = electron;
try {
  const root = path.resolve(__dirname, '../resources');
  const imagePath = path.join(root, 'app-icon.png');
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) throw new Error('Master application icon is empty');
  const dimensions = image.getSize();
  if (dimensions.width !== dimensions.height) throw new Error('Master icon must be square');
  const master = dimensions.width > 512 ? image.resize({ width: 512, height: 512, quality: 'best' }) : image;
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const frames = sizes.map(size => master.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  for (let i = 0; i < sizes.length; i++) {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = sizes[i] === 256 ? 0 : sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frames[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[i].length;
  }
  fs.writeFileSync(path.join(root, 'app-icon.ico'), Buffer.concat([header, ...frames]));
  if (dimensions.width > 512) fs.writeFileSync(imagePath, master.toPNG());
  if (process.argv.includes('--preview')) {
    const preview = path.resolve(__dirname, '../.playwright-cli');
    fs.mkdirSync(preview, { recursive: true });
    sizes.forEach((size, i) => fs.writeFileSync(path.join(preview, `app-icon-${size}.png`), frames[i]));
  }
  console.log(`Application ICO built: ${sizes.join(', ')} px`);
  app.exit(0);
} catch (error) {
  console.error(error);
  app.exit(1);
}
