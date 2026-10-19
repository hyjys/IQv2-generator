import { validateIqv2 } from './vendor/validate.js'
import { inlineImageInfo, isQuestionScore, MAX_INLINE_TOTAL_BYTES, MAX_IQ_CONTENT_BYTES } from './vendor/media.js'
import type { IqContent, IqMediaDiagram } from './vendor/types.js'
import { collectMedia, inspectImages } from './assets.js'
import type { DocumentStats, ParseResult, ValidationIssue, ValidationReport } from './types.js'
import katex from 'katex'
import 'katex/contrib/mhchem'

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const emptyStats = (): DocumentStats => ({ questions: 0, entries: 0, passages: 0, totalPoints: 0, images: 0, imageBytes: 0 })
const statsFor = (input: unknown): DocumentStats => {
  const stats = emptyStats()
  if (!record(input)) return stats
  stats.questions = Array.isArray(input.questions) ? input.questions.length : 0
  stats.entries = Array.isArray(input.entries) ? input.entries.length : 0
  stats.passages = Array.isArray(input.passages) ? input.passages.length : 0
  if (Array.isArray(input.questions)) for (const q of input.questions) if (record(q) && isQuestionScore(q.points)) stats.totalPoints += q.points
  for (const { media } of collectMedia(input)) if (media.type === 'image') {
    stats.images++
    if (typeof media.src === 'string') stats.imageBytes += inlineImageInfo(media.src)?.bytes ?? 0
  }
  return stats
}
export function detectProfile(input: unknown): string {
  if (!record(input)) return 'unknown'
  if (input.kind === 'exam' && record(input.meta) && record(input.meta.exam) && ['mockmock', 'mockschool'].includes(String(input.meta.exam.kind))) return String(input.meta.exam.kind)
  return ['quiz', 'exam', 'vocab', 'timeline'].includes(String(input.kind)) ? String(input.kind) : 'unknown'
}

/** Canonical service validation + stricter self-contained authoring checks. Does not modify input. */
export function validateDocument(input: unknown): ValidationReport {
  const issues: ValidationIssue[] = []
  const error = (path: string, code: string, message: string) => issues.push({ severity: 'error', path, code, message })
  const warn = (path: string, code: string, message: string) => issues.push({ severity: 'warning', path, code, message })
  const report = (): ValidationReport => ({ valid: !issues.some(i => i.severity === 'error'), issues, stats: statsFor(input), profile: detectProfile(input) })
  try {
    const serialized = JSON.stringify(input)
    if (serialized === undefined) { error('$', 'JSON_VALUE', 'JSON 객체가 필요합니다.'); return report() }
    if (new TextEncoder().encode(serialized).length > MAX_IQ_CONTENT_BYTES) {
      error('$', 'DOCUMENT_SIZE', 'IQv2 문서는 UTF-8 기준 15MiB 이하여야 합니다.')
      return report()
    }
  } catch {
    error('$', 'JSON_VALUE', '순환 참조나 BigInt 등 JSON으로 저장할 수 없는 값이 있습니다.')
    // Do not inspect pathological cyclic drafts.
    return { valid: false, issues, stats: emptyStats(), profile: detectProfile(input) }
  }
  try {
    const canonical = validateIqv2(input)
    issues.push(...canonical.errors.map(issue => ({ ...issue, severity: 'error' as const })))
    issues.push(...canonical.warnings.map(issue => ({ ...issue, severity: 'warning' as const })))
  } catch {
    error('$', 'MALFORMED_STRUCTURE', '규격 검증기가 읽을 수 없는 문서 구조입니다. 배열·객체와 필수 필드를 확인하세요.')
  }
  if (!record(input)) return report()

  const checkOptional = (value: Record<string, unknown>, path: string, strings: string[] = [], booleans: string[] = [], stringArrays: string[] = []) => {
    for (const key of strings) if (value[key] !== undefined && typeof value[key] !== 'string') error(`${path}.${key}`, 'TYPE', '문자열이어야 합니다.')
    for (const key of booleans) if (value[key] !== undefined && typeof value[key] !== 'boolean') error(`${path}.${key}`, 'TYPE', '참/거짓 값이어야 합니다.')
    for (const key of stringArrays) if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].some((entry: unknown) => typeof entry !== 'string'))) error(`${path}.${key}`, 'TYPE', '문자열 배열이어야 합니다.')
  }
  const meta = record(input.meta) ? input.meta : {}
  checkOptional(meta, 'meta', ['title', 'subtitle', 'subject', 'description', 'language'], ['shuffleQuestions', 'shuffleChoices', 'leaderboard'], ['tags'])
  if (meta.mode !== undefined && meta.mode !== 'practice' && meta.mode !== 'exam') error('meta.mode', 'VALUE', '학습 모드는 practice 또는 exam이어야 합니다.')
  if (input.kind !== 'exam' && meta.exam !== undefined) error('meta.exam', 'PROFILE_KIND', '시험 표지 메타데이터는 kind: exam 문서에만 사용하세요.')
  if (input.kind !== 'vocab' && meta.vocab !== undefined) warn('meta.vocab', 'UNUSED_FIELD', '현재 콘텐츠 종류에서 사용하지 않는 단어 설정입니다.')
  if (input.kind !== 'timeline' && meta.timeline !== undefined) warn('meta.timeline', 'UNUSED_FIELD', '현재 콘텐츠 종류에서 사용하지 않는 연표 설정입니다.')
  if (input.kind === 'quiz' || input.kind === 'exam') {
    if (input.entries !== undefined) error('entries', 'KIND_FIELDS', '퀴즈·시험에는 entries 대신 questions를 사용하세요.')
  } else if (input.kind === 'vocab' || input.kind === 'timeline') {
    if (input.questions !== undefined) error('questions', 'KIND_FIELDS', '단어장·연표는 entries에서 문제를 생성하므로 questions를 넣지 마세요.')
    if (input.passages !== undefined) warn('passages', 'UNUSED_FIELD', '단어장·연표에서 공유 지문은 표시되지 않습니다.')
  }
  for (const key of ['totalQuestions', 'totalPoints', 'durationMinutes']) {
    if (input[key] !== undefined || meta[key] !== undefined) warn(input[key] !== undefined ? key : `meta.${key}`, 'LEGACY_FIELD', '옛 시험 규격 필드입니다. 문항 수·총점은 questions에서, 시간은 meta.timeLimitSec에서 계산합니다.')
  }

  if (input.kind === 'exam') {
    if (meta.revealPolicy !== 'atEnd') error('meta.revealPolicy', 'EXAM_REVEAL_REQUIRED', '시험의 revealPolicy를 atEnd로 명시하세요.')
    if (meta.mode !== 'exam') warn('meta.mode', 'EXAM_MODE', '시험은 mode: exam을 권장합니다.')
    for (const key of ['shuffleQuestions', 'shuffleChoices']) if (meta[key] === true) warn(`meta.${key}`, 'EXAM_SHUFFLE', '인쇄 시험의 번호·선택지 배열을 유지하려면 섞기를 끄세요.')
    if (record(meta.exam)) {
      if (!text(meta.subject)) warn('meta.subject', 'EXAM_SUBJECT', '출제 과목을 입력하고 실제 기출·범위 자료와 대조하세요.')
      if (meta.exam.kind === 'mockschool' && !text(meta.exam.organization)) error('meta.exam.organization', 'SCHOOL_REQUIRED', '모의내신의 학교명을 입력하세요.')
      if (meta.exam.kind === 'mockmock' && (!text(meta.exam.system) || !/^\d{4}$/.test(meta.exam.system))) warn('meta.exam.system', 'TARGET_YEAR', '시행 연도와 구별되는 목표 시험 학년도(예: 2028)를 직접 확인해 입력하세요.')
      if (meta.exam.signaturePhrase === undefined) warn('meta.exam.signaturePhrase', 'SIGNATURE_CHOICE', '필적 문구를 입력하거나 표지에서 빈칸 사용을 확인하세요. 빈칸이면 이 필드를 생략합니다.')
    }
  }

  const questions = Array.isArray(input.questions) ? input.questions : []
  const questionNumbers = new Set(questions.filter(record).map(q => q.number))
  questions.forEach((q, index) => {
    if (!record(q)) return
    const path = `questions[${index}]`
    checkOptional(q, path, ['prompt'], ['shuffle'], ['tags', 'answerText', 'choices'])
    if (q.passageId !== undefined && q.passageId !== null && !text(q.passageId)) error(`${path}.passageId`, 'TYPE', '지문 참조는 비어 있지 않은 id 또는 null이어야 합니다.')
    if (input.kind === 'exam' && q.number !== index + 1) error(`${path}.number`, 'EXAM_SEQUENCE', `시험 문항은 배열 순서대로 1부터 연속 번호여야 합니다. 이 위치는 ${index + 1}번입니다.`)
    if (q.matchMode !== undefined && q.matchMode !== 'exact' && q.matchMode !== 'normalized') error(`${path}.matchMode`, 'VALUE', '정답 비교는 exact 또는 normalized여야 합니다.')
    if (Array.isArray(q.choices) && q.choices.every(text)) {
      const choices = q.choices as string[]
      const signatures = choices.map((choice, i) => `${choice.trim()}\0${JSON.stringify(Array.isArray(q.choiceMedia) ? q.choiceMedia[i] ?? [] : [])}`)
      if (new Set(signatures).size !== signatures.length) error(`${path}.choices`, 'DUPLICATE_CHOICES', '자료까지 같은 선택지가 중복되어 정답을 구별할 수 없습니다.')
      if (choices.some(choice => /^[①②③④⑤]\s*/.test(choice))) warn(`${path}.choices`, 'CHOICE_PREFIX', '선택지 번호는 렌더러가 붙입니다. 본문 앞의 ①~⑤를 지우세요.')
      if (q.type === 'OX' && choices.length !== 2) error(`${path}.choices`, 'OX_CHOICES', 'OX 선택지를 직접 넣을 때에는 O·X 두 개만 넣으세요.')
      if (q.type === '순서 배열' && Array.isArray(q.answerText) && q.answerText.every(text)) {
        const answers = q.answerText as string[]
        const remaining = [...choices]
        for (const answer of answers) {
          const found = remaining.indexOf(answer)
          if (found < 0) { error(`${path}.answerText`, 'ORDER_PERMUTATION', '순서 배열의 정답은 선택지 텍스트를 각각 한 번씩 모두 포함해야 합니다.'); return }
          remaining.splice(found, 1)
        }
        if (remaining.length) error(`${path}.answerText`, 'ORDER_PERMUTATION', '순서 배열 정답에 빠진 선택지가 있습니다.')
      }
    }
    if (q.type === '서술형') {
      if (!Array.isArray(q.answerText) || !q.answerText.length || q.answerText.some(answer => !text(answer))) error(`${path}.answerText`, 'MODEL_ANSWER_REQUIRED', '독립 검토를 위해 서술형 모범답안을 비어 있지 않은 문자열 배열로 입력하세요.')
      warn(`${path}.explanation`, 'ESSAY_REVIEW', '서술형은 단계별 채점 기준과 부분 점수를 사람이 검토해야 합니다.')
    }
    if (Array.isArray(q.answerText) && q.answerText.every(text) && q.type !== '순서 배열' && new Set(q.answerText).size !== q.answerText.length) warn(`${path}.answerText`, 'DUPLICATE_ANSWERS', '허용 답안이 중복됩니다.')
    if (record(q.explanation)) checkOptional(q.explanation, `${path}.explanation`, ['intent', 'correct'], [], ['others'])
  })
  const passages = Array.isArray(input.passages) ? input.passages : []
  passages.forEach((p, index) => {
    if (!record(p)) return
    const path = `passages[${index}]`
    checkOptional(p, path, ['id', 'body', 'instruction', 'source', 'author', 'work'])
    if (!questions.some(q => record(q) && q.passageId === p.id)) warn(`${path}.id`, 'UNUSED_PASSAGE', '이 지문을 참조하는 문항이 없습니다.')
    if (Array.isArray(p.range) && p.range.length === 2 && p.range.every(finite)) {
      if (!questionNumbers.has(p.range[0]) || !questionNumbers.has(p.range[1])) error(`${path}.range`, 'PASSAGE_RANGE', '지문 범위의 시작·끝 번호에 실제 문항이 있어야 합니다.')
      questions.forEach((q, qIndex) => {
        if (record(q) && q.passageId === p.id && finite(q.number) && (q.number < Number((p.range as unknown[])[0]) || q.number > Number((p.range as unknown[])[1]))) error(`questions[${qIndex}].passageId`, 'PASSAGE_RANGE', '참조 문항 번호가 지문의 range 밖에 있습니다.')
      })
    }
  })

  const entries = Array.isArray(input.entries) ? input.entries : []
  if (input.kind === 'vocab') {
    if (entries.length > 0 && entries.length < 5) warn('entries', 'VOCAB_DISTRACTORS', '5지선다 오답 구성을 위해 구별되는 단어를 5개 이상 준비하세요.')
    const directions = record(meta.vocab) && Array.isArray(meta.vocab.testDirections) ? meta.vocab.testDirections : []
    const terms = new Set<string>()
    entries.forEach((e, index) => {
      if (!record(e)) return
      const path = `entries[${index}]`
      checkOptional(e, path, ['term', 'reading', 'pos', 'definition', 'example', 'exampleMeaning', 'note', 'category'])
      if (directions.includes('definition2term') && !text(e.definition)) error(`${path}.definition`, 'VOCAB_DEFINITION', '정의→단어 방향을 사용하려면 모든 단어에 definition이 있어야 합니다.')
      if (text(e.term)) { if (terms.has(e.term.trim())) warn(`${path}.term`, 'DUPLICATE_TERM', '같은 단어가 여러 항목에 있습니다. 학습 방향별 정답 구별을 확인하세요.'); terms.add(e.term.trim()) }
    })
  }
  if (input.kind === 'timeline') {
    if (record(meta.timeline)) checkOptional(meta.timeline, 'meta.timeline', ['eraLabel'])
    const orderMode = record(meta.timeline) && Array.isArray(meta.timeline.modes) && meta.timeline.modes.includes('orderQuiz')
    if (orderMode && entries.length < 2) error('entries', 'TIMELINE_ORDER_COUNT', '순서 퀴즈에는 사건이 두 개 이상 필요합니다.')
    const events = new Set<string>(), sorts = new Set<number>()
    entries.forEach((e, index) => {
      if (!record(e)) return
      const path = `entries[${index}]`
      checkOptional(e, path, ['year', 'event', 'detail'], [], ['yearAnswer', 'category'])
      if (Array.isArray(e.yearAnswer) && (!e.yearAnswer.length || e.yearAnswer.some(a => !text(a)))) error(`${path}.yearAnswer`, 'TIMELINE_ANSWER', '허용 연도 답안은 비어 있지 않은 문자열 배열이어야 합니다.')
      const previous = entries[index - 1]
      if (record(previous) && finite(previous.sortKey) && finite(e.sortKey) && e.sortKey < previous.sortKey) error(`${path}.sortKey`, 'TIMELINE_ORDER', '연표 항목을 sortKey의 시간순으로 정렬하세요.')
      if (orderMode && text(e.event) && events.has(e.event.trim())) error(`${path}.event`, 'TIMELINE_EVENT_DUPLICATE', '순서 퀴즈의 사건명은 서로 구별되어야 합니다.')
      if (orderMode && finite(e.sortKey) && sorts.has(e.sortKey)) warn(`${path}.sortKey`, 'TIMELINE_TIE', '같은 정렬값의 사건 순서는 모호할 수 있습니다. 실제 발생 순서·퀴즈 모드를 검토하세요.')
      if (text(e.event)) events.add(e.event.trim())
      if (finite(e.sortKey)) sorts.add(e.sortKey)
    })
  }

  issues.push(...inspectImages(input))
  const stats = statsFor(input)
  if (stats.imageBytes > MAX_INLINE_TOTAL_BYTES && !issues.some(i => i.code === 'MEDIA_SIZE' && i.path === '$')) error('$', 'MEDIA_SIZE', '내장 이미지 합계는 8MiB 이하여야 합니다.')
  if (stats.images) warn('$', 'PIXEL_DECODE_REQUIRED', '이미지 헤더·크기를 검사했습니다. 내보내기 전 픽셀 해독 검증도 완료해야 합니다.')
  for (const { media, path } of collectMedia(input)) {
    if (media.type === 'diagram') issues.push(...checkDiagramGeometry(media, path))
    if (media.type === 'math' && typeof media.latex === 'string' && media.latex.length <= 20_000) {
      try { katex.renderToString(media.latex, { displayMode: media.display ?? true, trust: false, throwOnError: true, strict: 'ignore', maxExpand: 1_000, maxSize: 20 }) }
      catch (cause) { error(`${path}.latex`, 'MATH_RENDER', `수식을 렌더링할 수 없습니다: ${cause instanceof Error ? cause.message : String(cause)}`) }
    }
  }
  warn('$', 'CONTENT_REVIEW', '자동 검증은 형식·정답 구조·자료를 검사합니다. 사실·교육과정·정답 유일성·출처 및 실제 인쇄 결과는 검토가 필요합니다.')
  return { valid: !issues.some(i => i.severity === 'error'), issues, stats, profile: detectProfile(input) }
}

/** Font-independent geometry checks. Text extents are conservative estimates, reported as warnings. */
export function checkDiagramGeometry(diagram: IqMediaDiagram, path = 'diagram'): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!finite(diagram.width) || !finite(diagram.height) || !Array.isArray(diagram.elements)) return issues
  const add = (index: number, severity: 'error' | 'warning', code: string, message: string) => issues.push({ severity, path: `${path}.elements[${index}]`, code, message })
  diagram.elements.forEach((el, index) => {
    if (!record(el)) return
    const pad = (finite(el.strokeWidth) ? el.strokeWidth : 1.5) / 2 + (el.type === 'arrow' ? 6 : 0)
    let bounds: [number, number, number, number] | undefined
    if ((el.type === 'line' || el.type === 'arrow') && [el.x1, el.y1, el.x2, el.y2].every(finite)) bounds = [Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.max(el.x1, el.x2), Math.max(el.y1, el.y2)]
    if (el.type === 'circle' && [el.cx, el.cy, el.r].every(finite)) bounds = [el.cx - el.r, el.cy - el.r, el.cx + el.r, el.cy + el.r]
    if (el.type === 'ellipse' && [el.cx, el.cy, el.rx, el.ry].every(finite)) bounds = [el.cx - el.rx, el.cy - el.ry, el.cx + el.rx, el.cy + el.ry]
    if (el.type === 'rect' && [el.x, el.y, el.width, el.height].every(finite)) bounds = [el.x, el.y, el.x + el.width, el.y + el.height]
    if ((el.type === 'polygon' || el.type === 'polyline') && Array.isArray(el.points) && el.points.length && el.points.length <= 500 && el.points.every(p => Array.isArray(p) && p.length === 2 && p.every(finite))) {
      bounds = [Math.min(...el.points.map(p => p[0])), Math.min(...el.points.map(p => p[1])), Math.max(...el.points.map(p => p[0])), Math.max(...el.points.map(p => p[1]))]
    }
    if (el.type === 'text' && finite(el.x) && finite(el.y) && typeof el.text === 'string') {
      const size = finite(el.fontSize) ? el.fontSize : 16
      let width = 0
      for (const char of el.text) width += /[\u0000-\u00ff]/.test(char) ? size * 0.62 : size
      const left = el.anchor === 'end' ? el.x - width : el.anchor === 'middle' ? el.x - width / 2 : el.x
      if (el.x < 0 || el.x > diagram.width || el.y < 0 || el.y > diagram.height) add(index, 'error', 'DIAGRAM_TEXT_ANCHOR', '글자 기준점이 도형 영역 밖에 있습니다.')
      if (left < 8 || left + width > diagram.width - 8 || el.y - size * 1.25 < 8 || el.y + size * 0.3 > diagram.height - 8) add(index, 'warning', 'DIAGRAM_TEXT_MARGIN', '글자 폭·기준선·8px 인쇄 여백이 부족할 수 있습니다. Noto CJK 글꼴로 실제 문제지와 해설지를 확인하세요.')
      if (/<\/?[a-z][^>]*>/i.test(el.text) || /\$|\\(?:frac|sqrt|sum)\b/.test(el.text)) add(index, 'warning', 'DIAGRAM_PLAIN_TEXT', 'diagram의 글자는 일반 문자열입니다. 복잡한 수식은 별도 math 자료로 옮기세요.')
      return
    }
    if (bounds && bounds.every(finite)) {
      if (bounds[0] < 0 || bounds[1] < 0 || bounds[2] > diagram.width || bounds[3] > diagram.height) add(index, 'error', 'DIAGRAM_BOUNDS', '도형의 일부가 width·height 좌표 영역 밖에 있습니다.')
      else if (bounds[0] - pad < 8 || bounds[1] - pad < 8 || bounds[2] + pad > diagram.width - 8 || bounds[3] + pad > diagram.height - 8) add(index, 'warning', 'DIAGRAM_MARGIN', '선 두께·화살촉을 포함한 외곽 8px 인쇄 여백을 확보하세요.')
    }
  })
  return issues
}

/** Strict JSON: no Markdown fences/comments/trailing commas. UTF-8 BOM files are accepted. */
export function parseDocument(source: string): ParseResult {
  if (new TextEncoder().encode(source).length > MAX_IQ_CONTENT_BYTES) return { valid: false, issues: [{ severity: 'error', path: '$', code: 'DOCUMENT_SIZE', message: 'IQv2 JSON은 UTF-8 기준 15MiB 이하여야 합니다.' }], stats: emptyStats(), profile: 'unknown' }
  try {
    const input: unknown = JSON.parse(source.charCodeAt(0) === 0xfeff ? source.slice(1) : source)
    const report = validateDocument(input)
    return { ...report, document: record(input) ? input as unknown as IqContent : undefined }
  } catch (error) {
    return { valid: false, issues: [{ severity: 'error', path: '$', code: 'JSON_PARSE', message: `JSON을 읽을 수 없습니다: ${error instanceof Error ? error.message : String(error)}` }], stats: emptyStats(), profile: 'unknown' }
  }
}
