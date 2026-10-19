import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createTemplate } from '../src/core/index.js';
import { renderDocument, renderMedia, getStandaloneHtml, validateRenderDocument, printStyles, setRenderAssetCss } from '../src/render/index.js';
import { renderMarkdown, renderMath } from '../src/render/markdown.js';
import { buildOfflineAssetCss } from '../src/render/assets.js';

test('all document kinds and all three source profiles render without mutations', () => {
  for (const profile of ['quiz', 'exam', 'vocab', 'timeline', 'mockmock', 'mockschool'] as const) {
    const doc = createTemplate(profile); const before = JSON.stringify(doc);
    for (const mode of ['questions', 'answers', 'study'] as const) {
      const html = getStandaloneHtml(doc, mode);
      assert.match(html, /^<!doctype html>/); assert.match(html, /iq-print-document/);
      assert.ok(html.includes(doc.meta.title)); assert.doesNotMatch(html, /<script\b|<iframe\b/);
    }
    assert.equal(JSON.stringify(doc), before); assert.deepEqual(validateRenderDocument(doc), []);
  }
});

test('questions conceal all answers/explanations and answers include solutions', () => {
  const doc = createTemplate('quiz');
  doc.questions![0].explanation.correct = 'SECRET_SOLUTION_MARKER';
  doc.questions![1].answerText = ['SECRET_ANSWER_MARKER'];
  const questions = renderDocument(doc, 'questions');
  assert.doesNotMatch(questions, /SECRET_SOLUTION_MARKER|SECRET_ANSWER_MARKER/);
  const answers = renderDocument(doc, 'answers');
  assert.match(answers, /SECRET_SOLUTION_MARKER/); assert.match(answers, /SECRET_ANSWER_MARKER/);
});

test('canonical CJK emphasis, legacy underline, ruby, IVS and chemistry survive', () => {
  const html = renderMarkdown('**“한글”**은 __밑줄__이다. **<span lang="ja">葛\u{E0100}飾</span>**은 <ruby lang="ja">学校<rp>(</rp><rt>がっこう</rt><rp>)</rp></ruby>', true);
  assert.match(html, /<strong>“한글”<\/strong>은/); assert.match(html, /<u>밑줄<\/u>이다/);
  assert.match(html, /<span lang="ja">葛\u{E0100}飾<\/span>/u); assert.match(html, /<ruby lang="ja">学校/);
  assert.match(renderMath(String.raw`\ce{H2O}`), /class="katex"/);
});

test('no raw HTML, unsafe attributes, Markdown image loads or URL destinations', () => {
  const source = '<script>alert(1)</script> <span lang="ja" onclick="alert(1)">危</span> ![tracker](https://tracker.invalid/a.png) [go](https://tracker.invalid)';
  const html = renderMarkdown(source);
  assert.doesNotMatch(html, /<script|<img|href=|<span lang="ja" onclick=/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(renderMath(String.raw`\includegraphics{https://tracker.invalid/a.png}`), /<img/);
});

test('every nested media location is preserved, including choice and explanation media', () => {
  const doc = createTemplate('quiz'); const q = doc.questions![0];
  const paragraph = (text: string) => ({ type: 'paragraph' as const, text });
  doc.passages = [{ id: 'p', body: 'passage-body', media: [paragraph('passage-media')], boxes: [{ label: '보기', body: 'passage-box', media: [paragraph('passage-box-media')] }] }];
  q.passageId = 'p'; q.media = [paragraph('question-media')]; q.boxes = [{ label: '자료', body: 'question-box', media: [paragraph('question-box-media')] }];
  q.choiceMedia = [[paragraph('choice-media')], [], [], [], []]; q.explanation.media = [paragraph('solution-media')];
  const questions = renderDocument(doc, 'questions'); const answers = renderDocument(doc, 'answers');
  for (const token of ['passage-body', 'passage-media', 'passage-box', 'passage-box-media', 'question-media', 'question-box', 'question-box-media', 'choice-media']) assert.ok(questions.includes(token), token);
  assert.doesNotMatch(questions, /solution-media/); assert.match(answers, /solution-media/);
});

test('all seven media types render with no attribute interpolation or external resource fetch', () => {
  const html = renderMedia([
    { type: 'paragraph', text: '문단' }, { type: 'math', latex: 'x^2' },
    { type: 'image', src: 'https://tracker.invalid/a.png', alt: '차단 이미지' },
    { type: 'table', headers: ['제목'], rows: [['값']] },
    { type: 'graph', graphType: 'line', title: '선 그래프', points: [{ label: '가', value: -5 }, { label: '나', value: 3 }] },
    { type: 'shape', shape: 'circle', stroke: '" onload="alert(1)' },
    { type: 'diagram', width: 300, height: 150, elements: [{ type: 'text', x: '" onload="x', y: 20, text: '<script>x</script>', anchor: '" onload="x', fill: 'url(https://tracker.invalid)' }] },
  ]);
  assert.match(html, /data-media-kind="math"/); assert.match(html, /data-media-kind="table"/);
  assert.match(html, /data-media-kind="graph"/); assert.match(html, /data-media-kind="shape"/); assert.match(html, /data-media-kind="diagram"/);
  assert.doesNotMatch(html, /https:\/\/tracker|onload=|<script/); assert.match(html, /&lt;script&gt;/);
});

test('graph normalization handles finite extreme values without Infinity or NaN', () => {
  const html = renderMedia([{ type: 'graph', graphType: 'bar', points: [{ label: 'a', value: -Number.MAX_VALUE }, { label: 'b', value: Number.MAX_VALUE }] }]);
  assert.doesNotMatch(html, /Infinity|NaN/);
});

test('exam covers show half points/signature and source only on solution pages', () => {
  const doc = createTemplate('mockschool');
  doc.meta.exam!.signaturePhrase = '한 글자씩 정자로'; doc.questions![0].points = 1.5;
  doc.passages = [{ id: 'p', body: '본문', source: 'SOURCE_MARKER', author: '작가', work: '작품' }]; doc.questions![0].passageId = 'p';
  const questions = renderDocument(doc, 'questions'); const answers = renderDocument(doc, 'answers');
  assert.match(questions, /iq-cover/); assert.match(questions, /한 글자씩 정자로/); assert.match(questions, /\[1.5점\]/);
  assert.match(questions, /작가, 「작품」/); assert.doesNotMatch(questions, /SOURCE_MARKER/); assert.match(answers, /SOURCE_MARKER/);
});

test('invalid inline/math formulas return exact source locations', () => {
  const doc = createTemplate('quiz');
  doc.questions![0].prompt = String.raw`구하시오. $\notacommand{x}$`;
  doc.questions![0].media = [{ type: 'math', latex: String.raw`\frac{` }];
  doc.questions![0].explanation.others = [String.raw`$\frac{1}{$`];
  const issues = validateRenderDocument(doc);
  for (const path of ['questions[0].prompt', 'questions[0].media[0].latex', 'questions[0].explanation.others[0]']) assert.ok(issues.some(issue => issue.path === path), path);
});

test('standalone assets are local-only and injection marker prevents duplicate CSS', () => {
  const doc = createTemplate('quiz');
  assert.doesNotMatch(getStandaloneHtml(doc, 'questions', 'https://tracker.invalid'), /tracker.invalid/);
  assert.match(getStandaloneHtml(doc, 'questions', 'file:///app/dist'), /href="file:\/\/\/app\/dist\/render-assets.css"/);
  setRenderAssetCss('/* owned asset css */');
  const html = getStandaloneHtml(doc, 'questions', 'file:///app/dist');
  assert.match(html, /name="iqv2-offline-assets" content="embedded"/); assert.doesNotMatch(html, /<link/);
  setRenderAssetCss('');
});

test('bundled full Noto CJK fonts match manifest hashes and regional shaping audit', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/fonts/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.fonts.length, 2);
  for (const font of manifest.fonts) {
    const bytes = readFileSync(new URL(`../assets/fonts/${font.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), font.sha256);
    assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
  }
  const audit = JSON.parse(readFileSync(new URL('../assets/fonts/regional-shaping-audit.json', import.meta.url), 'utf8'));
  for (const font of audit) assert.equal(new Set(Object.values(font.glyphs).map(value => JSON.stringify(value))).size, 5);
  assert.match(printStyles, /font-language-override:'JAN'/); assert.match(printStyles, /font-language-override:'ZHH'/);
});

test('offline print CSS embeds fonts and has no network or unresolved font URLs', () => {
  const css = buildOfflineAssetCss(process.cwd());
  assert.match(css, /font-family:'Noto Sans CJK KR'/); assert.match(css, /font-family:'Noto Serif CJK KR'/);
  assert.match(css, /data:font\/woff2;base64/); assert.doesNotMatch(css, /url\((?!data:)/);
});
