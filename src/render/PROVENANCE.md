# Rendering provenance and integration

Sources: `hyjys/Akademiya`, revision `88f7bade7d8004c51f891961d0c6d7930d5185b2`, local checkout `C:/Users/이민기/Desktop/개발/Akademiya`.

- `imsiquiz/src/engine/markdown.ts` → `src/render/markdown.ts`, copied unchanged. This is the canonical CJK-aware Markdown, KaTeX/mhchem, underline, safe lang/ruby tokenizer. Raw HTML is disabled. Links lose their destinations and Markdown images render as text.
- `gmc/server/examContent.ts` → media projection in `src/render/index.ts`, adapted to remove server logos/assets and to regenerate every SVG attribute from finite numbers or allowlisted colors. The seven IQv2 media types are preserved at every nesting location.
- `gmc/server/examPaper.ts` → print hierarchy in `src/render/styles.ts` and document projections in `index.ts`: cover, name/signature boxes, two columns, passage boxes/author attribution, question media, choices, answer table and explanation/source pages. ImsiQuiz violet replaces HAFStudy blue. Desktop prints use Chromium pagination, not the server's custom pagination; layout identity with the service is not claimed.

Public browser API:

```ts
renderDocument(doc, 'questions' | 'answers' | 'study') // BODY fragment
printStyles // CSS string
getStandaloneHtml(doc, mode, baseUrl?) // complete script-free document
setRenderAssetCss(applicationOwnedCss) // optional data font/CSS injection
```

Node-only `assets.ts` exports `buildOfflineAssetCss(rootDir)` and `renderOfflineDocument(doc, mode, rootDir)`. The application build writes the former to `public/render-assets.css`; Electron injects the resulting CSS when printing. Browser components may import `fonts.css` and `katex/dist/katex.min.css` when displaying the body in the same DOM. An iframe must use `getStandaloneHtml` with its application asset directory or inject the same asset CSS.

`renderDocument` expects a validated IQv2 document. Defensive escaping is still performed if validation is bypassed. Missing `iq://` upload images produce a visible unresolved-image diagnostic rather than fetching from the network. Question mode excludes answer and explanation fields. Study mode intentionally includes solutions.

All printed SVGs expose `data-media-kind`, question cards expose `data-question-number`, and SVG text exposes `data-diagram-text`, so Chromium can measure clipping and label bounds using the actual bundled font. No renderer result proves factual correctness or unique solvability of an authored question.

Fonts come from the official `notofonts/noto-cjk` repository, pinned revision in `assets/fonts/manifest.json`; SHA-256 values cover original OTF bytes and bundled WOFF2 bytes. fontTools repackages them into WOFF2, retaining all glyphs, metrics, variation sequences and regional `locl` substitutions; font metadata/checksums may be normalized. The actual families are `Noto Sans CJK KR` and `Noto Serif CJK KR`, not similarly named Google Fonts KR subsets. These language-specific CJK OTFs include the full pan-CJK glyph set; `lang` and explicit OpenType language selection choose Japanese, Simplified Chinese, Taiwan and Hong Kong forms from `locl` without shipping four near-identical fonts. Their SIL OFL notices are in `assets/licenses/`.

Regional glyph verification performed 2026-10-19 using uharfbuzz 0.56.3 against both actual bundled WOFF2 fonts, decompressed losslessly to sfnt in memory. Each font contains 65,535 glyphs, cmap format 14 for variation sequences, and GSUB language systems JAN/KOR/ZHH/ZHS/ZHT. Shaping `骨直令葛辻漢` under ko/ja/zh-Hans/zh-Hant/zh-HK produces five distinct sequences of glyph IDs. Exact results are saved in `assets/fonts/regional-shaping-audit.json`. This confirms regional substitutions in the bundled files; visual validation still runs in the app's Chromium renderer for the particular document.

`preflight.ts` exports the application-owned, self-contained `printPreflightScript` used by Electron's isolated world while page JavaScript is disabled. It loads actual bundled fonts, decodes every image, measures SVG element/text bounds against an 8px internal margin, and checks unbreakable media/display math against Chromium's measured A4 print area. Errors carry the exact `data-media-path` source location. It is emitted to `dist/print-preflight.js` during the build. `tests/render-audit-prepare.ts` and `tests/render-visual-audit.cjs` exercise comprehensive question and answer output; `tests/ui-smoke.cjs` exercises the built app via Playwright. Generated PDF/PNG files live under ignored `artifacts/`.
