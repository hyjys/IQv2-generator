/** Opt-in: npx tsx tests/render-audit-prepare.ts && electron tests/render-visual-audit.cjs */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const root = path.resolve(__dirname, '..', 'artifacts', 'render-audit');
  const reports = [];
  for (const mode of ['questions', 'answers']) {
    const win = new BrowserWindow({ show: false, width: 1000, height: 1414, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const external = [];
    win.webContents.session.webRequest.onBeforeRequest((details, done) => {
      if (/^https?:/i.test(details.url)) { external.push(details.url); done({ cancel: true }); } else done({});
    });
    await win.loadFile(path.join(root, `${mode}.html`));
    const result = await win.webContents.executeJavaScript(`(async()=>{
      await Promise.all(['Noto Sans CJK KR','Noto Serif CJK KR'].map(family=>document.fonts.load('16px "'+family+'"')));
      await document.fonts.ready; await Promise.all(Array.from(document.images,image=>image.decode()));
      const errors=[];
      for(const svg of document.querySelectorAll('[data-media-kind="diagram"] svg')){
        const view=svg.viewBox.baseVal;
        for(const text of svg.querySelectorAll('[data-diagram-text]')){
          const rect=text.getBBox();
          if(rect.x<0||rect.y<0||rect.x+rect.width>view.width||rect.y+rect.height>view.height) errors.push({text:text.textContent,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},view:{width:view.width,height:view.height}});
        }
      }
      return {fonts:[...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family),errors,
      questionCards:document.querySelectorAll('[data-question-number]').length,
      answerCards:document.querySelectorAll('[data-answer-number]').length,
      math:document.querySelectorAll('.katex').length,
      media:document.querySelectorAll('[data-media-kind]').length,
      width:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
      languageOverrideSupported:CSS.supports('font-language-override','"JAN"')};
    })()`);
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true, generateTaggedPDF: true });
    const preflight = await win.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: await fs.readFile(path.join(root, 'preflight.js'), 'utf8') }]);
    if (preflight.length) throw new Error(JSON.stringify({mode,preflight}));
    await fs.writeFile(path.join(root, `${mode}.pdf`), pdf);
    const screenshot = await win.webContents.capturePage(); await fs.writeFile(path.join(root, `${mode}.png`), screenshot.toPNG());
    if (mode === 'questions') {
      await win.webContents.executeJavaScript("document.querySelector('[data-diagram-text]').setAttribute('x','395')");
      const rejected = await win.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: await fs.readFile(path.join(root, 'preflight.js'), 'utf8') }]);
      assert.ok(rejected.some(issue => issue.code === 'PRINT_DIAGRAM_CLIP' && issue.path === 'questions[0].media[3].elements[2]'), JSON.stringify(rejected));
    }
    if (external.length || result.errors.length || result.width > result.clientWidth) throw new Error(JSON.stringify({ mode, external, ...result }));
    if (!result.fonts.some(font => font.includes('Noto Sans CJK KR')) || !result.fonts.some(font => font.includes('Noto Serif CJK KR'))) throw new Error('Bundled fonts did not load.');
    reports.push({ mode, pdfBytes: pdf.length, externalRequests: external.length, preflight, ...result });
    win.destroy();
  }
  const report = { passed: true, platform: process.platform, electron: process.versions.electron, reports };
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
