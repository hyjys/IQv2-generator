/** Fast built-app screenshots of the comprehensive fixture. */
const { _electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
async function main() {
  const root = path.resolve(__dirname, '..'); const directory = path.join(root, 'artifacts', 'ui-smoke'); await fs.mkdir(directory, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'iqv2-ui-shot-')); const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [root, `--user-data-dir=${profile}`], cwd: root, env });
  try {
    const page = await app.firstWindow(); const source = await fs.readFile(path.join(root, 'artifacts/render-audit/rich.iqv2.json'), 'utf8');
    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-tab="json"]').waitFor(); await page.click('[data-tab="json"]');
    await page.locator('#source-editor').fill(source); await page.waitForTimeout(700); await page.click('[data-tab="editor"]');
    await page.locator('#preview').waitFor();
    for (const [width, height] of [[1440, 1000], [1050, 750]]) {
      await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setBounds(size), { width, height }); await page.waitForTimeout(2000);
      const frame = page.frames().find(frame => frame.parentFrame()); await frame.evaluate(async () => { await document.fonts.ready; });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(directory, `desktop-${width}.png`), fullPage: false });
      console.log(width, await frame.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, font: getComputedStyle(document.querySelector('.iq-print-document')).fontFamily })));
    }
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
