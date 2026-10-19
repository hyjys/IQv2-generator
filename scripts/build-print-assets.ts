import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildOfflineAssetCss } from '../src/render/assets.js';
import { printPreflightScript } from '../src/render/preflight.js';

const root = process.cwd();
const css = await buildOfflineAssetCss(root);
await mkdir(path.join(root, 'public'), { recursive: true });
await writeFile(path.join(root, 'public', 'render-assets.css'), css, 'utf8');
await writeFile(path.join(root, 'public', 'print-preflight.js'), printPreflightScript, 'utf8');
process.stdout.write(`Prepared offline print assets (${Math.round(Buffer.byteLength(css) / 1024 / 1024)} MiB).\n`);
