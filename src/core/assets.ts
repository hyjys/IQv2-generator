import { inlineImageInfo, UPLOAD_IMAGE_SOURCE } from './vendor/media.js'
import type { IqContent, IqMedia } from './vendor/types.js'
import type { MediaLocation, RasterDecoder, RasterDimensions, ValidationIssue } from './types.js'

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Read declared media slots only. Tolerates incomplete drafts and never scans arbitrary text. */
export function collectMedia(input: unknown): MediaLocation[] {
  if (!record(input)) return []
  const result: MediaLocation[] = []
  const add = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((media, index) => {
      if (record(media)) result.push({ media: media as unknown as IqMedia, path: `${path}[${index}]` })
    })
  }
  const boxes = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((box, index) => {
      if (record(box)) add(box.media, `${path}[${index}].media`)
    })
  }
  if (Array.isArray(input.passages)) input.passages.forEach((passage, index) => {
    if (!record(passage)) return
    add(passage.media, `passages[${index}].media`)
    boxes(passage.boxes, `passages[${index}].boxes`)
  })
  if (Array.isArray(input.questions)) input.questions.forEach((question, index) => {
    if (!record(question)) return
    const path = `questions[${index}]`
    add(question.media, `${path}.media`)
    boxes(question.boxes, `${path}.boxes`)
    if (Array.isArray(question.choiceMedia)) question.choiceMedia.forEach((value, choice) => add(value, `${path}.choiceMedia[${choice}]`))
    if (record(question.explanation)) add(question.explanation.media, `${path}.explanation.media`)
  })
  return result
}

function bytesFromBase64(value: string): Uint8Array {
  // atob is available in current Node and Electron browsers. No Node-only imports enter the renderer.
  const decoded = atob(value)
  return Uint8Array.from(decoded, char => char.charCodeAt(0))
}
const starts = (bytes: Uint8Array, prefix: number[]) => prefix.every((n, i) => bytes[i] === n)
const ascii = (bytes: Uint8Array, from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length))
const be32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, false)
const le32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, true)
const le24 = (b: Uint8Array, at: number) => b[at] | b[at + 1] << 8 | b[at + 2] << 16

/** Signature + container dimensions. Pixel decoding is separately required before export. */
export function rasterHeader(dataUrl: string): RasterDimensions | null {
  const info = inlineImageInfo(dataUrl)
  if (!info) return null
  const b = bytesFromBase64(info.base64)
  if (info.mime === 'image/png') {
    if (b.length < 45 || !starts(b, [137, 80, 78, 71, 13, 10, 26, 10]) || be32(b, 8) !== 13 || ascii(b, 12, 4) !== 'IHDR') return null
    const width = be32(b, 16), height = be32(b, 20)
    // Require complete chunk framing, image data, and the end marker. CRC and compressed pixels are decoder work.
    let at = 8, hasData = false, ended = false
    while (at + 12 <= b.length) {
      const length = be32(b, at), name = ascii(b, at + 4, 4)
      if (length > b.length - at - 12) return null
      if (name === 'IDAT' && length > 0) hasData = true
      if (name === 'IEND') { ended = length === 0 && at + 12 === b.length; break }
      at += length + 12
    }
    return hasData && ended && width > 0 && height > 0 ? { width, height } : null
  }
  if (info.mime === 'image/jpeg') {
    if (b.length < 12 || !starts(b, [255, 216, 255]) || b[b.length - 2] !== 255 || b[b.length - 1] !== 217) return null
    let at = 2
    while (at + 4 <= b.length) {
      if (b[at] !== 255) return null
      while (b[at] === 255) at++
      const marker = b[at++]
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const length = (b[at] << 8) | b[at + 1]
      if (length < 2 || at + length > b.length) return null
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) return null
        const height = (b[at + 3] << 8) | b[at + 4], width = (b[at + 5] << 8) | b[at + 6]
        return width > 0 && height > 0 ? { width, height } : null
      }
      at += length
    }
    return null
  }
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP' || le32(b, 4) + 8 !== b.length) return null
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8X' && b.length >= 30) return { width: le24(b, 24) + 1, height: le24(b, 27) + 1 }
  if (chunk === 'VP8 ' && b.length >= 30 && starts(b.subarray(23), [0x9d, 0x01, 0x2a])) {
    return { width: (b[26] | b[27] << 8) & 0x3fff, height: (b[28] | b[29] << 8) & 0x3fff }
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const bits = le32(b, 21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  return null
}

export const MAX_RASTER_PIXELS = 40_000_000
export const MAX_RASTER_EDGE = 16_384

export function inspectImages(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const { media, path } of collectMedia(input)) {
    if (media.type !== 'image' || typeof media.src !== 'string') continue
    if (UPLOAD_IMAGE_SOURCE.test(media.src)) {
      issues.push({ severity: 'error', path: `${path}.src`, code: 'UNRESOLVED_IMAGE', message: 'iq:// 이미지는 발급 서버에 종속됩니다. 독립 실행·PDF 내보내기를 위해 실제 PNG/JPEG/WebP 파일을 data URL로 포함하세요.' })
      continue
    }
    const info = inlineImageInfo(media.src)
    if (!info) continue // Canonical validator supplies the syntax/byte-size error.
    const dimensions = rasterHeader(media.src)
    if (!dimensions) issues.push({ severity: 'error', path: `${path}.src`, code: 'IMAGE_SIGNATURE', message: '이미지 MIME과 실제 PNG/JPEG/WebP 헤더·파일 구조가 맞지 않거나 파일이 손상되었습니다.' })
    else if (dimensions.width > MAX_RASTER_EDGE || dimensions.height > MAX_RASTER_EDGE || dimensions.width * dimensions.height > MAX_RASTER_PIXELS) {
      issues.push({ severity: 'error', path: `${path}.src`, code: 'IMAGE_DIMENSIONS', message: '이미지는 한 변 16384px, 총 4000만 픽셀 이하로 줄여 주세요.' })
    }
  }
  return issues
}

async function browserDecoder(dataUrl: string): Promise<RasterDimensions> {
  if (typeof createImageBitmap === 'function') {
    const info = inlineImageInfo(dataUrl)
    if (!info) throw new Error('Invalid data URL')
    const bytes = bytesFromBase64(info.base64)
    const image = await createImageBitmap(new Blob([bytes.buffer as ArrayBuffer], { type: info.mime }))
    const size = { width: image.width, height: image.height }
    image.close()
    return size
  }
  if (typeof Image !== 'undefined') {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  throw new Error('NO_DECODER')
}

/** Full browser/native pixel decode. Pass an Electron nativeImage adapter when running under Node. */
export async function validateRasterDecoding(input: unknown, decoder: RasterDecoder = browserDecoder): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const checked = new Map<string, { code: string; message: string } | null>()
  for (const { media, path } of collectMedia(input)) {
    if (media.type !== 'image' || typeof media.src !== 'string' || !inlineImageInfo(media.src)) continue
    const header = rasterHeader(media.src)
    if (!header || header.width > MAX_RASTER_EDGE || header.height > MAX_RASTER_EDGE || header.width * header.height > MAX_RASTER_PIXELS) continue
    if (!checked.has(media.src)) {
      try {
        const decoded = await decoder(media.src)
        if (!Number.isInteger(decoded.width) || !Number.isInteger(decoded.height) || decoded.width < 1 || decoded.height < 1) throw new Error('EMPTY_IMAGE')
        checked.set(media.src, decoded.width === header.width && decoded.height === header.height ? null : { code: 'IMAGE_DECODE_DIMENSIONS', message: '해독한 이미지 크기와 파일 헤더의 크기가 다릅니다.' })
      } catch (error) {
        checked.set(media.src, error instanceof Error && error.message === 'NO_DECODER'
          ? { code: 'IMAGE_DECODER_UNAVAILABLE', message: '현재 환경에 픽셀 해독기가 없어 이미지 검증을 완료하지 못했습니다.' }
          : { code: 'IMAGE_DECODE', message: '이미지 픽셀을 해독할 수 없습니다. 원본 파일을 다시 첨부해 주세요.' })
      }
    }
    const failure = checked.get(media.src)
    if (failure) issues.push({ severity: 'error', path: `${path}.src`, ...failure })
  }
  return issues
}

/** Convert a local raster's bytes without filesystem access or remote requests. */
export function encodeRaster(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg' | 'image/webp'): string {
  let binary = ''
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return `data:${mime};base64,${btoa(binary)}`
}

/** Typed convenience for callers that already hold a canonical document. */
export const documentMedia = (document: IqContent): MediaLocation[] => collectMedia(document)
