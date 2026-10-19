import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const normalize = createRequire(import.meta.url)('../scripts/normalize-artifacts.cjs');

test('real release files keep explicit x64/arm64 labels and original bytes across Linux target conventions', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iqv2-artifacts-'));
  const names = ['IQv2-Generator-0.1.0-linux-x86_64.AppImage', 'IQv2-Generator-0.1.0-linux-amd64.deb', 'IQv2-Generator-0.1.0-linux-arm64.AppImage', 'IQv2-Generator-0.1.0-linux-arm64.deb'];
  try {
    const result = {outDir, artifactPaths: names.map(name=>path.join(outDir,name))};
    for(const [index,file] of result.artifactPaths.entries())await fs.writeFile(file,`artifact-${index}`);
    await normalize(result);
    for(const [index,file] of result.artifactPaths.entries()){
      assert.match(path.basename(file), /-linux-(x64|arm64)\.(AppImage|deb)$/);
      assert.equal(await fs.readFile(file,'utf8'),`artifact-${index}`);
    }
    assert.equal((await fs.readdir(outDir)).length,4);
  } finally { await fs.rm(outDir,{recursive:true,force:true}); }
});

test('artifact normalization cannot move files outside the intended release directory',async()=>{
  await assert.rejects(()=>normalize({outDir:path.resolve('release'),artifactPaths:[path.resolve('outside/IQv2-Generator-0.1.0-linux-amd64.deb')]}),/outside the build output/);
});
