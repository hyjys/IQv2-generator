const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL, fileURLToPath } = require('node:url');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
app.setName('IQv2 Generator');
if (process.platform === 'win32') app.setAppUserModelId('kr.akademiya.iqv2generator');
const DIST = path.join(ROOT, 'dist');
const ENTRY = pathToFileURL(path.join(DIST, 'index.html')).href;
const DEV_URL = 'http://127.0.0.1:5173';
const isSmoke = process.argv.includes('--smoke-test');
const cliIndex = process.argv.indexOf('--cli');
const isCli = cliIndex !== -1;
const isDev = !app.isPackaged && process.argv.includes('--dev') && !isSmoke && !isCli;
const MAX_DOCUMENT = 50 * 1024 * 1024;
const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_HTML = 200 * 1024 * 1024;
const grantedPaths = new Set();
let mainWindow;
let smokeFiles;
let pdfRunning = false;

function inside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function isMainURL(url) {
  try {
    const parsed = new URL(url);
    return isDev ? parsed.origin === DEV_URL : parsed.protocol === 'file:' && parsed.href.split('#')[0] === ENTRY;
  } catch { return false; }
}

function checkSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      !event.senderFrame || event.senderFrame !== event.sender.mainFrame ||
      !isMainURL(event.senderFrame.url)) {
    throw new Error('허용되지 않은 앱 화면에서 요청했습니다.');
  }
}

function optionsObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('요청 형식이 올바르지 않습니다.');
  return value;
}

function boundedText(value, maximum, label) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maximum) {
    throw new Error(`${label} 크기가 허용 범위를 벗어났습니다.`);
  }
  return value;
}

function safeName(value, fallback) {
  return (typeof value === 'string' ? path.basename(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 160) : '') || fallback;
}

async function atomicWrite(destination, data) {
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, data, { flag: 'wx' });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

function secureSession(ses, { pdfFile } = {}) {
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      const url = new URL(details.url);
      if (url.protocol === 'data:' || url.protocol === 'blob:') allowed = true;
      if (url.protocol === 'file:') {
        const target = fileURLToPath(url);
        allowed = inside(DIST, target) || Boolean(pdfFile && target === pdfFile);
      }
      if (!pdfFile && isDev && (url.origin === DEV_URL || details.url.startsWith('ws://127.0.0.1:5173/'))) allowed = true;
    } catch { /* Unknown schemes are blocked. */ }
    callback({ cancel: !allowed });
  });
}

async function openDocument() {
  const result = smokeFiles ? { canceled: false, filePaths: [smokeFiles.input] } : await dialog.showOpenDialog(mainWindow, {
    title: 'IQv2 JSON 열기', properties: ['openFile'], filters: [{ name: 'IQv2 JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filename = path.resolve(result.filePaths[0]);
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > MAX_DOCUMENT) throw new Error('JSON은 50 MiB 이하의 파일이어야 합니다.');
  const text = await fs.readFile(filename, 'utf8');
  grantedPaths.add(filename);
  return { path: filename, text: text.replace(/^\uFEFF/, '') };
}

async function saveDocument(input) {
  const options = optionsObject(input);
  const text = boundedText(options.text, MAX_DOCUMENT, 'JSON');
  let destination;
  if (options.path !== undefined) {
    if (typeof options.path !== 'string' || !grantedPaths.has(path.resolve(options.path))) {
      throw new Error('이 앱에서 연 파일만 바로 저장할 수 있습니다. 다른 이름으로 저장하세요.');
    }
    destination = path.resolve(options.path);
  } else {
    const result = smokeFiles ? { canceled: false, filePath: smokeFiles.saved } : await dialog.showSaveDialog(mainWindow, {
      title: 'IQv2 JSON 저장', defaultPath: safeName(options.suggestedName, 'iqv2.json'),
      filters: [{ name: 'IQv2 JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    destination = path.resolve(result.filePath);
  }
  await atomicWrite(destination, text);
  grantedPaths.add(destination);
  return { path: destination };
}

function imageMime(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function chooseImage() {
  const result = smokeFiles ? { canceled: false, filePaths: [smokeFiles.image] } : await dialog.showOpenDialog(mainWindow, {
    title: '포함할 이미지 선택', properties: ['openFile'], filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filename = result.filePaths[0];
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > MAX_IMAGE) throw new Error('이미지는 20 MiB 이하여야 합니다.');
  const bytes = await fs.readFile(filename);
  const mime = imageMime(bytes);
  if (!mime) throw new Error('PNG, JPEG, WebP 이미지 파일만 포함할 수 있습니다.');
  const { nativeImage } = require('electron');
  if (nativeImage.createFromBuffer(bytes).isEmpty()) throw new Error('이미지 데이터를 해석할 수 없습니다.');
  return { name: path.basename(filename), src: `data:${mime};base64,${bytes.toString('base64')}`, bytes: bytes.length };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function withTimeout(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${label} 시간이 초과되었습니다. 문서·이미지·글꼴을 확인하세요.`)), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}

async function exportPdf(input, directDestination) {
  if (pdfRunning) throw new Error('PDF를 만드는 중입니다. 완료 후 다시 시도하세요.');
  const options = optionsObject(input);
  const html = boundedText(options.html, MAX_HTML, '인쇄 문서');
  const title = boundedText(options.title || 'IQv2', 1024, '제목');
  if (options.mode !== undefined && !['questions', 'answers'].includes(options.mode)) throw new Error('인쇄 모드가 올바르지 않습니다.');
  const suffix = options.mode === 'answers' ? '해설지' : '문제지';
  const result = directDestination ? { canceled: false, filePath: directDestination } : smokeFiles ? { canceled: false, filePath: path.join(smokeFiles.directory, `${options.mode || 'questions'}.pdf`) } : await dialog.showSaveDialog(mainWindow, {
    title: `${suffix} PDF 저장`, defaultPath: `${safeName(title, 'IQv2')}-${suffix}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;
  pdfRunning = true;
  let printWindow;
  let temporary;
  try {
    temporary = path.join(app.getPath('temp'), `iqv2-print-${crypto.randomUUID()}.html`);
    const csp = "default-src 'none'; img-src data: file:; style-src 'unsafe-inline' file: data:; font-src data: file:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri file:; form-action 'none'";
    const base = pathToFileURL(`${DIST}${path.sep}`).href;
    const assetCss = html.includes('name="iqv2-offline-assets"') ? '' : await fs.readFile(path.join(DIST, 'render-assets.css'), 'utf8');
    const wrapped = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base href="${base}"><title>${escapeHtml(title)}</title><style>${assetCss}\n@page{size:A4;margin:14mm}html{background:#fff;color:#111}body{margin:0}*{box-sizing:border-box}img,svg,table{max-width:100%}img,svg{break-inside:avoid}a{color:inherit}</style></head><body>${html}</body></html>`;
    await fs.writeFile(temporary, wrapped, { flag: 'wx' });
    const ses = session.fromPartition(`iqv2-print-${crypto.randomUUID()}`);
    secureSession(ses, { pdfFile: temporary });
    printWindow = new BrowserWindow({
      show: false, width: 704, height: 1010, useContentSize: true,
      webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, javascript: false, webSecurity: true, devTools: false },
    });
    secureWindow(printWindow);
    await withTimeout(printWindow.loadFile(temporary), 45_000, '인쇄 문서 불러오기');
    printWindow.webContents.debugger.attach('1.3');
    await withTimeout(printWindow.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' }), 10_000, '인쇄 화면 전환');
    // Content scripts are disabled. This application-owned expression only
    // loads exact bundled fonts, decodes images and measures actual print bounds.
    const preflightScript = await fs.readFile(path.join(DIST, 'print-preflight.js'), 'utf8');
    const issues = await withTimeout(printWindow.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: preflightScript }]), 45_000, '실제 글꼴·인쇄 경계 검증');
    if (Array.isArray(issues) && issues.length) {
      const error = new Error(`인쇄 검증 실패:\n${issues.map(issue => `[${issue.code}] ${issue.path}: ${issue.message}`).join('\n')}`);
      error.code = 'PRINT_PREFLIGHT';
      error.issues = issues;
      throw error;
    }
    printWindow.webContents.debugger.detach();
    const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true, generateTaggedPDF: true });
    await atomicWrite(path.resolve(result.filePath), pdf);
    return { path: path.resolve(result.filePath) };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    if (temporary) await fs.rm(temporary, { force: true }).catch(() => {});
    pdfRunning = false;
  }
}

function registerIPC() {
  const handle = (name, action) => ipcMain.handle(name, (event, input) => { checkSender(event); return action(input); });
  handle('document:open', openDocument);
  handle('document:save', saveDocument);
  handle('image:open', chooseImage);
  handle('document:pdf', exportPdf);
  handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
  handle('service:open', require('./services.cjs').openService);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'IQv2 Studio', width: 1440, height: 980, minWidth: 1050, minHeight: 700, show: !isSmoke,
    backgroundColor: '#f6f5f9', autoHideMenuBar: process.platform !== 'darwin',
    icon: path.join(ROOT, 'assets', 'branding', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged },
  });
  secureWindow(mainWindow);
  if (process.platform === 'darwin') {
    const localMenu = Menu.getApplicationMenu();
    mainWindow.on('focus', () => { if (localMenu) Menu.setApplicationMenu(localMenu); });
  }
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question', title: '저장하지 않은 변경사항',
      message: '저장하지 않은 변경사항이 있습니다. 닫을까요?',
      detail: '계속 편집을 선택하면 문서를 저장할 수 있습니다.',
      buttons: ['계속 편집', '저장하지 않고 닫기'], defaultId: 0, cancelId: 0,
      noLink: true,
    });
    if (choice === 1) event.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(isDev ? DEV_URL : ENTRY);
}

async function smokeTest() {
  const directory = process.env.IQV2_SMOKE_OUTPUT;
  if (!directory || !path.isAbsolute(directory)) throw new Error('Smoke output must be an absolute directory.');
  await fs.mkdir(directory, { recursive: true });
  smokeFiles = { directory, input: path.join(directory, 'input.json'), saved: path.join(directory, 'roundtrip.json'), image: path.join(directory, 'fixture.png') };
  const expected = JSON.stringify({ schemaVersion: '2.0', kind: 'quiz', meta: { title: '한글 파일 검증' }, questions: [] });
  await fs.writeFile(smokeFiles.input, expected);
  await fs.writeFile(smokeFiles.image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNoD/j0H4QZYAwAYB4LIbC2NhkAAAAASUVORK5CYII=', 'base64'));
  await createWindow();
  const run = (code) => mainWindow.webContents.executeJavaScript(code);
  const state = await run('({ desktop: !!window.desktop, node: typeof require, title: document.title, content: document.body.children.length })');
  assert.equal(state.desktop, true);
  assert.equal(state.node, 'undefined');
  assert.ok(state.title && state.content > 0);
  const opened = await run('window.desktop.openDocument()');
  assert.equal(opened.text, expected);
  await run(`window.desktop.saveDocument({text:${JSON.stringify(expected)},suggestedName:'roundtrip.json'})`);
  assert.equal(await fs.readFile(smokeFiles.saved, 'utf8'), expected);
  await assert.rejects(() => run("window.desktop.saveDocument({text:'bad',path:'/forbidden-file.json'})"));
  const image = await run('window.desktop.chooseImage()');
  assert.ok(image.src.startsWith('data:image/png;base64,') && image.bytes > 0);
  for (const mode of ['questions', 'answers']) {
    const printed = await run(`window.desktop.exportPdf({title:'오프라인 인쇄 검증',html:'<style>body{font-family:sans-serif}h1{color:#6a32d6}</style><h1>IQv2 ${mode}</h1><p>한글 문제와 해설 인쇄 확인</p><img src="${image.src}">',mode:'${mode}'})`);
    const bytes = await fs.readFile(printed.path);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 1000);
  }
  const report = { passed: true, platform: process.platform, electron: process.versions.electron, checks: ['renderer-loaded', 'sandbox-no-node', 'isolated-bridge', 'utf8-file-open', 'atomic-file-save', 'unauthorized-path-rejected', 'embedded-image', 'question-pdf', 'answer-pdf'] };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  app.exit(0);
}

if (!isSmoke && !isCli && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    if (process.platform === 'darwin' && app.dock) app.dock.setIcon(path.join(ROOT, 'assets', 'branding', 'icon.png'));
    if (isCli) {
      const { nativeImage } = require('electron');
      const { runCli } = require('./cli-bundle.cjs');
      const code = await runCli(process.argv.slice(cliIndex + 1), {
        appRoot: ROOT,
        exportPdf,
        decodeRaster: async (dataUrl) => {
          const image = nativeImage.createFromDataURL(dataUrl);
          if (image.isEmpty()) throw new Error('IMAGE_DECODE');
          return image.getSize();
        },
      });
      await new Promise(resolve => process.stdout.write('', resolve));
      app.exit(code);
      return;
    }
    secureSession(session.defaultSession);
    registerIPC();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: '편집', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '보기', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
    ]));
    if (isSmoke) await smokeTest();
    else await createWindow();
    app.on('activate', () => { if (!mainWindow) createWindow().catch(console.error); });
  }).catch((error) => { console.error(error); app.exit(1); });
  app.on('window-all-closed', () => { if (!isCli && (process.platform !== 'darwin' || isSmoke)) app.quit(); });
}
