const fs = require('node:fs');
const path = require('node:path');
const { validateRuntime } = require('../../scripts/stage-runtime.cjs');

module.exports = function beforePack(context) {
  if (context.electronPlatformName !== 'win32' || context.arch !== 1) {
    throw new Error('Bundled runtime packaging currently supports Windows x64 only');
  }
  const runtime = path.join(context.packager.info.appDir, 'resources/runtime');
  validateRuntime(runtime);
  const manifest = JSON.parse(fs.readFileSync(path.join(runtime, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.javaExecutable !== 'java/bin/java.exe'
    || !Array.isArray(manifest.services) || manifest.services.length !== 3) {
    throw new Error('Invalid staged runtime manifest; run npm run runtime:stage -- --online');
  }
};
