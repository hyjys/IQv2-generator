const fs = require('node:fs/promises');
const path = require('node:path');

/** electron-builder uses x86_64/amd64 for Linux extensions; release names use x64. */
module.exports = async function normalizeArtifacts(result) {
  const output = path.resolve(result.outDir);
  for (let index = 0; index < result.artifactPaths.length; index++) {
    const source = path.resolve(result.artifactPaths[index]);
    const filename = path.basename(source);
    const normalized = filename.replace(/-linux-(?:x86_64|amd64)(\.(?:AppImage|deb))$/, '-linux-x64$1');
    if (filename === normalized) continue;
    const relative = path.relative(output, source);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Artifact is outside the build output directory.');
    const destination = path.join(path.dirname(source), normalized);
    await fs.rename(source, destination);
    result.artifactPaths[index] = destination;
    process.stdout.write(`Normalized release filename: ${normalized}\n`);
  }
  return [];
};
