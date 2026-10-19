const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const SERVICES = Object.freeze({
  hafstudy: { title: 'HAFS Tools', url: 'https://hafs.akademiya.kr/' },
  hafquiz: { title: 'HAFStudy 퀴즈 가져오기', url: 'https://hafs.akademiya.kr/quiz/?view=create' },
  imsiquiz: { title: 'ImsiQuiz 가져오기', url: 'https://iq.akademiya.kr/?view=create' },
  exam: { title: 'HAFS Tools AI 변형 시험지', url: 'https://hafs.akademiya.kr/tools/exam-papers' },
});
const ORIGINS = new Set(['https://hafs.akademiya.kr', 'https://iq.akademiya.kr', 'https://akademiya.kr']);
const CONTENT_ORIGINS = new Set(['https://hafs.akademiya.kr', 'https://iq.akademiya.kr']);
const PARTITION = 'persist:akademiya-services';
const MAX_JSON = 15 * 1024 * 1024;
const windows = new Set();
let configuredSession;

function parsedURL(value) { try { return new URL(value); } catch { return null; } }
function isAllowedNavigation(value) {
  const url = parsedURL(value);
  return Boolean(url && !url.username && !url.password && url.protocol === 'https:' && ORIGINS.has(url.origin));
}
function isContentOrigin(value) {
  const url = parsedURL(value);
  return Boolean(url && !url.username && !url.password && CONTENT_ORIGINS.has(url.origin));
}
function isSingleJsonInput(mode, attributes) {
  const values = new Map();
  for (let at = 0; at < attributes.length; at += 2) values.set(attributes[at].toLowerCase(), attributes[at + 1]);
  const accepts = String(values.get('accept') || '').toLowerCase().split(',').map(value => value.trim());
  return mode === 'selectSingle' && values.get('type')?.toLowerCase() === 'file' &&
    !values.has('multiple') && !values.has('webkitdirectory') &&
    accepts.some(value => value === '.json' || value === 'application/json');
}
function checkedText(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_JSON) throw new Error('현재 IQv2 JSON은 15 MiB 이하여야 합니다.');
  let document;
  try { document = JSON.parse(value); } catch { throw new Error('서비스에 전달할 JSON 문법을 먼저 고쳐 주세요.'); }
  if (!document || typeof document !== 'object' || document.schemaVersion !== '2.0' || !['quiz', 'exam', 'vocab', 'timeline'].includes(document.kind)) throw new Error('IQv2 2.0 문서만 서비스에 준비할 수 있습니다.');
  return value;
}
function safeFilename(value) { return path.basename(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180) || 'download'; }

function serviceSession() {
  const ses = session.fromPartition(PARTITION);
  if (configuredSession === ses) return ses;
  configuredSession = ses;
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Sites may use HTTPS APIs/CDNs; they never gain filesystem or custom-scheme access.
  ses.webRequest.onBeforeRequest((details, callback) => {
    const protocol = parsedURL(details.url)?.protocol;
    callback({ cancel: !['https:', 'wss:', 'data:', 'blob:'].includes(protocol) });
  });
  ses.on('will-download', (_event, item) => {
    const initiator = item.getInitiatorOrigin();
    if (!CONTENT_ORIGINS.has(initiator)) { item.cancel(); return; }
    // Leave the browser's native save dialog in charge of choosing the path.
    item.setSaveDialogOptions({ title: 'Akademiya 서비스 파일 저장', defaultPath: path.join(app.getPath('downloads'), safeFilename(item.getFilename())) });
  });
  return ses;
}

function remoteOptions() {
  return {
    width: 1320, height: 940, minWidth: 900, minHeight: 650, show: false,
    icon: path.join(__dirname, '..', 'assets', 'branding', 'icon.png'),
    webPreferences: { partition: PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: false },
  };
}

async function installChooser(win, state) {
  const contents = win.webContents;
  if (win.isDestroyed() || !isContentOrigin(contents.getURL())) return;
  if (state.installing || contents.debugger.isAttached()) return state.installing;
  state.installing = (async () => {
    contents.debugger.attach('1.3');
    await contents.debugger.sendCommand('Page.enable');
    await contents.debugger.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
  })().finally(() => { state.installing = null; });
  return state.installing;
}

function wireWindow(win, state) {
  windows.add(win);
  const contents = win.webContents;
  const showError = message => { if (!win.isDestroyed()) dialog.showMessageBox(win, { type: 'info', title: 'Akademiya 서비스 브라우저', message }).catch(() => {}); };
  const title = () => { if (!win.isDestroyed()) win.setTitle(`${state.service.title} — ${contents.getURL() || state.service.url}${state.staged ? ' · 현재 JSON 준비됨' : ''}`); };
  const stopUntrustedNavigation = (event, legacyURL) => {
    const url = event.url || legacyURL;
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      if (parsedURL(url)?.hostname === 'accounts.google.com') showError('Google 로그인은 내장 브라우저를 제한할 수 있습니다. Akademiya 계정으로 로그인하거나 브라우저 메뉴의 “기본 브라우저에서 서비스 홈 열기”를 사용하세요. 기본 브라우저의 로그인 상태는 이 창과 별도입니다.');
      return;
    }
    // Do not keep a debugger attached to the account/password/OAuth origin.
    if (!isContentOrigin(url) && contents.debugger.isAttached()) contents.debugger.detach();
  };
  contents.on('will-navigate', stopUntrustedNavigation);
  contents.on('will-redirect', stopUntrustedNavigation);
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('page-title-updated', event => { event.preventDefault(); title(); });
  contents.on('did-navigate', title);
  contents.on('did-navigate-in-page', title);
  contents.on('did-finish-load', () => installChooser(win, state).catch(error => showError(`현재 JSON 빠른 선택을 준비하지 못했습니다. JSON 파일을 저장한 후 일반 파일 선택을 이용하세요.\n${error.message}`)));
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) return { action: 'allow', overrideBrowserWindowOptions: remoteOptions() };
    if (parsedURL(url)?.hostname === 'accounts.google.com') showError('Google 로그인은 내장 브라우저를 제한합니다. 기본 브라우저에서 서비스를 별도로 열거나 Akademiya 계정 로그인을 사용하세요.');
    return { action: 'deny' };
  });
  contents.on('did-create-window', child => { wireWindow(child, { ...state, staged: null, directory: null, installing: null, choosing: false }); child.show(); });
  contents.debugger.on('message', async (_event, method, params) => {
    if (method !== 'Page.fileChooserOpened' || !params.backendNodeId || state.choosing) return;
    state.choosing = true;
    try {
      const { frameTree } = await contents.debugger.sendCommand('Page.getFrameTree');
      const { node } = await contents.debugger.sendCommand('DOM.describeNode', { backendNodeId: params.backendNodeId });
      const selectionOrigin = parsedURL(contents.getURL())?.origin;
      const canUseStaged = state.staged && isContentOrigin(contents.getURL()) && params.frameId === frameTree.frame.id && isSingleJsonInput(params.mode, node.attributes || []);
      let filenames = [];
      let pickOther = true;
      if (canUseStaged) {
        const answer = await dialog.showMessageBox(win, {
          type: 'question', title: '현재 IQv2 문서 선택',
          message: '이 사이트의 파일 선택에 현재 문서를 사용할까요?',
          detail: `${new URL(contents.getURL()).origin}\n현재 문서 선택 후 사이트에서 미리보기·가져오기·PDF 만들기를 직접 진행하세요.`,
          buttons: ['현재 문서 선택', '다른 JSON 선택', '취소'], defaultId: 0, cancelId: 2, noLink: true,
        });
        if (answer.response === 0) { filenames = [state.staged]; pickOther = false; }
        if (answer.response === 2) pickOther = false;
      }
      if (pickOther) {
        const selected = await dialog.showOpenDialog(win, {
          title: '사이트에 전달할 파일 선택', properties: ['openFile', ...(params.mode === 'selectMultiple' ? ['multiSelections'] : [])],
          ...(canUseStaged ? { filters: [{ name: 'IQv2 JSON', extensions: ['json'] }] } : {}),
        });
        if (!selected.canceled) filenames = selected.filePaths;
      }
      // Recheck origin after the asynchronous native dialog, before granting any file.
      const currentFrame = await contents.debugger.sendCommand('Page.getFrameTree');
      if (!isContentOrigin(contents.getURL()) || parsedURL(contents.getURL())?.origin !== selectionOrigin || (canUseStaged && currentFrame.frameTree.frame.id !== params.frameId)) filenames = [];
      await contents.debugger.sendCommand('DOM.setFileInputFiles', { files: filenames, backendNodeId: params.backendNodeId });
    } catch (error) { showError(`파일을 선택하지 못했습니다. 다시 시도하세요.\n${error.message}`); }
    finally { state.choosing = false; }
  });
  const menu = Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: '서비스 브라우저', submenu: [
      { label: '뒤로', accelerator: 'Alt+Left', click: () => { if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack(); } },
      { label: '앞으로', accelerator: 'Alt+Right', click: () => { if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward(); } },
      { label: '새로고침', accelerator: 'CmdOrCtrl+R', click: () => contents.reload() },
      { type: 'separator' },
      ...Object.values(SERVICES).map(service => ({ label: service.title, click: () => contents.loadURL(service.url).catch(error => showError(error.message)) })),
      { type: 'separator' },
      { label: '기본 브라우저에서 서비스 홈 열기', click: () => shell.openExternal(state.service.url).catch(error => showError(error.message)) },
      { label: '현재 주소 보기', click: () => showError(contents.getURL()) },
      { label: '서비스 로그인·사이트 데이터 지우기', click: async () => {
        const answer = await dialog.showMessageBox(win, { type: 'question', message: '이 앱의 Akademiya 서비스 로그인과 사이트 데이터를 지울까요?', detail: '로컬 IQv2 문서와 기본 브라우저의 로그인은 영향을 받지 않습니다.', buttons: ['취소', '지우기'], defaultId: 0, cancelId: 0, noLink: true });
        if (answer.response === 1) { await contents.session.clearStorageData(); await contents.session.clearCache(); contents.reload(); }
      } },
      { type: 'separator' }, { role: 'close', label: '창 닫기' },
    ] },
    { label: '편집', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '보기', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
  ]);
  win.setMenu(menu);
  if (process.platform === 'darwin') win.on('focus', () => Menu.setApplicationMenu(menu));
  win.on('closed', () => { windows.delete(win); if (state.directory) fs.rm(state.directory, { recursive: true, force: true }).catch(() => {}); });
  title();
}

async function openService(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(SERVICES, input.service)) throw new Error('지원하지 않는 Akademiya 서비스입니다.');
  const service = SERVICES[input.service];
  let directory = null, staged = null;
  if (input.text !== undefined) {
    const text = checkedText(input.text);
    directory = await fs.mkdtemp(path.join(app.getPath('temp'), 'iqv2-service-'));
    staged = path.join(directory, 'current-iqv2.json');
    await fs.writeFile(staged, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  }
  serviceSession();
  const win = new BrowserWindow(remoteOptions());
  const state = { service, directory, staged, installing: null, choosing: false };
  wireWindow(win, state);
  win.show();
  // Keep the window available for retry/refresh when the user is offline.
  win.loadURL(service.url).catch(error => { if (!win.isDestroyed()) win.setTitle(`${service.title} — 연결 실패 · ${service.url} (${error.code || 'network'})`); });
  return { service: input.service, url: service.url, staged: Boolean(staged) };
}

module.exports = { openService, SERVICES, PARTITION, isAllowedNavigation, isContentOrigin, isSingleJsonInput, checkedText };
