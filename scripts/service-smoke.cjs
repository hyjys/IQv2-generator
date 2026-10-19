const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron: electron } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'artifacts', 'service-smoke');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'iqv2-service-test-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const instance = await electron.launch({ args: [root, `--user-data-dir=${profile}`], cwd: root, env, timeout: 60_000 });
  const checks = [];
  try {
    const editor = await instance.firstWindow();
    await editor.waitForFunction(() => Boolean(window.desktop?.openService));
    await instance.evaluate(async ({ session, dialog }) => {
      globalThis.__serviceSmoke = { requests: [], confirmations: 0, fileDialogs: 0, response: 0 };
      const fixture = `<!doctype html><title>Safe upload fixture</title><h1>Akademiya local upload fixture</h1><input id="upload" type="file" accept="application/json,.json"><input id="image" type="file" accept="image/png"><p id="result"></p><script>window.selectedCount=0;document.querySelector('#upload').onchange=async event=>{const file=event.target.files[0];if(file){window.selectedContent=await file.text();window.selectedName=file.name;window.selectedCount++;document.querySelector('#result').textContent=file.name;}};</script>`;
      await session.fromPartition('persist:akademiya-services').protocol.handle('https', request => {
        globalThis.__serviceSmoke.requests.push({ method: request.method, url: request.url });
        return new Response(fixture, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      });
      dialog.showMessageBox = async (_win, options) => { globalThis.__serviceSmoke.confirmations++; globalThis.__serviceSmoke.lastMessage = options.message; return { response: globalThis.__serviceSmoke.response, checkboxChecked: false }; };
      dialog.showOpenDialog = async () => { globalThis.__serviceSmoke.fileDialogs++; return { canceled: true, filePaths: [] }; };
    });
    const text = JSON.stringify({ schemaVersion: '2.0', kind: 'quiz', meta: { title: '서비스 선택 테스트' }, questions: [{ number: 1, points: 2, type: '5지선다', prompt: '2+2는?', choices: ['1', '2', '3', '4', '5'], answer: 4, explanation: { correct: '2+2=4이다.' } }] });
    const next = instance.waitForEvent('window');
    const opened = await editor.evaluate(text => window.desktop.openService({ service: 'imsiquiz', text }), text);
    assert.equal(opened.staged, true);
    const remote = await next;
    remote.on('pageerror', error => process.stderr.write(`Service fixture page error: ${error.message}\n`));
    await remote.waitForSelector('#upload');
    await remote.waitForTimeout(250);
    // Playwright initializes its own CDP session with chooser interception off.
    // Restore the application's already-installed interception after that setup.
    await instance.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('https://iq.akademiya.kr/'));
      if (!win.webContents.debugger.isAttached()) throw new Error('Application chooser debugger did not attach.');
      await win.webContents.debugger.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
    });
    const isolation = await remote.evaluate(() => ({ node: typeof require, bridge: typeof window.desktop, url: location.href, selected: window.selectedCount }));
    assert.equal(isolation.node, 'undefined'); assert.equal(isolation.bridge, 'undefined'); assert.equal(isolation.selected, 0);
    checks.push('remote-no-node-or-preload', 'no-selection-before-user-click');
    await remote.locator('#upload').click();
    await remote.waitForFunction(() => window.selectedCount === 1);
    assert.equal(await remote.evaluate(() => window.selectedContent), text);
    assert.equal(await remote.evaluate(() => window.selectedName), 'current-iqv2.json');
    checks.push('user-triggered-json-selection', 'staged-content-exact');
    await remote.evaluate(() => { document.querySelector('#upload').value = ''; });
    await instance.evaluate(() => { globalThis.__serviceSmoke.response = 2; });
    await remote.locator('#upload').click();
    await remote.waitForFunction(() => document.querySelector('#upload').files.length === 0);
    assert.equal(await remote.evaluate(() => window.selectedCount), 1);
    checks.push('native-cancel-keeps-content-unselected');
    await remote.locator('#image').click();
    await remote.waitForTimeout(250);
    const count = await instance.evaluate(() => globalThis.__serviceSmoke);
    assert.equal(count.confirmations, 2); assert.equal(count.fileDialogs, 1);
    assert.ok(count.requests.every(request => request.method === 'GET'));
    checks.push('non-json-uses-normal-dialog', 'no-app-auto-post');
    const title = await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('https://iq.akademiya.kr/')).getTitle());
    assert.ok(title.includes('https://iq.akademiya.kr/'));
    checks.push('native-title-shows-url');
    await remote.evaluate(() => { location.href = 'https://evil.example/'; });
    await remote.waitForTimeout(250);
    assert.ok(remote.url().startsWith('https://iq.akademiya.kr/'));
    checks.push('untrusted-navigation-blocked');
    const second = instance.waitForEvent('window');
    await editor.evaluate(() => window.desktop.openService({ service: 'hafquiz' }));
    const haf = await second; await haf.waitForSelector('#upload');
    const shared = await instance.evaluate(({ BrowserWindow }) => {
      const remote = BrowserWindow.getAllWindows().filter(win => /^https:/.test(win.webContents.getURL()));
      return remote.length === 2 && remote[0].webContents.session === remote[1].webContents.session;
    });
    assert.equal(shared, true); checks.push('shared-persistent-service-session');
    const live = [];
    if (process.argv.includes('--live')) for (const url of ['https://hafs.akademiya.kr/', 'https://hafs.akademiya.kr/quiz/?view=create', 'https://hafs.akademiya.kr/tools/exam-papers', 'https://iq.akademiya.kr/?view=create']) {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      assert.equal(response.status, 200, url); live.push({ url, status: response.status }); await response.arrayBuffer();
    }
    const report = { passed: true, checks, live, uploadedToLiveServices: false, authenticatedFlowsTested: false };
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await instance.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) win.destroy(); }).catch(() => {});
    await instance.close().catch(() => {});
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
