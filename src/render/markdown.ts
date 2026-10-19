import MarkdownIt from 'markdown-it'
import cjkFriendly from 'markdown-it-cjk-friendly'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import 'katex/contrib/mhchem'

const mathOptions = { trust: false, throwOnError: false, strict: 'ignore' as const, maxExpand: 1_000, maxSize: 20 }
const md = new MarkdownIt({ html: false, breaks: true, linkify: false })
  .use(cjkFriendly)
  .use(texmath, { engine: katex, delimiters: ['dollars', 'brackets'], katexOptions: mathOptions })

const languages = new Map(['ja', 'zh', 'zh-Hans', 'zh-Hant', 'zh-CN', 'zh-SG', 'zh-TW', 'zh-HK', 'zh-MO'].map(language => [language.toLowerCase(), language]))
// A small tokenizer, not raw HTML mode: accept only language spans and ruby
// readings. Never copy attributes, CSS, URLs or event handlers from input.
md.inline.ruler.before('html_inline', 'iq_language_tag', (state, silent) => {
  if (state.src[state.pos] !== '<') return false
  const source = state.src.slice(state.pos, state.pos + 120)
  const closing = /^<\/(span|ruby|rt|rp)\s*>/i.exec(source)
  const opening = /^<(span|ruby|rt|rp)(?:\s+lang\s*=\s*(?:"([a-z-]+)"|'([a-z-]+)'))?\s*>/i.exec(source)
  const match = closing ?? opening
  if (!match) return false
  const tag = match[1].toLowerCase()
  const requestedLanguage = opening?.[2] ?? opening?.[3]
  const language = requestedLanguage ? languages.get(requestedLanguage.toLowerCase()) : undefined
  if (!closing && ((requestedLanguage && !language) || (tag === 'span' && !language))) return false
  if (!silent) {
    const token = state.push('html_inline', '', 0)
    token.content = closing ? `</${tag}>` : `<${tag}${language ? ` lang="${language}"` : ''}>`
  }
  state.pos += match[0].length
  return true
})

// Images belong in validated media, never in Markdown text. Links render their
// visible content only, so shared print/browser markup has no network effects.
md.renderer.rules.image = (tokens, index) => md.utils.escapeHtml(tokens[index].content)
md.renderer.rules.link_open = () => ''
md.renderer.rules.link_close = () => ''
// Preserve HAFStudy's existing exam underline notation alongside **bold**.
md.renderer.rules.strong_open = (tokens, index) => tokens[index].markup === '__' ? '<u>' : '<strong>'
md.renderer.rules.strong_close = (tokens, index) => tokens[index].markup === '__' ? '</u>' : '</strong>'
// Historical exam __underline__ may touch a Korean particle. CommonMark's
// intraword underscore rule would otherwise leave the delimiters visible.
// This parser rule runs after code/math recognition, so formulas stay intact.
md.inline.ruler.before('emphasis', 'exam_underline', (state, silent) => {
  if (!state.src.startsWith('__', state.pos)) return false
  const end = state.src.indexOf('__', state.pos + 2)
  if (end <= state.pos + 2 || state.src[end - 1] === '\\') return false
  if (!silent) {
    const token = state.push('exam_underline', 'u', 0)
    token.content = state.src.slice(state.pos + 2, end)
  }
  state.pos = end + 2
  return true
})
md.renderer.rules.exam_underline = (tokens, index) => `<u>${md.renderInline(tokens[index].content)}</u>`

/** One CJK-aware renderer for quiz screens and exam PDFs. Only allowlisted
 * language/ruby tags are recognized; all other raw HTML/SVG stays text. */
export function renderMarkdown(value: string, inline = false): string {
  return inline ? md.renderInline(value) : md.render(value)
}

export function renderMath(latex: string, display = true): string {
  return katex.renderToString(latex, { ...mathOptions, displayMode: display })
}
