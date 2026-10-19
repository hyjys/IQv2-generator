import { imageMedia, inlineImageInfo, isQuestionScore, MAX_INLINE_TOTAL_BYTES, UPLOAD_IMAGE_SOURCE } from "./media.js";
import {
  IQ_SCHEMA_VERSION,
  type IqContent,
  type IqKind,
  type IqQuestion,
  type ValidationIssue,
  type ValidationResult,
} from "./types.js";

const kinds = new Set<IqKind>(["quiz", "exam", "vocab", "timeline"]);
const questionTypes = new Set([
  "5지선다",
  "OX",
  "단답형",
  "서술형",
  "순서 배열",
]);
const hexColor = /^#[a-f0-9]{6}$/i;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

export function validateIqv2(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const error = (path: string, code: string, message: string) =>
    errors.push({ path, code, message });
  const warn = (path: string, code: string, message: string) =>
    warnings.push({ path, code, message });
  if (!record(input))
    return {
      ok: false,
      errors: [
        { path: "$", code: "TYPE", message: "콘텐츠는 객체여야 합니다." },
      ],
      warnings,
    };
  if (input.schemaVersion !== IQ_SCHEMA_VERSION)
    error(
      "schemaVersion",
      "VERSION",
      `schemaVersion은 ${IQ_SCHEMA_VERSION}이어야 합니다.`,
    );
  if (!kinds.has(input.kind as IqKind))
    error("kind", "KIND", "지원하지 않는 콘텐츠 종류입니다.");
  if (!record(input.meta) || !text(input.meta.title))
    error("meta.title", "REQUIRED", "제목을 입력해 주세요.");
  const kind = input.kind as IqKind;
  const meta = record(input.meta) ? input.meta : {};
  if (
    meta.difficulty !== undefined &&
    (!integer(meta.difficulty) || meta.difficulty < 1 || meta.difficulty > 5)
  )
    error("meta.difficulty", "RANGE", "난이도는 1~5 정수여야 합니다.");
  if (
    meta.language !== undefined &&
    !["ko", "en", "ja", "zh"].includes(String(meta.language))
  )
    error(
      "meta.language",
      "VALUE",
      "콘텐츠 언어는 한국어, 영어, 일본어, 중국어 중 하나여야 합니다.",
    );
  if (
    meta.minSolveTimeSec !== undefined &&
    (!integer(meta.minSolveTimeSec) ||
      meta.minSolveTimeSec < 0 ||
      meta.minSolveTimeSec > 86_400)
  )
    error(
      "meta.minSolveTimeSec",
      "RANGE",
      "최소 풀이 시간은 0초~24시간 정수여야 합니다.",
    );
  if (
    meta.timeLimitSec !== undefined &&
    meta.timeLimitSec !== null &&
    (!integer(meta.timeLimitSec) ||
      meta.timeLimitSec < 1 ||
      meta.timeLimitSec > 86_400)
  )
    error(
      "meta.timeLimitSec",
      "RANGE",
      "타임어택 시간은 1초~24시간 정수여야 합니다.",
    );
  if (
    integer(meta.minSolveTimeSec) &&
    integer(meta.timeLimitSec) &&
    meta.minSolveTimeSec > meta.timeLimitSec
  )
    error(
      "meta.timeLimitSec",
      "RANGE",
      "최대 풀이 시간은 최소 풀이 시간보다 작을 수 없습니다.",
    );
  if (
    meta.revealPolicy !== undefined &&
    meta.revealPolicy !== "perQuestion" &&
    meta.revealPolicy !== "atEnd"
  )
    error("meta.revealPolicy", "VALUE", "공개 방식이 올바르지 않습니다.");
  if (kind === "exam" && meta.revealPolicy === "perQuestion")
    error(
      "meta.revealPolicy",
      "EXAM_REVEAL",
      "시험은 최종 공개 방식만 사용할 수 있습니다.",
    );
  if (meta.exam !== undefined) {
    if (!record(meta.exam) || !["mockmock", "mockschool"].includes(String(meta.exam.kind)))
      error("meta.exam", "EXAM_META", "시험 종류를 지정해 주세요.");
    else {
      if (meta.exam.grade !== undefined && (!integer(meta.exam.grade) || meta.exam.grade < 1 || meta.exam.grade > 3)) error("meta.exam.grade", "RANGE", "학년은 1~3입니다.");
      for (const key of ["periodLabel", "organization", "system", "signaturePhrase"]) if (meta.exam[key] !== undefined && typeof meta.exam[key] !== "string") error(`meta.exam.${key}`, "TYPE", "문자열이어야 합니다.");
      if (meta.exam.confidential !== undefined && typeof meta.exam.confidential !== "boolean") error("meta.exam.confidential", "TYPE", "참/거짓 값이어야 합니다.");
    }
  }
  if (input.passages !== undefined && !Array.isArray(input.passages)) error("passages", "TYPE", "지문은 배열이어야 합니다.");
  const passages = Array.isArray(input.passages) ? input.passages : [];
  const passageIds = new Set<string>();
  passages.forEach((entry, index) => {
    if (!record(entry) || !text(entry.id) || (typeof entry.body !== "string") || (!text(entry.body) && !(Array.isArray(entry.media) && entry.media.length))) {
      error(`passages[${index}]`, "PASSAGE", "지문 id와 본문을 입력해 주세요.");
      return;
    }
    if (passageIds.has(entry.id))
      error(`passages[${index}].id`, "DUPLICATE", "지문 id가 중복됩니다.");
    passageIds.add(entry.id);
    validateMediaList(entry.media, `passages[${index}].media`, error);
    validateBoxes(entry.boxes, `passages[${index}].boxes`, error);
    if (entry.range !== undefined && (!Array.isArray(entry.range) || entry.range.length !== 2 || !entry.range.every(n => integer(n) && n > 0) || entry.range[0] > entry.range[1])) error(`passages[${index}].range`, "RANGE", "지문 범위는 [시작 번호, 끝 번호]입니다.");
  });
  if (kind === "quiz" || kind === "exam")
    validateQuestions(input.questions, passageIds, kind, error, warn);
  else validateEntries(input.entries, kind, error, warn);
  if (kind === "vocab") {
    if (!record(meta.vocab))
      error(
        "meta.vocab",
        "REQUIRED",
        "단어 콘텐츠에는 언어 설정이 필요합니다.",
      );
    else {
      const directions = meta.vocab.testDirections;
      if (
        !text(meta.vocab.sourceLang) ||
        !text(meta.vocab.targetLang) ||
        !Array.isArray(directions) ||
        !directions.length ||
        directions.some(
          (direction) =>
            direction !== "term2meaning" &&
            direction !== "meaning2term" &&
            direction !== "definition2term",
        )
      )
        error(
          "meta.vocab",
          "VALUE",
          "단어 언어와 하나 이상의 시험 방향을 지정해 주세요.",
        );
    }
  }
  if (
    kind === "timeline" &&
    record(meta.timeline) &&
    meta.timeline.modes !== undefined &&
    (!Array.isArray(meta.timeline.modes) ||
      meta.timeline.modes.some(
        (mode) =>
          ![
            "browse",
            "flashcard",
            "yearQuiz",
            "eventQuiz",
            "orderQuiz",
          ].includes(String(mode)),
      ))
  )
    error("meta.timeline.modes", "VALUE", "지원하지 않는 연표 모드입니다.");
  else if (kind === "timeline" && !record(meta.timeline))
    warn(
      "meta.timeline",
      "RECOMMENDED",
      "연표 모드를 지정하면 학습 경험이 더 명확합니다.",
    );
  if (!errors.length) {
    const total = imageMedia(input as unknown as IqContent).reduce((sum, media) => sum + (inlineImageInfo(media.src)?.bytes ?? 0), 0);
    if (total > MAX_INLINE_TOTAL_BYTES) error("$", "MEDIA_SIZE", "내장 이미지 합계는 8MiB 이하여야 합니다.");
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    content: errors.length === 0 ? (input as unknown as IqContent) : undefined,
  };
}

function validateQuestions(
  value: unknown,
  passageIds: Set<string>,
  kind: IqKind,
  error: (p: string, c: string, m: string) => void,
  warn: (p: string, c: string, m: string) => void,
): void {
  if (!Array.isArray(value) || value.length === 0) {
    error("questions", "REQUIRED", "문항을 하나 이상 입력해 주세요.");
    return;
  }
  const numbers = new Set<number>();
  let essay = false;
  value.forEach((raw, index) => {
    const path = `questions[${index}]`;
    if (!record(raw)) {
      error(path, "TYPE", "문항은 객체여야 합니다.");
      return;
    }
    const q = raw as unknown as IqQuestion;
    if (!integer(q.number) || q.number < 1)
      error(`${path}.number`, "NUMBER", "문항 번호는 1 이상 정수여야 합니다.");
    else if (numbers.has(q.number))
      error(`${path}.number`, "DUPLICATE", "문항 번호가 중복됩니다.");
    else numbers.add(q.number);
    if (!questionTypes.has(q.type))
      error(`${path}.type`, "TYPE", "지원하지 않는 문항 형식입니다.");
    if (!text(q.prompt))
      error(`${path}.prompt`, "REQUIRED", "발문을 입력해 주세요.");
    if (!isQuestionScore(q.points))
      error(`${path}.points`, "POINTS", "배점은 0.5 단위의 양수이며 1000점 이하여야 합니다.");
    if (
      q.minSolveTimeSec !== undefined &&
      (!integer(q.minSolveTimeSec) ||
        q.minSolveTimeSec < 0 ||
        q.minSolveTimeSec > 86_400)
    )
      error(
        `${path}.minSolveTimeSec`,
        "RANGE",
        "최소 풀이 시간은 0초~24시간 정수여야 합니다.",
      );
    if (
      q.timeLimitSec !== undefined &&
      q.timeLimitSec !== null &&
      (!integer(q.timeLimitSec) ||
        q.timeLimitSec < 1 ||
        q.timeLimitSec > 86_400)
    )
      error(
        `${path}.timeLimitSec`,
        "RANGE",
        "문항 타임어택 시간은 1초~24시간 정수여야 합니다.",
      );
    if (
      integer(q.minSolveTimeSec) &&
      integer(q.timeLimitSec) &&
      q.minSolveTimeSec > q.timeLimitSec
    )
      error(
        `${path}.timeLimitSec`,
        "RANGE",
        "문항 최대 시간은 최소 시간보다 작을 수 없습니다.",
      );
    if (q.passageId && !passageIds.has(q.passageId))
      error(
        `${path}.passageId`,
        "REFERENCE",
        "존재하지 않는 지문을 참조합니다.",
      );
    if (q.type === "5지선다") {
      if (
        !Array.isArray(q.choices) ||
        q.choices.length !== 5 ||
        q.choices.some((choice) => !text(choice))
      )
        error(
          `${path}.choices`,
          "CHOICES",
          "5지선다는 비어 있지 않은 선택지 5개가 필요합니다.",
        );
      if (!integer(q.answer) || q.answer < 1 || q.answer > 5)
        error(`${path}.answer`, "ANSWER", "정답은 1~5여야 합니다.");
    } else if (q.type === "OX") {
      if (!integer(q.answer) || q.answer < 1 || q.answer > 2)
        error(
          `${path}.answer`,
          "ANSWER",
          "OX 정답은 1(O) 또는 2(X)여야 합니다.",
        );
    } else if (q.type === "단답형" || q.type === "순서 배열") {
      if (
        !Array.isArray(q.answerText) ||
        !q.answerText.length ||
        q.answerText.some((answer) => !text(answer))
      )
        error(
          `${path}.answerText`,
          "ANSWER",
          "단답형 정답을 하나 이상 입력해 주세요.",
        );
      if (
        q.type === "순서 배열" &&
        (!Array.isArray(q.choices) ||
          q.choices.length < 2 ||
          q.choices.some((choice) => !text(choice)))
      )
        error(
          `${path}.choices`,
          "CHOICES",
          "순서 배열에는 두 개 이상의 텍스트 항목이 필요합니다.",
        );
    } else if (q.type === "서술형") {
      essay = true;
      if (!Array.isArray(q.answerText) || !q.answerText.length)
        warn(
          `${path}.answerText`,
          "MODEL_ANSWER",
          "서술형 모범답안을 입력하는 것을 권장합니다.",
        );
    }
    if (!record(q.explanation) || !text(q.explanation.correct))
      error(
        `${path}.explanation.correct`,
        "REQUIRED",
        "정답 해설을 입력해 주세요.",
      );
    validateMediaList(q.media, `${path}.media`, error);
    validateBoxes(q.boxes, `${path}.boxes`, error);
    if (record(q.explanation)) validateMediaList(q.explanation.media, `${path}.explanation.media`, error);
    if (q.choiceMedia !== undefined) {
      if (!Array.isArray(q.choiceMedia) || !Array.isArray(q.choices) || q.choiceMedia.length !== q.choices.length) error(`${path}.choiceMedia`, "CHOICES", "선택지 자료는 선택지 수와 같아야 합니다.");
      else q.choiceMedia.forEach((media, i) => validateMediaList(media, `${path}.choiceMedia[${i}]`, error));
    }
  });
  if (essay && kind === "exam")
    warn(
      "meta.leaderboard",
      "LEADERBOARD_DISABLED",
      "서술형 시험은 리더보드가 자동으로 꺼집니다.",
    );
}

type Reporter = (p: string, c: string, m: string) => void;
function validateMediaList(value: unknown, path: string, error: Reporter): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 100) { error(path, "MEDIA", "자료는 100개 이하 배열이어야 합니다."); return; }
  value.forEach((media, i) => validateMedia(media, `${path}[${i}]`, error));
}
function validateBoxes(value: unknown, path: string, error: Reporter): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 100) { error(path, "BOXES", "보기는 100개 이하 배열이어야 합니다."); return; }
  value.forEach((box, i) => {
    if (!record(box) || typeof box.label !== "string" || typeof box.body !== "string") { error(`${path}[${i}]`, "BOX", "보기 제목과 본문은 문자열이어야 합니다."); return; }
    validateMediaList(box.media, `${path}[${i}].media`, error);
  });
}
function validateDiagramElement(value: unknown, path: string, error: Reporter): void {
  if (!record(value)) { error(path, "MEDIA_DIAGRAM", "도형 요소는 객체여야 합니다."); return; }
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 10_000;
  let fields: string[] = [];
  if (value.type === "line" || value.type === "arrow") fields = ["x1", "y1", "x2", "y2"];
  else if (value.type === "circle") fields = ["cx", "cy", "r"];
  else if (value.type === "ellipse") fields = ["cx", "cy", "rx", "ry"];
  else if (value.type === "rect") fields = ["x", "y", "width", "height"];
  else if (value.type === "text") {
    fields = ["x", "y"];
    if (!text(value.text) || (value.fontSize !== undefined && (!finite(value.fontSize) || Number(value.fontSize) < 6 || Number(value.fontSize) > 160)) || (value.anchor !== undefined && !["start", "middle", "end"].includes(String(value.anchor)))) error(path, "MEDIA_DIAGRAM", "도식 글자와 크기, 정렬을 확인해 주세요.");
  } else if (value.type === "polyline" || value.type === "polygon") {
    if (!Array.isArray(value.points) || value.points.length < 2 || value.points.length > 500 || value.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(finite))) error(path, "MEDIA_DIAGRAM", "도식 좌표는 유한한 [x,y] 쌍이어야 합니다.");
  } else error(path, "MEDIA_DIAGRAM", "지원하지 않는 도식 요소입니다.");
  if (fields.some(key => !finite(value[key]))) error(path, "MEDIA_DIAGRAM", "좌표는 절댓값 10000 이하의 수여야 합니다.");
  for (const key of ["r", "rx", "ry", "width", "height"]) if (fields.includes(key) && Number(value[key]) <= 0) error(path, "MEDIA_DIAGRAM", "도형 크기는 양수여야 합니다.");
  if ((value.stroke !== undefined && (typeof value.stroke !== "string" || !hexColor.test(value.stroke))) || (value.fill !== undefined && value.fill !== "none" && (typeof value.fill !== "string" || !hexColor.test(value.fill))) || (value.strokeWidth !== undefined && (!finite(value.strokeWidth) || Number(value.strokeWidth) <= 0 || Number(value.strokeWidth) > 20))) error(path, "MEDIA_DIAGRAM", "도식 색상과 선 두께를 확인해 주세요.");
}

function validateMedia(
  value: unknown,
  path: string,
  error: (p: string, c: string, m: string) => void,
): void {
  if (!record(value)) {
    error(path, "MEDIA", "문제 미디어는 객체여야 합니다.");
    return;
  }
  if (value.type === "paragraph") {
    if (!text(value.text))
      error(path, "MEDIA_PARAGRAPH", "문단 내용을 입력해 주세요.");
  } else if (value.type === "image") {
    if (
      !text(value.src) ||
      !(UPLOAD_IMAGE_SOURCE.test(value.src) || inlineImageInfo(value.src)) ||
      !text(value.alt) ||
      (value.width !== undefined &&
        (!integer(value.width) || value.width < 1 || value.width > 1_600))
    )
      error(
        path,
        "MEDIA",
        "이미지는 iq:// 업로드 참조 또는 2MiB 이하 PNG/JPEG/WebP data URL, 대체 텍스트와 1~1600px 너비가 필요합니다.",
      );
  } else if (value.type === "graph") {
    if (
      (value.graphType !== "bar" && value.graphType !== "line") ||
      !Array.isArray(value.points) ||
      value.points.length < 2 ||
      value.points.length > 20 ||
      value.points.some(
        (point) =>
          !record(point) ||
          !text(point.label) ||
          typeof point.value !== "number" ||
          !Number.isFinite(point.value),
      )
    )
      error(
        path,
        "MEDIA_GRAPH",
        "그래프는 막대/선 유형과 2~20개의 이름·숫자 데이터가 필요합니다.",
      );
  } else if (value.type === "shape") {
    if (
      !["rectangle", "circle", "triangle", "line", "arrow"].includes(
        String(value.shape),
      ) ||
      (value.stroke !== undefined &&
        (!text(value.stroke) || !hexColor.test(value.stroke))) ||
      (value.fill !== undefined &&
        (!text(value.fill) || !hexColor.test(value.fill))) ||
      (value.width !== undefined &&
        (!integer(value.width) || value.width < 32 || value.width > 800)) ||
      (value.height !== undefined &&
        (!integer(value.height) || value.height < 32 || value.height > 500))
    )
      error(
        path,
        "MEDIA_SHAPE",
        "도형 종류, #RRGGBB 색상, 32~800px 크기를 확인해 주세요.",
      );
  } else if (value.type === "math") {
    if (!text(value.latex) || value.latex.length > 20_000 || (value.display !== undefined && typeof value.display !== "boolean")) error(path, "MEDIA_MATH", "수식은 20000자 이하 LaTeX 문자열이어야 합니다.");
  } else if (value.type === "table") {
    const rows = value.rows;
    const columns = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0].length : 0;
    if (!Array.isArray(rows) || !rows.length || rows.length > 200 || columns < 1 || columns > 30 || rows.some(row => !Array.isArray(row) || row.length !== columns || row.some(cell => typeof cell !== "string")) || (value.headers !== undefined && (!Array.isArray(value.headers) || value.headers.length !== columns || value.headers.some(cell => typeof cell !== "string")))) error(path, "MEDIA_TABLE", "표는 1~30열, 1~200행의 문자열 배열이어야 합니다.");
  } else if (value.type === "diagram") {
    if (![value.width, value.height].every(n => integer(n) && n >= 32 && n <= 1600) || !Array.isArray(value.elements) || !value.elements.length || value.elements.length > 300) error(path, "MEDIA_DIAGRAM", "도식은 32~1600 크기와 1~300개의 도형 요소가 필요합니다.");
    else value.elements.forEach((element, index) => validateDiagramElement(element, `${path}.elements[${index}]`, error));
  } else error(path, "MEDIA", "지원하지 않는 문제 미디어입니다.");
  for (const key of ["caption", "title", "label"]) if (value[key] !== undefined && typeof value[key] !== "string") error(`${path}.${key}`, "TYPE", "문자열이어야 합니다.");
}

function validateEntries(
  value: unknown,
  kind: IqKind,
  error: (p: string, c: string, m: string) => void,
  warn: (p: string, c: string, m: string) => void,
): void {
  if (!Array.isArray(value) || !value.length) {
    error("entries", "REQUIRED", "항목을 하나 이상 입력해 주세요.");
    return;
  }
  const ids = new Set<number>();
  value.forEach((entry, index) => {
    const path = `entries[${index}]`;
    if (!record(entry) || !integer(entry.id) || entry.id < 1) {
      error(path, "ENTRY", "항목 id는 1 이상 정수여야 합니다.");
      return;
    }
    if (ids.has(entry.id))
      error(`${path}.id`, "DUPLICATE", "항목 id가 중복됩니다.");
    ids.add(entry.id);
    if (kind === "vocab") {
      if (
        !text(entry.term) ||
        !Array.isArray(entry.meaning) ||
        !entry.meaning.length ||
        entry.meaning.some((item) => !text(item))
      )
        error(path, "VOCAB", "단어와 뜻을 입력해 주세요.");
    } else {
      if (!text(entry.year) || !integer(entry.sortKey) || !text(entry.event))
        error(path, "TIMELINE", "연도, 정렬값, 사건을 입력해 주세요.");
      if (!Array.isArray(entry.category))
        warn(
          `${path}.category`,
          "CATEGORY",
          "분류를 넣으면 연표를 더 쉽게 탐색할 수 있습니다.",
        );
    }
  });
}
