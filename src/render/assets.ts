/** Node-only asset loading; the renderer module itself has no filesystem access. */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { getStandaloneHtml, setRenderAssetCss, type RenderMode } from './index.js';

export const bundledFonts = [
  ['Noto Sans CJK KR', 'NotoSansCJKkr-Regular.woff2'],
  ['Noto Serif CJK KR', 'NotoSerifCJKkr-Regular.woff2'],
] as const;

/** Full, actual Noto CJK glyph sets; no operating-system font install is needed. */
export function buildOfflineAssetCss(rootDir: string): string {
  const require = createRequire(resolve(rootDir, 'package.json'));
  const fonts = bundledFonts.map(([family, file]) => `@font-face{font-family:'${family}';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${readFileSync(resolve(rootDir, 'assets/fonts', file)).toString('base64')}) format('woff2');font-display:block;}`).join('\n');
  const cssPath = require.resolve('katex/dist/katex.min.css');
  const katexCss = readFileSync(cssPath, 'utf8').replace(/src:[^;]+;/g, declaration => {
    const font = /url\((?:["'])?([^)'" ]+\.woff2)(?:["'])?\)/.exec(declaration);
    return font ? `src:url(data:font/woff2;base64,${readFileSync(join(dirname(cssPath), font[1])).toString('base64')}) format('woff2');` : declaration;
  });
  return `${fonts}\n${katexCss}`;
}

/** CLI/main-process entry point, containing zero URLs that require network access. */
export function renderOfflineDocument(doc: any, mode: RenderMode, rootDir: string): string {
  setRenderAssetCss(buildOfflineAssetCss(rootDir));
  return getStandaloneHtml(doc, mode);
}
