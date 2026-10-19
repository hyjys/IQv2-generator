import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { createTemplate, validateDocument, parseDocument, collectMedia, encodeRaster, rasterHeader, validateRasterDecoding, validateIqv2, inlineImageInfo, type IqContent, type Profile } from '../src/core/index.js'

const codes = (document: unknown) => validateDocument(document).issues.filter(i => i.severity === 'error').map(i => i.code)
const imageDoc = (src: string): IqContent => {
  const doc = createTemplate('quiz')
  doc.questions![0].media = [{ type: 'image', src, alt: '작은 테스트 이미지' }]
  return doc
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function png(width = 1, height = 1): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
    return Buffer.concat([length, name, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))])
}

test('all six starter profiles pass the canonical and standalone validators', () => {
  for (const profile of ['quiz', 'exam', 'vocab', 'timeline', 'mockmock', 'mockschool'] as Profile[]) {
    const document = createTemplate(profile)
    assert.equal(validateIqv2(document).ok, true, profile)
    assert.deepEqual(codes(document), [], profile)
    assert.equal(validateDocument(document).profile, profile)
  }
})
test('starter documents are independent fresh objects', () => {
  const first = createTemplate('quiz'); first.questions![0].choices![0] = '변경'
  assert.equal(createTemplate('quiz').questions![0].choices![0], '8')
})
test('strict JSON parser supports UTF-8 BOM and exposes invalid drafts', () => {
  const parsed = parseDocument('\ufeff' + JSON.stringify(createTemplate('quiz')))
  assert.equal(parsed.valid, true)
  const draft = parseDocument('{"schemaVersion":"2.0","kind":"quiz","meta":{"title":"초안"},"questions":[]}')
  assert.equal(draft.valid, false)
  assert.ok(draft.document)
  assert.equal(parseDocument('```json\n{}\n```').issues[0].code, 'JSON_PARSE')
  assert.equal(parseDocument('{"x":1,}').issues[0].code, 'JSON_PARSE')
  assert.equal(parseDocument('[]').valid, false)
})
test('malformed and cyclic structures produce errors without throwing', () => {
  for (const value of [null, 3, true, [], {}, { kind: 'exam', meta: 'bad', questions: [{ media: {}, boxes: 3 }] }]) assert.doesNotThrow(() => assert.equal(validateDocument(value).valid, false))
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic
  assert.equal(validateDocument(cyclic).issues[0].code, 'JSON_VALUE')
})
test('UTF-8 15 MiB document limit is enforced before parsing', () => {
  const result = parseDocument('한'.repeat(6 * 1024 * 1024))
  assert.equal(result.issues[0].code, 'DOCUMENT_SIZE')
})
test('questions retain half-point scoring and one-based answers', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].points = 1.5
  assert.equal(validateDocument(doc).valid, true)
  doc.questions![0].points = 1.25
  doc.questions![0].answer = 0
  assert.ok(codes(doc).includes('POINTS'))
  assert.ok(codes(doc).includes('ANSWER'))
})
test('all canonical answer types validate and OX shape is checked', () => {
  const doc = createTemplate('quiz')
  doc.questions = [
    { number: 1, points: 1, type: 'OX', prompt: '1은 자연수다.', answer: 1, explanation: { correct: '1은 자연수다.' } },
    { number: 2, points: 1, type: '서술형', prompt: '이유를 설명하시오.', answerText: ['정의에 따라 설명한다.'], explanation: { correct: '정의를 쓰면 1점이다.' } },
    { number: 3, points: 1, type: '순서 배열', prompt: '작은 순서로 배열하시오.', choices: ['2', '1', '3'], answerText: ['1', '2', '3'], explanation: { correct: '1<2<3이다.' } },
  ]
  assert.equal(validateDocument(doc).valid, true)
  doc.questions[0].choices = ['O', 'X', '기타']
  assert.ok(codes(doc).includes('OX_CHOICES'))
})
test('exam sequence, explicit end reveal, and school identity are required', () => {
  const doc = createTemplate('mockschool')
  doc.questions![1].number = 3
  delete doc.meta.revealPolicy
  delete doc.meta.exam!.organization
  const errors = codes(doc)
  assert.ok(errors.includes('EXAM_SEQUENCE'))
  assert.ok(errors.includes('EXAM_REVEAL_REQUIRED'))
  assert.ok(errors.includes('SCHOOL_REQUIRED'))
})
test('choice duplication accounts for choice media', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].choices = ['그림', '그림', '세 번째', '네 번째', '다섯 번째']
  assert.ok(codes(doc).includes('DUPLICATE_CHOICES'))
  doc.questions![0].choiceMedia = [[{ type: 'shape', shape: 'circle' }], [{ type: 'shape', shape: 'rectangle' }], [], [], []]
  assert.ok(!codes(doc).includes('DUPLICATE_CHOICES'))
})
test('ordering answers must include each choice exactly once', () => {
  const doc = createTemplate('quiz')
  const q = doc.questions![0]
  q.type = '순서 배열'; delete q.answer; q.choices = ['가', '나', '다']; q.answerText = ['가', '나', '나']
  assert.ok(codes(doc).includes('ORDER_PERMUTATION'))
  q.answerText = ['다', '가', '나']
  assert.equal(validateDocument(doc).valid, true)
})
test('optional schema fields reject incompatible JSON types', () => {
  const doc = createTemplate('quiz') as unknown as Record<string, unknown>
  ;(doc.meta as Record<string, unknown>).shuffleChoices = 'false'
  ;(doc.questions as Record<string, unknown>[])[0].tags = [12]
  assert.ok(codes(doc).filter(c => c === 'TYPE').length >= 2)
})
test('question/entry kinds cannot silently mix', () => {
  const doc = createTemplate('vocab')
  doc.questions = createTemplate('quiz').questions
  assert.ok(codes(doc).includes('KIND_FIELDS'))
})
test('shared passage references and declared ranges are verified', () => {
  const doc = createTemplate('exam')
  doc.passages = [{ id: 'p1', body: '지문', range: [1, 1] }]
  doc.questions![1].passageId = 'p1'
  assert.ok(codes(doc).includes('PASSAGE_RANGE'))
  doc.passages[0].range = [1, 2]
  assert.equal(validateDocument(doc).valid, true)
  doc.questions![1].passageId = 'missing'
  assert.ok(codes(doc).includes('REFERENCE'))
})
test('definition direction requires all vocabulary definitions', () => {
  const doc = createTemplate('vocab')
  delete (doc.entries![0] as { definition?: string }).definition
  assert.ok(codes(doc).includes('VOCAB_DEFINITION'))
})
test('timeline requires chronological sort keys and unambiguous ordering labels', () => {
  const doc = createTemplate('timeline')
  ;(doc.entries![1] as { sortKey: number }).sortKey = 1200
  ;(doc.entries![2] as { event: string }).event = (doc.entries![0] as { event: string }).event
  assert.ok(codes(doc).includes('TIMELINE_ORDER'))
  assert.ok(codes(doc).includes('TIMELINE_EVENT_DUPLICATE'))
})
test('all nested image positions are collected and server references rejected', () => {
  const image = { type: 'image' as const, src: 'iq://u/0123456789abcdef0123456789ABCDEF', alt: '사진' }
  const doc = createTemplate('quiz')
  doc.passages = [{ id: 'p1', body: '지문', media: [image], boxes: [{ label: '자료', body: '', media: [image] }] }]
  doc.questions![0].passageId = 'p1'
  doc.questions![0].media = [image]
  doc.questions![0].boxes = [{ label: '보기', body: '', media: [image] }]
  doc.questions![0].explanation.media = [image]
  doc.questions![0].choiceMedia = [[image], [], [], [], []]
  assert.equal(collectMedia(doc).filter(x => x.media.type === 'image').length, 6)
  assert.equal(codes(doc).filter(code => code === 'UNRESOLVED_IMAGE').length, 6)
  assert.equal(validateDocument(doc).stats.images, 6)
})
test('image MIME, signatures, full chunk framing, and decoded size are verified', () => {
  const data = encodeRaster(png(), 'image/png')
  assert.deepEqual(rasterHeader(data), { width: 1, height: 1 })
  assert.equal(validateDocument(imageDoc(data)).valid, true)
  assert.ok(codes(imageDoc(encodeRaster(png(), 'image/jpeg'))).includes('IMAGE_SIGNATURE'))
  assert.ok(codes(imageDoc(encodeRaster(png().subarray(0, 33), 'image/png'))).includes('IMAGE_SIGNATURE'))
  assert.ok(codes(imageDoc(encodeRaster(png(20_000), 'image/png'))).includes('IMAGE_DIMENSIONS'))
  assert.equal(inlineImageInfo('data:image/png;base64,YR=='), null, 'noncanonical padding bits rejected')
})
test('remote, fake, SVG, oversized and whitespace-padded base64 images fail canonical validation', () => {
  for (const src of ['https://example.org/a.png', 'file:///a.png', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64, AA==', encodeRaster(new Uint8Array(2 * 1024 * 1024 + 1), 'image/png')]) assert.equal(validateDocument(imageDoc(src)).valid, false)
})
test('full raster decoder verifies actual pixels and deduplicates byte-identical images', async () => {
  const src = encodeRaster(png(), 'image/png')
  const doc = imageDoc(src)
  doc.questions![1].media = [{ type: 'image', src, alt: '같은 사진' }]
  let calls = 0
  assert.deepEqual(await validateRasterDecoding(doc, async () => { calls++; return { width: 1, height: 1 } }), [])
  assert.equal(calls, 1)
  assert.equal((await validateRasterDecoding(doc, async () => { throw new Error('bad compression') }))[0].code, 'IMAGE_DECODE')
  assert.equal((await validateRasterDecoding(doc, async () => ({ width: 2, height: 1 })))[0].code, 'IMAGE_DECODE_DIMENSIONS')
})
test('diagram geometry errors and baseline/margin estimates are separate', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].media = [{ type: 'diagram', width: 200, height: 100, elements: [{ type: 'circle', cx: 195, cy: 50, r: 20 }, { type: 'text', x: 5, y: 5, text: '긴 제목', fontSize: 18 }] }]
  const report = validateDocument(doc)
  assert.ok(report.issues.some(i => i.code === 'DIAGRAM_BOUNDS' && i.severity === 'error'))
  assert.ok(report.issues.some(i => i.code === 'DIAGRAM_TEXT_MARGIN' && i.severity === 'warning'))
})
test('KaTeX parses math with mhchem and rejects invalid formulas', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].media = [{ type: 'math', latex: '\\ce{H2O}' }]
  assert.equal(validateDocument(doc).valid, true)
  doc.questions![0].media = [{ type: 'math', latex: '\\frac{1}{' }]
  assert.ok(codes(doc).includes('MATH_RENDER'))
})
test('validation statistics include exact half-point sums and retain content review limits', () => {
  const doc = createTemplate('quiz')
  doc.questions![0].points = 1.5
  const report = validateDocument(doc)
  assert.equal(report.stats.totalPoints, 4.5)
  assert.ok(report.issues.some(i => i.code === 'CONTENT_REVIEW' && i.severity === 'warning'))
  assert.deepEqual(doc, structuredClone(doc), 'no mutations')
})
test('vendored canonical files keep the audited upstream byte identity', () => {
  const expected = {
    'media.ts': 'C005D94E91409B4899C4403893601A9561BE8D72012B5DA25E1CC664ABA454EA',
    'types.ts': '7F2F9295310BCDE034009EF40361F926A221F3E26B629D93503BFD6DDDE6A5B6',
    'validate.ts': 'ABC85588E3CB0362660CB3539FD04FCB730384B35C5A19663107A4D28EAAFFCD',
  }
  for (const [file, hash] of Object.entries(expected)) {
    const bytes = readFileSync(new URL(`../src/core/vendor/${file}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), hash, file)
  }
})
