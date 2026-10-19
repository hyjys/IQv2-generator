import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDocument, validateDocument, validateIqv2, collectMedia, createTemplate, type IqContent, type IqMedia } from '../src/core/index.js'
import { renderDocument, getStandaloneHtml, validateRenderDocument } from '../src/render/index.js'

const cases = [
  ['iqv2-quiz.json', 'iqv2-generator/references/examples/quiz.json'],
  ['iqv2-exam.json', 'iqv2-generator/references/examples/exam.json'],
  ['iqv2-vocab.json', 'iqv2-generator/references/examples/vocab.json'],
  ['iqv2-timeline.json', 'iqv2-generator/references/examples/timeline.json'],
  ['mockmock-exam.json', 'mockmocktest/references/example.json'],
  ['mockschool-exam.json', 'mockschooltest/references/example.json'],
] as const
const fixture = (file: string): IqContent => JSON.parse(readFileSync(new URL(`fixtures/${file}`, import.meta.url), 'utf8'))
const hasError = (value: unknown, code: string) => validateDocument(value).issues.some(issue => issue.severity === 'error' && issue.code === code)

for (const [file, original] of cases) {
  test(`bundled skill compatibility: ${file}`, () => {
    const bytes = readFileSync(new URL(`fixtures/${file}`, import.meta.url))
    const source = readFileSync(new URL(`../resources/skills/${original}`, import.meta.url))
    assert.deepEqual(bytes, source, 'fixture keeps the upstream example unchanged')
    const parsed = parseDocument(bytes.toString('utf8'))
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues.filter(issue => issue.severity === 'error')))
    const doc = parsed.document!
    assert.equal(validateIqv2(doc).ok, true)
    assert.deepEqual(validateRenderDocument(doc), [])
    const before = structuredClone(doc)
    for (const mode of ['questions', 'answers', 'study'] as const) {
      const rendered = getStandaloneHtml(doc, mode)
      assert.match(rendered, /^<!doctype html>/)
      assert.ok(rendered.includes(doc.meta.title))
      assert.doesNotMatch(rendered, /class="katex-error"|<script\b|src="https?:/)
    }
    const roundtrip = parseDocument(JSON.stringify(doc, null, 2))
    assert.equal(roundtrip.valid, true)
    assert.deepEqual(roundtrip.document, before)
    assert.deepEqual(doc, before, 'rendering and validation do not mutate optional fields')
  })
}

test('upstream mockschool demo discrepancy is documented rather than silently relabeled', () => {
  const mockschoolDemo = fixture('mockschool-exam.json')
  assert.equal(mockschoolDemo.meta.exam?.kind, 'mockmock')
  assert.equal(mockschoolDemo.meta.exam?.organization, undefined)
  assert.deepEqual(mockschoolDemo, fixture('mockmock-exam.json'))
  assert.equal(createTemplate('mockschool').meta.exam?.kind, 'mockschool')
  assert.ok(createTemplate('mockschool').meta.exam?.organization)
})

test('actual exam samples project tables, graphs, diagram labels and all five choice media', () => {
  const doc = fixture('iqv2-exam.json')
  const locations = collectMedia(doc)
  for (const type of ['table', 'graph', 'diagram', 'shape', 'math']) assert.ok(locations.some(location => location.media.type === type), type)
  const questionHtml = renderDocument(doc, 'questions')
  const answerHtml = renderDocument(doc, 'answers')
  for (const kind of ['table', 'graph', 'diagram']) assert.match(questionHtml, new RegExp(`data-media-kind="${kind}"`))
  assert.equal((questionHtml.match(/data-media-kind="shape"/g) ?? []).length, 5)
  assert.match(answerHtml, /피타고라스/)
  assert.doesNotMatch(questionHtml, /피타고라스 정리에 의해/)
  assert.equal(validateDocument(doc).stats.totalPoints, 8)
})

test('optional metadata, nested answer media, CJK IVS and accepted answers survive repeated round trips', () => {
  const doc = fixture('iqv2-exam.json')
  Object.assign(doc.meta, { subtitle: '왕복 검사', description: '확인용', tags: ['자료', 'CJK'], difficulty: 3, minSolveTimeSec: 2, leaderboard: false })
  Object.assign(doc.meta.exam!, { grade: 2, confidential: true, periodLabel: '제 2 교시', signaturePhrase: '바른 글씨로 씁니다.' })
  Object.assign(doc.passages![0], { source: '사용자가 제공한 가상 측정 자료', author: '예제 작성자', work: '자료 읽기', instruction: '문항 2에 답하시오.' })
  Object.assign(doc.questions![0], { answerText: ['5', '5.0'], timeLimitSec: 120, minSolveTimeSec: 1, shuffle: false, tags: ['기하'] })
  doc.questions![0].explanation.others = ['허용 답안은 문자열 그대로 보존한다.']
  doc.questions![0].boxes = [{ label: '문자', body: '<span lang="ja">葛\u{E0100}飾</span>', media: [{ type: 'paragraph', text: '<ruby lang="ja">学校<rt>がっこう</rt></ruby>' }] }]
  const expected = structuredClone(doc)
  let value = doc
  for (let iteration = 0; iteration < 3; iteration++) {
    const parsed = parseDocument(JSON.stringify(value))
    assert.equal(parsed.valid, true)
    value = parsed.document!
    renderDocument(value, 'questions'); renderDocument(value, 'answers')
  }
  assert.deepEqual(value, expected)
  assert.match(renderDocument(value, 'questions'), /葛\u{E0100}飾/u)
})

test('invalid JSON shapes remain validation reports rather than escaping exceptions', () => {
  const invalid: unknown[] = [
    null, 'bad', 0, [], { schemaVersion: '2.0', kind: 'quiz', meta: null, questions: {} },
    { ...createTemplate('quiz'), questions: [null] },
    { ...createTemplate('quiz'), questions: ['문항'] },
    { ...createTemplate('quiz'), passages: { id: 'p' } },
    { ...createTemplate('timeline'), entries: [null] },
    { ...createTemplate('vocab'), entries: 'word' },
  ]
  for (const value of invalid) {
    const parsed = parseDocument(JSON.stringify(value))
    assert.equal(parsed.valid, false)
    assert.ok(parsed.issues.some(issue => issue.severity === 'error'))
    assert.doesNotThrow(() => validateDocument(value))
  }
})

test('malformed optional arrays and unsupported media cannot be certified as valid', () => {
  const invalidMedia: unknown[] = [
    { type: 'diagram', width: 200, height: 100, elements: [{ type: 'polygon', points: 'bad' }] },
    { type: 'graph', graphType: 'bar', points: [{ label: 'x', value: 1 }] },
    { type: 'table', headers: ['A', 'B'], rows: [['single column']] },
    { type: 'image', src: 'data:image/png;base64,YQ==', alt: 'fake' },
    { type: 'svg', data: '<svg />' },
    null,
  ]
  for (const media of invalidMedia) {
    const doc = createTemplate('quiz')
    doc.questions![0].media = [media as IqMedia]
    assert.doesNotThrow(() => assert.equal(validateDocument(doc).valid, false))
  }
  const doc = createTemplate('quiz')
  doc.questions![0].type = 'OX'; doc.questions![0].choices = [1, 2] as unknown as string[]
  assert.ok(hasError(doc, 'TYPE'))
})

test('oversized invalid polygon drafts do not overflow the JavaScript argument stack', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].media = [{ type: 'diagram', width: 100, height: 100, elements: [{ type: 'polygon', points: Array.from({ length: 150_000 }, () => [10, 10] as [number, number]) }] }]
  assert.doesNotThrow(() => assert.equal(validateDocument(doc).valid, false))
})

test('invalid scores never leak non-finite totals into machine-readable reports', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].points = Number.MAX_VALUE
  doc.questions![1].points = Number.MAX_VALUE
  const report = validateDocument(doc)
  assert.equal(report.valid, false)
  assert.equal(Number.isFinite(report.stats.totalPoints), true)
  assert.ok(hasError(doc, 'POINTS'))
})
