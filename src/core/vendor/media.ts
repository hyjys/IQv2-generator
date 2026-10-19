import type { IqContent, IqMediaImage } from './types.js'

export const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_INLINE_TOTAL_BYTES = 8 * 1024 * 1024
export const MAX_IQ_CONTENT_BYTES = 15 * 1024 * 1024
export const UPLOAD_IMAGE_SOURCE = /^iq:\/\/u\/([a-f0-9]{32})$/i

/** Strict, browser-safe syntax/decoded length check. The server additionally
 * decodes and re-encodes pixels; SVG and remote URLs never enter this path. */
export function inlineImageInfo(source: string): { mime: 'image/png' | 'image/jpeg' | 'image/webp'; base64: string; bytes: number } | null {
  if (source.length > Math.ceil(MAX_INLINE_IMAGE_BYTES / 3) * 4 + 32) return null
  const match = /^data:(image\/(?:png|jpeg|webp));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(source)
  if (!match || !match[2]) return null
  const base64 = match[2]
  const bytes = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
  // Padding bits must be zero: forbid multiple spellings of the same bytes.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  if (base64.endsWith('==') && (alphabet.indexOf(base64[base64.length - 3]) & 15) !== 0) return null
  if (!base64.endsWith('==') && base64.endsWith('=') && (alphabet.indexOf(base64[base64.length - 2]) & 3) !== 0) return null
  if (!bytes || bytes > MAX_INLINE_IMAGE_BYTES) return null
  return { mime: match[1] as 'image/png' | 'image/jpeg' | 'image/webp', base64, bytes }
}

/** Visit only declared media slots, including answer-only media. Never search
 * arbitrary user text for upload IDs or accidentally turn it into an image. */
export function imageMedia(content: IqContent): IqMediaImage[] {
  const images: IqMediaImage[] = []
  const add = (media: unknown) => {
    if (Array.isArray(media)) for (const block of media) {
      if (block && typeof block === 'object' && block.type === 'image') images.push(block as IqMediaImage)
    }
  }
  for (const passage of content.passages ?? []) {
    add(passage.media)
    for (const box of passage.boxes ?? []) add(box.media)
  }
  for (const question of content.questions ?? []) {
    add(question.media)
    for (const box of question.boxes ?? []) add(box.media)
    for (const choice of question.choiceMedia ?? []) add(choice)
    add(question.explanation?.media)
  }
  return images
}

/** Positive half-point units are exact in binary and support 2028 CSAT data. */
export function isQuestionScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1_000 && Number.isInteger(value * 2)
}

/** Bridge only rewrites actual media slots, not coincidental text or answers. */
export function rewriteUploadReferences(content: IqContent, replacements: ReadonlyMap<string, string>): IqContent {
  const copy = structuredClone(content)
  for (const image of imageMedia(copy)) {
    const match = UPLOAD_IMAGE_SOURCE.exec(image.src)
    if (match) image.src = replacements.get(match[1].toLowerCase()) ?? `iq://u/${match[1].toLowerCase()}`
  }
  return copy
}
