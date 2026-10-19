/** Generate real renderer input for the opt-in Chromium print audit. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTemplate, validateDocument } from '../src/core/index.js';
import { renderOfflineDocument } from '../src/render/assets.js';
import { validateRenderDocument, printPreflightScript } from '../src/render/index.js';

async function main() {
const doc = createTemplate('mockschool');
doc.meta.title = 'IQv2 오프라인 렌더링 점검'; doc.meta.subject = '통합 자료';
doc.meta.exam!.organization = 'Akademiya'; doc.meta.exam!.signaturePhrase = '자료를 꼼꼼히 읽고 답하자';
doc.passages = [{ id: 'material', range: [1, 2], instruction: '다음 자료를 읽고 물음에 답하시오.', body: '**“한글”**의 강조와 __밑줄__을 함께 읽는다. 화학식은 $\\ce{H2O}$이고 이차함수는 $y=x^2$이다.\n\n일본어 <ruby lang="ja">学校<rp>(</rp><rt>がっこう</rt><rp>)</rp></ruby>, 간체 <span lang="zh-Hans">骨直令葛辻漢</span>, 번체 <span lang="zh-Hant">骨直令葛辻漢</span>, 홍콩 <span lang="zh-HK">骨直令葛辻漢</span>의 지역별 자형을 보존한다.', source: '로컬 렌더링 검증용 창작 자료', author: 'IQv2', work: '자료 해석', boxes: [{ label: '보기', body: '줄 바꿈과 <span lang="ja">葛\u{E0100}飾</span>의 이체자 선택 정보를 보존한다.' }] }];
doc.questions![0].passageId = 'material';
doc.questions![0].media = [
  { type: 'math', latex: String.raw`\int_0^1 x^2\,dx=\frac{1}{3}` },
  { type: 'table', headers: ['항목', '수치'], rows: [['가', '$-2$'], ['나', '$3$']], caption: '관찰한 수치' },
  { type: 'graph', graphType: 'bar', title: '양수·음수 값 비교', points: [{ label: '가', value: -2 }, { label: '나', value: 3 }, { label: '다', value: 1 }] },
  { type: 'diagram', width: 400, height: 220, caption: '축과 실험 구간', elements: [{ type: 'arrow', x1: 40, y1: 180, x2: 350, y2: 180 }, { type: 'arrow', x1: 40, y1: 180, x2: 40, y2: 35 }, { type: 'text', x: 28, y: 36, text: '농도', fontSize: 18 }, { type: 'text', x: 350, y: 204, text: '시간', fontSize: 18, anchor: 'end' }, { type: 'circle', cx: 180, cy: 90, r: 22 }, { type: 'text', x: 180, y: 95, text: 'A', fontSize: 16, anchor: 'middle' }] },
];
doc.questions![0].choiceMedia = [[], [{ type: 'shape', shape: 'triangle', label: '보기 도형', width: 100, height: 80 }], [], [], []];
doc.questions![0].explanation.media = [{ type: 'graph', graphType: 'line', title: '해설용 변화 추이', points: [{ label: '처음', value: 0 }, { label: '중간', value: 3 }, { label: '끝', value: 1 }] }];
doc.questions![1].passageId = 'material';
const report = validateDocument(doc); const math = validateRenderDocument(doc);
if (report.issues.some(issue => issue.severity === 'error') || math.length) throw new Error(JSON.stringify({ report, math }));
const directory = path.resolve('artifacts/render-audit'); await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'rich.iqv2.json'), JSON.stringify(doc, null, 2), 'utf8');
await writeFile(path.join(directory, 'preflight.js'), printPreflightScript, 'utf8');
for (const mode of ['questions', 'answers'] as const) await writeFile(path.join(directory, `${mode}.html`), renderOfflineDocument(doc, mode, process.cwd()), 'utf8');
console.log(`Prepared rich question/answer documents in ${directory}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
