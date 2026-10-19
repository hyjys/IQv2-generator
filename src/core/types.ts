import type { IqContent, IqMedia } from './vendor/types.js'

export type Profile = 'quiz' | 'exam' | 'vocab' | 'timeline' | 'mockmock' | 'mockschool'
export interface ValidationIssue {
  severity: 'error' | 'warning'
  path: string
  message: string
  code?: string
}
export interface DocumentStats {
  questions: number
  entries: number
  passages: number
  totalPoints: number
  images: number
  imageBytes: number
}
export interface ValidationReport {
  valid: boolean
  issues: ValidationIssue[]
  stats: DocumentStats
  profile: string
}
export interface ParseResult extends ValidationReport {
  /** Present when JSON is an IQv2 object, including invalid drafts. Check valid before export. */
  document?: IqContent
}
export interface MediaLocation {
  media: IqMedia
  path: string
}
export interface RasterDimensions { width: number; height: number }
export type RasterDecoder = (dataUrl: string) => Promise<RasterDimensions>

export const PROFILE_LABELS: Record<Profile, string> = {
  quiz: '퀴즈', exam: '일반 시험', vocab: '단어장', timeline: '연표',
  mockmock: '모의모의고사', mockschool: '모의내신',
}
