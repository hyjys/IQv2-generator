import type { IqContent, IqQuestion } from './vendor/types.js'
import type { Profile } from './types.js'

/** Complete educational examples, kept separate from the user's authoring/source evidence. */
const sampleQuestions = (): IqQuestion[] => [
  {
    number: 1, points: 2, type: '5지선다',
    prompt: '다음 수식을 계산한 값은?',
    media: [{ type: 'math', latex: '2^3 + 4', display: true }],
    choices: ['8', '10', '12', '14', '16'], answer: 3,
    explanation: { correct: '$2^3=8$이므로 $8+4=12$이다.', others: ['거듭제곱을 먼저 계산한 뒤 4를 더한다.'] },
    tags: ['예제', '수와 연산'],
  },
  {
    number: 2, points: 3, type: '단답형',
    prompt: '표의 월요일과 화요일 독서 시간의 합을 분 단위의 숫자로 쓰시오.',
    media: [{ type: 'table', headers: ['요일', '독서 시간(분)'], rows: [['월요일', '20'], ['화요일', '30']], caption: '이틀간의 독서 시간' }],
    answerText: ['50'], matchMode: 'exact',
    explanation: { correct: '월요일 20분과 화요일 30분을 더하면 50분이다.' },
    tags: ['예제', '자료 읽기'],
  },
]

export function createTemplate(profile: Profile): IqContent {
  if (profile === 'vocab') return {
    schemaVersion: '2.0', kind: 'vocab',
    meta: { title: '기초 영어 단어장 · 예제', language: 'ko', subject: '영어', description: '편집 방법을 익히기 위한 완성 예제입니다. 실제 학습 범위에 맞게 수정하세요.', vocab: { sourceLang: 'en', targetLang: 'ko', testDirections: ['term2meaning', 'meaning2term', 'definition2term'] } },
    entries: [
      { id: 1, term: 'apple', meaning: ['사과'], pos: '명사', definition: 'A round fruit that grows on a tree.', example: 'I eat an apple.', exampleMeaning: '나는 사과 한 개를 먹는다.', category: '음식' },
      { id: 2, term: 'book', meaning: ['책'], pos: '명사', definition: 'A set of printed pages held together in a cover.', example: 'This book is interesting.', exampleMeaning: '이 책은 흥미롭다.', category: '학교' },
      { id: 3, term: 'water', meaning: ['물'], pos: '명사', definition: 'The clear liquid that people drink.', example: 'Please drink some water.', exampleMeaning: '물을 조금 마시세요.', category: '음식' },
      { id: 4, term: 'school', meaning: ['학교'], pos: '명사', definition: 'A place where students learn with teachers.', example: 'We go to school.', exampleMeaning: '우리는 학교에 간다.', category: '학교' },
      { id: 5, term: 'tree', meaning: ['나무'], pos: '명사', definition: 'A tall plant with a wooden trunk and branches.', example: 'A bird is in the tree.', exampleMeaning: '새 한 마리가 나무에 있다.', category: '자연' },
    ],
  }
  if (profile === 'timeline') return {
    schemaVersion: '2.0', kind: 'timeline',
    meta: { title: '조선의 주요 사건 · 예제', language: 'ko', subject: '한국사', description: '연도와 사건을 검토하며 시간순 항목 편집을 익히는 예제입니다.', timeline: { eraLabel: '조선', modes: ['browse', 'flashcard', 'yearQuiz', 'eventQuiz', 'orderQuiz'] } },
    entries: [
      { id: 1, year: '1392년', sortKey: 1392, yearAnswer: ['1392', '1392년'], event: '조선 건국', detail: '이성계가 조선을 건국하였다.', category: ['정치'] },
      { id: 2, year: '1446년', sortKey: 1446, yearAnswer: ['1446', '1446년'], event: '훈민정음 반포', detail: '세종 때 훈민정음이 반포되었다.', category: ['문화'] },
      { id: 3, year: '1592년', sortKey: 1592, yearAnswer: ['1592', '1592년'], event: '임진왜란 발발', detail: '일본의 침략으로 임진왜란이 시작되었다.', category: ['전쟁'] },
    ],
  }
  if (profile === 'quiz') return {
    schemaVersion: '2.0', kind: 'quiz',
    meta: { title: '수와 자료 읽기 · 예제 퀴즈', subject: '수학', language: 'ko', mode: 'practice', revealPolicy: 'perQuestion', shuffleQuestions: false, shuffleChoices: false, description: '완성된 예제 두 문항입니다. 발문·정답·자료를 수정한 뒤 검증하세요.' },
    questions: sampleQuestions(),
  }
  if (!['exam', 'mockmock', 'mockschool'].includes(profile)) throw new Error(`지원하지 않는 템플릿: ${String(profile)}`)
  const title = profile === 'mockschool' ? '모의내신 · 편집 예제' : profile === 'mockmock' ? '모의모의고사 · 편집 예제' : '일반 시험 · 편집 예제'
  return {
    schemaVersion: '2.0', kind: 'exam',
    meta: {
      title, subject: '수학', language: 'ko', mode: 'exam', timeLimitSec: 600,
      revealPolicy: 'atEnd', shuffleQuestions: false, shuffleChoices: false, leaderboard: false,
      description: '사용 방법을 익히기 위한 두 문항 예제입니다. 실제 학교·수능 시험 한 회분이나 교육과정 설계로 사용하지 마세요.',
      ...(profile === 'exam' ? {} : {
        exam: {
          kind: profile as 'mockmock' | 'mockschool', grade: 3, confidential: false,
          ...(profile === 'mockschool' ? { organization: '예제 학교', periodLabel: '편집 연습' } : { periodLabel: '편집 연습' }),
        },
      }),
    },
    questions: sampleQuestions(),
  }
}

export const schemaGuide = {
  schemaVersion: '2.0',
  kinds: ['quiz', 'exam', 'vocab', 'timeline'],
  profiles: ['quiz', 'exam', 'vocab', 'timeline', 'mockmock', 'mockschool'],
  required: { common: ['schemaVersion', 'kind', 'meta.title'], quiz: ['questions'], exam: ['questions', 'meta.revealPolicy=atEnd'], vocab: ['entries', 'meta.vocab'], timeline: ['entries'] },
  questionTypes: {
    '5지선다': { required: ['number', 'points', 'prompt', 'choices[5]', 'answer(1..5)', 'explanation.correct'] },
    OX: { required: ['number', 'points', 'prompt', 'answer(1=O,2=X)', 'explanation.correct'] },
    '단답형': { required: ['number', 'points', 'prompt', 'answerText[]', 'explanation.correct'] },
    '서술형': { required: ['number', 'points', 'prompt', 'answerText[]', 'explanation.correct'], review: '단계별 채점 기준·부분 점수 검토' },
    '순서 배열': { required: ['number', 'points', 'prompt', 'choices[]', 'answerText[선택지 전체 순열]', 'explanation.correct'] },
  },
  media: ['paragraph', 'math', 'table', 'graph', 'shape', 'diagram', 'image'],
  mediaSlots: ['passages[].media', 'passages[].boxes[].media', 'questions[].media', 'questions[].boxes[].media', 'questions[].choiceMedia[][]', 'questions[].explanation.media'],
  limits: { documentBytes: 15 * 1024 * 1024, imageBytes: 2 * 1024 * 1024, allImageBytes: 8 * 1024 * 1024, imagePixels: 40_000_000, imageMaxEdge: 16_384, pointsMin: 0.5, pointsMax: 1000, pointsStep: 0.5 },
  images: { portable: 'data:image/(png|jpeg|webp);base64,...', serverDependent: 'iq://u/<32 hex characters> is rejected for standalone portability' },
  validationScope: '형식·자료 구조·해독·참조·좌표·정답 구조를 확인합니다. 사실성·교육과정·정답 유일성·저작권과 인쇄 결과는 별도로 검토합니다.',
} as const
