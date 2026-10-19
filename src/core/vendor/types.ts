/** The only schema source for ImsiQuiz content.  It deliberately has no UI,
 * HTTP, or database dependency so the same rules run on both sides. */
export const IQ_SCHEMA_VERSION = "2.0" as const;

export type IqKind = "quiz" | "exam" | "vocab" | "timeline";
export type QuestionType = "5지선다" | "OX" | "단답형" | "서술형" | "순서 배열";
export type RevealPolicy = "perQuestion" | "atEnd";

export interface IqExplanation {
  intent?: string;
  correct: string;
  others?: string[];
  media?: IqMedia[];
}
export interface IqMediaParagraph {
  type: "paragraph";
  text: string;
}
export interface IqMediaImage {
  type: "image";
  src: string;
  alt: string;
  width?: number;
}
export interface IqMediaGraph {
  type: "graph";
  graphType: "bar" | "line";
  title?: string;
  points: Array<{ label: string; value: number }>;
}
export interface IqMediaShape {
  type: "shape";
  shape: "rectangle" | "circle" | "triangle" | "line" | "arrow";
  label?: string;
  stroke?: string;
  fill?: string;
  width?: number;
  height?: number;
}
export interface IqMediaMath { type: "math"; latex: string; display?: boolean }
export interface IqMediaTable { type: "table"; headers?: string[]; rows: string[][]; caption?: string }
export type IqDiagramElement = (
  | { type: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "polyline" | "polygon"; points: [number, number][] }
  | { type: "text"; x: number; y: number; text: string; fontSize?: number; anchor?: "start" | "middle" | "end" }
) & { stroke?: string; fill?: string; strokeWidth?: number };
export interface IqMediaDiagram { type: "diagram"; width: number; height: number; caption?: string; elements: IqDiagramElement[] }
/** Supplemental content that is displayed with a question, before its answer
 * controls. Existing image media remains valid. */
export type IqMedia =
  IqMediaParagraph | IqMediaImage | IqMediaGraph | IqMediaShape | IqMediaMath | IqMediaTable | IqMediaDiagram;
export interface IqBox {
  label: string;
  body: string;
  media?: IqMedia[];
}
export interface IqPassage {
  id: string;
  range?: [number, number];
  instruction?: string;
  body: string;
  media?: IqMedia[];
  boxes?: IqBox[];
  source?: string;
  author?: string;
  work?: string;
}

export interface IqQuestion {
  number: number;
  passageId?: string | null;
  points: number;
  minSolveTimeSec?: number;
  timeLimitSec?: number | null;
  type: QuestionType;
  prompt: string;
  media?: IqMedia[];
  boxes?: IqBox[];
  choices?: string[];
  choiceMedia?: IqMedia[][];
  answer?: number;
  answerText?: string[];
  matchMode?: "exact" | "normalized";
  shuffle?: boolean;
  tags?: string[];
  explanation: IqExplanation;
}

export interface IqVocabEntry {
  id: number;
  term: string;
  reading?: string;
  meaning: string[];
  pos?: string;
  definition?: string;
  example?: string;
  exampleMeaning?: string;
  note?: string;
  category?: string;
}
export interface IqTimelineEntry {
  id: number;
  year: string;
  sortKey: number;
  yearAnswer?: string[];
  event: string;
  detail?: string;
  category?: string[];
}

export interface IqMeta {
  title: string;
  subtitle?: string;
  subject?: string;
  description?: string;
  tags?: string[];
  language?: string;
  difficulty?: number;
  mode?: "practice" | "exam";
  timeLimitSec?: number | null;
  minSolveTimeSec?: number;
  revealPolicy?: RevealPolicy;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  leaderboard?: boolean;
  exam?: {
    kind: "mockmock" | "mockschool";
    grade?: number;
    periodLabel?: string;
    organization?: string;
    system?: string;
    confidential?: boolean;
    signaturePhrase?: string;
  };
  vocab?: {
    sourceLang: string;
    targetLang: string;
    testDirections: Array<"term2meaning" | "meaning2term" | "definition2term">;
  };
  timeline?: {
    eraLabel?: string;
    modes?: Array<
      "browse" | "flashcard" | "yearQuiz" | "eventQuiz" | "orderQuiz"
    >;
  };
}

export interface IqContent {
  schemaVersion: typeof IQ_SCHEMA_VERSION;
  kind: IqKind;
  meta: IqMeta;
  passages?: IqPassage[];
  questions?: IqQuestion[];
  entries?: IqVocabEntry[] | IqTimelineEntry[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  content?: IqContent;
}
