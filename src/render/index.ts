/**
 * Offline IQv2 projection. Rich text follows Akademiya's shared markdown.ts;
 * media and exam layout are adapted from gmc/server/examContent.ts and
 * examPaper.ts. See PROVENANCE.md for the source revision and differences.
 */
import { renderMarkdown, renderMath } from './markdown.js';
import katex from 'katex';

export type RenderMode = 'questions' | 'answers' | 'study';
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const text = (value: unknown): string => typeof value === 'string' ? value : String(value ?? '');
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const number = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const color = (value: unknown, fallback: string): string => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value : value === 'none' ? 'none' : fallback;
const inline = (value: unknown): string => renderMarkdown(text(value), true);
const paragraphs = (value: unknown): string => renderMarkdown(text(value), false).replace(/<(p|td|th)>/g, '<$1 dir="auto">');
const circled = ['①', '②', '③', '④', '⑤'];

/** Only application-owned asset CSS may be supplied here, never document input. */
let assetCss = '';
export function setRenderAssetCss(css: string): void { assetCss = css; }

function boxes(boxes: unknown, sourcePath = 'boxes'): string {
  return list(boxes).map((box, index) => `<aside class="iq-box">${box.label ? `<div class="iq-label">${inline(box.label)}</div>` : ''}${paragraphs(box.body)}${renderMedia(box.media, `${sourcePath}[${index}].media`)}</aside>`).join('');
}

/** Attribute values are regenerated from typed primitives even if validation was bypassed. */
export function renderMedia(media: unknown, sourcePath = 'media'): string {
  return list(media).map((block: any, index: number) => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'paragraph') return paragraphs(block.text);
    if (block.type === 'math') return `<div class="iq-math" data-media-kind="math">${renderMath(text(block.latex).slice(0, 4000), block.display !== false)}</div>`;
    if (block.type === 'image') {
      const src = text(block.src);
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) return `<div class="iq-missing-media" role="note">${/^iq:\/\/u\/[a-f0-9]{32}$/i.test(src) ? '업로드 참조 이미지를 파일에 포함해야 합니다.' : '표시할 수 없는 이미지입니다.'} ${escapeHtml(block.alt)}</div>`;
      const width = number(block.width);
      return `<figure class="iq-media" data-media-kind="image"><img src="${src}" alt="${escapeHtml(block.alt)}"${width > 0 ? ` style="width:${Math.min(1600, width)}px"` : ''}>${block.alt ? `<figcaption>${inline(block.alt)}</figcaption>` : ''}</figure>`;
    }
    if (block.type === 'table') return `<div class="iq-table-wrap" data-media-kind="table"><table class="iq-media-table">${block.caption ? `<caption>${inline(block.caption)}</caption>` : ''}${Array.isArray(block.headers) ? `<thead><tr>${block.headers.map((cell: unknown) => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead>` : ''}<tbody>${list(block.rows).map(row => `<tr>${list(row).map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (block.type === 'graph') {
      const points = list(block.points).slice(0, 20); const values = points.map(point => number(point.value));
      const low = Math.min(0, ...values); const high = Math.max(0, ...values);
      // Divide before subtracting: finite inputs near Number.MAX_VALUE cannot overflow.
      const scale = Math.max(1, Math.abs(low), Math.abs(high)); const span = high / scale - low / scale || 1;
      const x = (i: number) => 65 + i * (360 / Math.max(1, points.length - 1));
      const y = (v: number) => 25 + (high / scale - v / scale) / span * 160; const zero = y(0);
      const tickLabel = (value: number) => Math.abs(value) > 1e12 ? value.toExponential(3) : String(Number(value.toPrecision(4)));
      const ticks = Array.from({ length: 5 }, (_, i) => (low / scale + span * i / 4) * scale).map(value => `<path d="M50 ${y(value)}H450" stroke="#d1d5db"/><text x="44" y="${y(value) + 4}" text-anchor="end">${tickLabel(value)}</text>`).join('');
      const bars = block.graphType === 'bar' ? points.map((point, i) => `<rect x="${x(i) - Math.min(12, 140 / points.length)}" y="${Math.min(zero, y(number(point.value)))}" width="${Math.min(24, 280 / points.length)}" height="${Math.abs(zero - y(number(point.value)))}" fill="#64748b"/>`).join('') : `<polyline points="${points.map((point, i) => `${x(i)},${y(number(point.value))}`).join(' ')}" fill="none" stroke="#1f2937" stroke-width="2"/>`;
      const useKey = points.length > 8 || points.some(point => text(point.label).length > 5);
      const labels = points.map((point, i) => `<text x="${x(i)}" y="207" text-anchor="middle">${escapeHtml(useKey ? String(i + 1) : point.label)}</text>`).join('');
      return `<figure class="iq-media" data-media-kind="graph"><svg viewBox="0 0 480 225" role="img" aria-label="${escapeHtml(block.title ?? '그래프')}">${ticks}<path d="M50 20V${y(low)}H450M50 ${zero}H450" fill="none" stroke="#1f2937"/>${bars}${labels}</svg>${block.title ? `<figcaption>${inline(block.title)}</figcaption>` : ''}${useKey ? `<div class="iq-graph-key">${points.map((point, i) => `${i + 1}: ${inline(point.label)}`).join(' · ')}</div>` : ''}</figure>`;
    }
    if (block.type === 'shape') {
      const style = `stroke="${color(block.stroke, '#1f2937')}" fill="${color(block.fill, 'none')}" stroke-width="2"`;
      const shape = block.shape === 'circle' ? `<circle cx="50" cy="50" r="35" ${style}/>` : block.shape === 'triangle' ? `<polygon points="50,10 90,90 10,90" ${style}/>` : block.shape === 'rectangle' ? `<rect x="10" y="20" width="80" height="60" ${style}/>` : `<path d="M10 50H90${block.shape === 'arrow' ? 'M77 40L90 50L77 60' : ''}" ${style}/>`;
      return `<figure class="iq-media iq-shape" data-media-kind="shape"><svg viewBox="0 0 100 100" width="${Math.max(32, Math.min(800, number(block.width, 160)))}" height="${Math.max(32, Math.min(500, number(block.height, 110)))}" role="img" aria-label="${escapeHtml(block.label ?? block.shape)}">${shape}</svg>${block.label ? `<figcaption>${inline(block.label)}</figcaption>` : ''}</figure>`;
    }
    if (block.type === 'diagram') {
      const elements = list(block.elements).slice(0, 300).map((element, elementIndex) => {
        const stroke = color(element.stroke, '#1f2937'); const fill = color(element.fill, 'none');
        const style = `data-diagram-element-index="${elementIndex}" stroke="${stroke}" fill="${fill}" stroke-width="${number(element.strokeWidth, 1.5)}"`;
        if (element.type === 'text') return `<text data-diagram-text="true" data-diagram-element-index="${elementIndex}" x="${number(element.x)}" y="${number(element.y)}" font-size="${number(element.fontSize, 16)}" text-anchor="${['start', 'middle', 'end'].includes(element.anchor) ? element.anchor : 'start'}" fill="${color(element.fill, '#1f2937') === 'none' ? '#1f2937' : color(element.fill, '#1f2937')}">${escapeHtml(element.text)}</text>`;
        if (element.type === 'line' || element.type === 'arrow') {
          const x1 = number(element.x1); const x2 = number(element.x2); const y1 = number(element.y1); const y2 = number(element.y2);
          const angle = Math.atan2(y2 - y1, x2 - x1); const head = (sign: number) => `${x2 - 9 * Math.cos(angle + sign * Math.PI / 6)},${y2 - 9 * Math.sin(angle + sign * Math.PI / 6)}`;
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${style}/>${element.type === 'arrow' ? `<polyline points="${head(1)} ${x2},${y2} ${head(-1)}" ${style}/>` : ''}`;
        }
        if (element.type === 'circle') return `<circle cx="${number(element.cx)}" cy="${number(element.cy)}" r="${number(element.r)}" ${style}/>`;
        if (element.type === 'ellipse') return `<ellipse cx="${number(element.cx)}" cy="${number(element.cy)}" rx="${number(element.rx)}" ry="${number(element.ry)}" ${style}/>`;
        if (element.type === 'rect') return `<rect x="${number(element.x)}" y="${number(element.y)}" width="${number(element.width)}" height="${number(element.height)}" ${style}/>`;
        if (element.type === 'polygon' || element.type === 'polyline') return `<${element.type} points="${list(element.points).map(point => `${number(point?.[0])},${number(point?.[1])}`).join(' ')}" ${style}/>`;
        return '';
      }).join('');
      return `<figure class="iq-media" data-media-kind="diagram" data-media-path="${escapeHtml(sourcePath)}[${index}]"><svg viewBox="0 0 ${number(block.width, 300)} ${number(block.height, 160)}" role="img" aria-label="${escapeHtml(block.caption ?? '도형')}">${elements}</svg>${block.caption ? `<figcaption>${inline(block.caption)}</figcaption>` : ''}</figure>`;
    }
    return '';
  }).map((markup, index) => markup ? `<div class="iq-media-block" data-media-path="${escapeHtml(sourcePath)}[${index}]">${markup}</div>` : '').join('');
}

function answerFor(question: any): string {
  if (question.type === 'OX') return question.answer === 1 ? 'O' : question.answer === 2 ? 'X' : '';
  if (typeof question.answer === 'number') return circled[question.answer - 1] ?? String(question.answer);
  return list(question.answerText).map(text).join(question.type === '순서 배열' ? ' → ' : ' / ');
}

function heading(doc: any, label: string): string {
  return `<header class="iq-document-head"><div class="iq-eyebrow">${escapeHtml(label)}${doc.meta?.subject ? ` · ${escapeHtml(doc.meta.subject)}` : ''}</div><h1>${inline(doc.meta?.title ?? '제목 없음')}</h1>${doc.meta?.subtitle ? `<p class="iq-subtitle">${inline(doc.meta.subtitle)}</p>` : ''}</header>`;
}

function passageHtml(passage: any, questions: any[], index = 0): string {
  const related = questions.filter(question => question.passageId === passage.id).map(question => question.number);
  const range = list(passage.range).length === 2 ? passage.range : related.length ? [Math.min(...related), Math.max(...related)] : [];
  const attribution = passage.author && passage.work ? `${passage.author}, 「${passage.work}」` : passage.work ? `「${passage.work}」` : passage.author;
  return `<section class="iq-passage" data-passage-id="${escapeHtml(passage.id)}"><div class="iq-passage-head">${range.length ? `[${escapeHtml(range[0])}${range[0] !== range[1] ? `~${escapeHtml(range[1])}` : ''}] ` : ''}${inline(passage.instruction)}</div><div class="iq-passage-body">${paragraphs(passage.body)}${renderMedia(passage.media, `passages[${index}].media`)}${attribution ? `<div class="iq-attribution">${inline(attribution)}</div>` : ''}</div>${boxes(passage.boxes, `passages[${index}].boxes`)}</section>`;
}

function cover(doc: any): string {
  const exam = doc.meta?.exam ?? {}; const questions = list(doc.questions);
  const total = questions.reduce((sum, question) => sum + number(question.points), 0);
  return `<section class="iq-cover"><div class="iq-cover-period">${escapeHtml(exam.periodLabel ?? (exam.kind === 'mockschool' ? '모의내신' : '모의모의고사'))}</div><div class="iq-cover-title">${inline(doc.meta?.title)}</div><h1>${inline(doc.meta?.subject ?? '시험지')}</h1><div class="iq-name-row"><div>성명 <span></span></div><div>수험 번호 <span></span></div></div><div class="iq-cover-notice"><p>문제지의 성명과 수험 번호를 정확히 쓰시오.</p><p>필적 확인 문구를 정자로 기재하시오.</p><div class="iq-signature">${escapeHtml(exam.signaturePhrase)}</div><p>문항 수 ${questions.length}문항 · 총점 ${total}점${number(doc.meta?.timeLimitSec) > 0 ? ` · 시험 시간 ${Number((doc.meta.timeLimitSec / 60).toFixed(2))}분` : ''}</p><p>각 문항에 표시된 배점을 확인하고 답안을 정확히 표시하시오.</p></div><div class="iq-cover-bottom">시험이 시작되기 전까지 표지를 넘기지 마십시오.</div>${exam.organization ? `<div class="iq-cover-org">${escapeHtml(exam.organization)}</div>` : ''}</section>`;
}

function questionHtml(question: any, index: number): string {
  const choices = question.type === 'OX' ? list(question.choices).length ? question.choices : ['O', 'X'] : list(question.choices);
  const content = ['5지선다', 'OX', '순서 배열'].includes(question.type) && choices.length ? `<ol class="iq-choices">${choices.map((choice: unknown, choiceIndex: number) => `<li dir="auto"><span class="iq-choice-number">${circled[choiceIndex] ?? `${choiceIndex + 1}.`}</span><div>${inline(choice)}${renderMedia(question.choiceMedia?.[choiceIndex], `questions[${index}].choiceMedia[${choiceIndex}]`)}</div></li>`).join('')}</ol>` : question.type === '서술형' ? '<div class="iq-essay-space" aria-label="서술형 답안 작성란"></div>' : '<div class="iq-short-answer" aria-label="단답형 답안 작성란"></div>';
  return `<article class="iq-question" data-question-number="${escapeHtml(question.number)}"><div class="iq-prompt" dir="auto"><bdi class="iq-question-number">${escapeHtml(question.number)}.</bdi> ${inline(question.prompt)} <bdi class="iq-points">[${escapeHtml(question.points)}점]</bdi></div>${renderMedia(question.media, `questions[${index}].media`)}${boxes(question.boxes, `questions[${index}].boxes`)}${content}</article>`;
}

function renderQuestions(doc: any, study: boolean): string {
  const questions = list(doc.questions); const passages = list(doc.passages); const printed = new Set<string>();
  const flow: string[] = [];
  for (const [index, question] of questions.entries()) {
    for (const passage of passages) {
      if (!printed.has(passage.id) && (question.passageId === passage.id || passage.range?.[0] === question.number)) {
        printed.add(passage.id); flow.push(passageHtml(passage, questions, passages.indexOf(passage)));
      }
    }
    flow.push(questionHtml(question, index));
    if (study) flow.push(solution(question, index));
  }
  // Keep unreferenced passages visible rather than silently losing user content.
  for (const passage of passages) if (!printed.has(passage.id)) flow.push(passageHtml(passage, questions, passages.indexOf(passage)));
  return `${doc.kind === 'exam' && doc.meta?.exam && !study ? cover(doc) : ''}${heading(doc, study ? '학습용' : '문제지')}<main class="iq-flow ${doc.kind === 'exam' && !study ? 'iq-two-columns' : ''}" data-exam-flow>${flow.join('')}</main>`;
}

function solution(question: any, index: number): string {
  const explanation = question.explanation ?? {};
  return `<article class="iq-solution" data-answer-number="${escapeHtml(question.number)}"><h3>${escapeHtml(question.number)}. <span class="iq-answer">정답 ${inline(answerFor(question))}</span></h3>${explanation.intent ? `<p class="iq-intent">[출제 의도] ${inline(explanation.intent)}</p>` : ''}${paragraphs(explanation.correct)}${renderMedia(explanation.media, `questions[${index}].explanation.media`)}${list(explanation.others).length ? `<div class="iq-others">${list(explanation.others).map(value => paragraphs(value)).join('')}</div>` : ''}</article>`;
}

function renderAnswers(doc: any): string {
  const questions = list(doc.questions); const sourcePrinted = new Set<string>();
  const answers = questions.map(question => `<div><span>${escapeHtml(question.number)}</span><strong>${inline(answerFor(question))}</strong></div>`).join('');
  return `${heading(doc, '정답 및 해설')}<div class="iq-answer-grid">${answers}</div><main class="iq-flow iq-two-columns" data-exam-flow>${questions.map((question, index) => {
    const passage = list(doc.passages).find(passage => passage.id === question.passageId); let source = '';
    if (passage?.source && !sourcePrinted.has(passage.id)) { sourcePrinted.add(passage.id); source = `<p class="iq-source">[지문 출처] ${inline(passage.source)}</p>`; }
    return source + solution(question, index);
  }).join('')}</main>`;
}

function renderEntries(doc: any, mode: RenderMode): string {
  const vocab = doc.kind === 'vocab'; const entries = list(doc.entries);
  // Timeline order is intentionally preserved; validation identifies bad sortKey ordering.
  const content = vocab ? `<table class="iq-study-table"><thead><tr><th>단어 · 독음</th><th>뜻 · 학습 정보</th></tr></thead><tbody>${entries.map(entry => `<tr><th scope="row">${inline(entry.term)}${entry.reading ? `<small>${inline(entry.reading)}</small>` : ''}${entry.pos ? `<small>${inline(entry.pos)}</small>` : ''}${entry.category ? `<small>${inline(entry.category)}</small>` : ''}</th><td>${mode === 'questions' ? '<div class="iq-vocab-blank"></div>' : `<strong>${list(entry.meaning).map(value => inline(value)).join(' / ')}</strong>${entry.definition ? paragraphs(entry.definition) : ''}${entry.example ? `<div class="iq-example">${paragraphs(entry.example)}${entry.exampleMeaning ? paragraphs(entry.exampleMeaning) : ''}</div>` : ''}${entry.note ? paragraphs(entry.note) : ''}`}</td></tr>`).join('')}</tbody></table>` : `<ol class="iq-timeline">${entries.map(entry => `<li><div class="iq-timeline-year">${inline(entry.year)}</div><div>${mode === 'questions' ? '<div class="iq-vocab-blank"></div>' : `<h3>${inline(entry.event)}</h3>${entry.detail ? paragraphs(entry.detail) : ''}${list(entry.category).length ? `<div class="iq-category">${list(entry.category).map(value => inline(value)).join(' · ')}</div>` : ''}`}</div></li>`).join('')}</ol>`;
  return `${heading(doc, vocab ? mode === 'questions' ? '단어 시험' : '단어장' : mode === 'questions' ? '연표 시험' : '연표')}${doc.meta?.description ? paragraphs(doc.meta.description) : ''}<main>${content}</main>`;
}

/** Returns a complete BODY fragment. Questions never include answers or explanations. */
export function renderDocument(doc: any, mode: RenderMode = 'questions'): string {
  if (!doc || typeof doc !== 'object') return '';
  const contents = doc.kind === 'vocab' || doc.kind === 'timeline' ? renderEntries(doc, mode) : mode === 'answers' ? renderAnswers(doc) : renderQuestions(doc, mode === 'study');
  return `<div class="iq-print-document" lang="${['ko', 'en', 'ja', 'zh'].includes(doc.meta?.language) ? doc.meta.language : 'ko'}">${doc.meta?.exam?.confidential ? '<div class="iq-confidential">외부 유출 금지 · 개인 사용 전용</div>' : ''}${contents}</div>`;
}

export interface RenderIssue { path: string; code: 'MATH_RENDER'; message: string }
/** Validate exactly the text/media locations rendered by this projection. */
export function validateRenderDocument(doc: any): RenderIssue[] {
  const issues: RenderIssue[] = [];
  const checkLatex = (latex: string, path: string) => {
    try {
      if (latex.length > 4000) throw new Error('수식은 4,000자 이하여야 합니다.');
      katex.renderToString(latex, { throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20 });
    } catch (error) { issues.push({ path, code: 'MATH_RENDER', message: error instanceof Error ? error.message : '해석할 수 없는 수식입니다.' }); }
  };
  const rich = (value: unknown, path: string) => {
    if (typeof value !== 'string' || !value) return;
    try {
      const html = renderMarkdown(value);
      if (/class="katex-error(?:"| )/.test(html)) issues.push({ path, code: 'MATH_RENDER', message: '본문 수식을 해석할 수 없습니다. LaTeX 문법을 확인하세요.' });
      for (const match of html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)) {
        const latex = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
        checkLatex(latex, path);
      }
    } catch (error) { issues.push({ path, code: 'MATH_RENDER', message: error instanceof Error ? error.message : '본문을 표시할 수 없습니다.' }); }
  };
  const media = (value: unknown, path: string) => list(value).forEach((block, index) => {
    const p = `${path}[${index}]`;
    if (block?.type === 'math') checkLatex(text(block.latex), `${p}.latex`);
    if (block?.type === 'paragraph') rich(block.text, `${p}.text`);
    if (block?.type === 'image') rich(block.alt, `${p}.alt`);
    if (block?.type === 'shape') rich(block.label, `${p}.label`);
    if (block?.type === 'graph') rich(block.title, `${p}.title`);
    if (block?.type === 'diagram' || block?.type === 'table') rich(block.caption, `${p}.caption`);
    if (block?.type === 'table') {
      list(block.headers).forEach((cell, i) => rich(cell, `${p}.headers[${i}]`));
      list(block.rows).forEach((row, i) => list(row).forEach((cell, j) => rich(cell, `${p}.rows[${i}][${j}]`)));
    }
  });
  const boxCheck = (value: unknown, path: string) => list(value).forEach((box, index) => {
    const p = `${path}[${index}]`; rich(box.label, `${p}.label`); rich(box.body, `${p}.body`); media(box.media, `${p}.media`);
  });
  for (const key of ['title', 'subtitle', 'description', 'subject']) rich(doc?.meta?.[key], `meta.${key}`);
  list(doc?.passages).forEach((passage, index) => {
    const p = `passages[${index}]`; for (const key of ['body', 'instruction', 'source', 'author', 'work']) rich(passage[key], `${p}.${key}`);
    media(passage.media, `${p}.media`); boxCheck(passage.boxes, `${p}.boxes`);
  });
  list(doc?.questions).forEach((question, index) => {
    const p = `questions[${index}]`; rich(question.prompt, `${p}.prompt`); boxCheck(question.boxes, `${p}.boxes`); media(question.media, `${p}.media`);
    list(question.choices).forEach((choice, i) => rich(choice, `${p}.choices[${i}]`));
    list(question.choiceMedia).forEach((blocks, i) => media(blocks, `${p}.choiceMedia[${i}]`));
    for (const key of ['intent', 'correct']) rich(question.explanation?.[key], `${p}.explanation.${key}`);
    list(question.explanation?.others).forEach((value, i) => rich(value, `${p}.explanation.others[${i}]`));
    media(question.explanation?.media, `${p}.explanation.media`);
  });
  list(doc?.entries).forEach((entry, index) => {
    const p = `entries[${index}]`;
    for (const key of ['term', 'reading', 'pos', 'definition', 'example', 'exampleMeaning', 'note', 'year', 'event', 'detail']) rich(entry[key], `${p}.${key}`);
    list(entry.meaning).forEach((value, i) => rich(value, `${p}.meaning[${i}]`));
  });
  return issues;
}

export { printStyles } from './styles.js';
export { preflightDocument, printPreflightScript } from './preflight.js';
import { printStyles } from './styles.js';

/** baseUrl is an application-controlled local asset directory, if CSS is external. */
export function getStandaloneHtml(doc: any, mode: RenderMode = 'questions', baseUrl?: string): string {
  const localBase = baseUrl && /^(?:file:|app:|iqv2:|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/)/i.test(baseUrl) ? baseUrl.replace(/\/$/, '') : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${assetCss ? '<meta name="iqv2-offline-assets" content="embedded">' : ''}<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data: file: app: iqv2: http://localhost:* http://127.0.0.1:*; style-src 'unsafe-inline' file: app: iqv2: http://localhost:* http://127.0.0.1:*; base-uri 'none'; form-action 'none'"><title>${escapeHtml(doc?.meta?.title ?? 'IQv2')}</title>${localBase && !assetCss ? `<link rel="stylesheet" href="${escapeHtml(localBase)}/render-assets.css">` : ''}<style>${assetCss}\n${printStyles}</style></head><body>${renderDocument(doc, mode)}</body></html>`;
}
