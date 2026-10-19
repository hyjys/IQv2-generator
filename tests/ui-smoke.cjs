/** Built-app integration test. Run `node tests/ui-smoke.cjs` after npm run build. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron: electron } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, 'artifacts', 'ui-smoke'); await fs.mkdir(directory, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'iqv2-ui-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [root, `--user-data-dir=${profile}`], cwd: root, env, timeout: 90_000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(15_000); const errors = []; const checks = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  try {
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setBounds({ width: 1440, height: 1000 }); });
    await page.waitForSelector('[data-field="meta.title"]');
    await page.evaluate(() => localStorage.removeItem('iqv2-draft-v1'));
    const wait = async () => page.waitForTimeout(600);
    const currentDoc = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('iqv2-draft-v1')).source));
    const jsonInput = async source => { await page.click('[data-tab="json"]'); await page.locator('#source-editor').fill(source); await wait(); };
    const previewFrame = async () => { await page.waitForSelector('#preview'); const frame = await page.locator('#preview').contentFrame(); await frame.locator('.iq-print-document').waitFor(); return frame; };

    for (const template of ['quiz', 'vocab', 'timeline', 'exam', 'mockmock', 'mockschool']) {
      console.log(`UI smoke: ${template}`);
      await page.click('[data-action="new"]'); await page.click(`[data-template="${template}"]`); await wait();
      const doc = await currentDoc(); assert.equal(doc.kind, ['mockmock', 'mockschool'].includes(template) ? 'exam' : template);
      if (['mockmock', 'mockschool'].includes(template)) assert.equal(doc.meta.exam.kind, template);
      await previewFrame(); checks.push(`new-${template}`);
    }

    await page.click('[data-profile="quiz"]'); await wait();
    console.log('UI smoke: metadata');
    const original = await currentDoc();
    original.meta.description = 'OPTIONAL_DESCRIPTION_PRESERVED'; original.meta.shuffleChoices = false;
    original.questions[0].tags = ['OPTIONAL_TAG_PRESERVED'];
    await jsonInput(JSON.stringify(original, null, 2)); await page.click('[data-tab="editor"]'); await wait();
    await page.locator('[data-field="meta.title"]').fill('UI 메타데이터 편집 검증'); await wait();
    const edited = await currentDoc(); assert.equal(edited.meta.description, original.meta.description); assert.equal(edited.meta.shuffleChoices, false); assert.deepEqual(edited.questions[0].tags, original.questions[0].tags); checks.push('metadata-preserves-optional-fields');

    for (const invalid of ['null', '[]', '{"kind":"quiz"}', '{"schemaVersion":"2.0","kind":"quiz","meta":null,"questions":[]}']) {
      console.log(`UI smoke: malformed ${invalid}`);
      await jsonInput(invalid); await page.click('[data-tab="editor"]'); await wait();
      assert.equal(await page.locator('[data-field="meta.title"]').count(), 1, `editor survives ${invalid}`);
      await page.click('[data-tab="json"]'); assert.equal(await page.locator('#source-editor').inputValue(), invalid);
    }
    checks.push('malformed-shapes-do-not-crash-or-erase-source');
    await jsonInput(JSON.stringify(original, null, 2)); await page.click('[data-tab="editor"]'); await wait();

    const rich = JSON.parse(await fs.readFile(path.join(root, 'artifacts', 'render-audit', 'rich.iqv2.json'), 'utf8'));
    console.log('UI smoke: rich preview');
    await jsonInput(JSON.stringify(rich, null, 2)); await page.click('[data-tab="editor"]'); await wait();
    const frame = await previewFrame();
    const fontState = await frame.locator('body').evaluate(async () => {
      await Promise.all(['Noto Sans CJK KR', 'Noto Serif CJK KR'].map(f => document.fonts.load(`16px "${f}"`))); await document.fonts.ready;
      return { loaded: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family), math: document.querySelectorAll('.katex').length, diagrams: document.querySelectorAll('[data-media-kind="diagram"]').length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    assert.ok(fontState.loaded.some(font => font.includes('Noto Sans CJK KR'))); assert.ok(fontState.loaded.some(font => font.includes('Noto Serif CJK KR')));
    await page.screenshot({ path: path.join(directory, 'desktop-1440.png'), fullPage: false });
    assert.ok(fontState.math > 0); assert.equal(fontState.diagrams, 1); assert.equal(fontState.overflow, false); checks.push('preview-bundled-fonts-math-and-diagram');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1050, height: 750 })); await wait();
    const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(layout.scroll <= layout.client, `minimum desktop window overflows ${JSON.stringify(layout)}`);
    await page.screenshot({ path: path.join(directory, 'minimum-1050.png'), fullPage: false }); checks.push('minimum-window-no-horizontal-overflow');

    const clipped = structuredClone(rich); clipped.questions[0].media.push({ type: 'diagram', width: 200, height: 100, elements: [{ type: 'text', x: 190, y: 20, text: '화면 밖으로 넘치는 긴 제목', fontSize: 16 }] });
    await jsonInput(JSON.stringify(clipped, null, 2)); await page.click('[data-tab="editor"]'); await wait();
    const iframe = page.frames().find(frame => frame.parentFrame());
    const preflight = await iframe.evaluate(await fs.readFile(path.join(root, 'artifacts', 'render-audit', 'preflight.js'), 'utf8'));
    assert.ok(preflight.some(issue => /DIAGRAM_CLIP/.test(issue.code))); checks.push('print-preflight-rejects-clipped-diagram');
    const report = { passed: errors.length === 0, checks, errors, fontState, preflight, layout, platform: process.platform };
    await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
