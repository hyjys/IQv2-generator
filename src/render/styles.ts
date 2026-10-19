/** HAFStudy examPaper.ts print hierarchy with the ImsiQuiz violet palette. */
export const printStyles = `
@page { size:A4; margin:14mm 12mm 16mm; }
* { box-sizing:border-box; }
html,body { margin:0; padding:0; background:white; color:#1f2937; }
.iq-print-document { font-family:'Noto Serif CJK KR',serif; font-size:10pt; line-height:1.65; overflow-wrap:anywhere; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.iq-print-document p { margin:0 0 2mm; }
.iq-print-document h1,.iq-print-document h2,.iq-print-document h3,.iq-label,.iq-eyebrow,.iq-question-number,.iq-answer-grid,.iq-cover,.iq-points,.iq-category { font-family:'Noto Sans CJK KR',sans-serif; }
.iq-document-head { border-bottom:2px solid #7c3aed; padding:0 0 5mm; margin:0 0 6mm; break-after:avoid; }
.iq-document-head h1 { font-size:21pt; line-height:1.35; margin:1mm 0 0; }
.iq-eyebrow { color:#7c3aed; font-size:9pt; font-weight:700; letter-spacing:.03em; }
.iq-subtitle { color:#6b7280; font-size:10pt; margin:2mm 0 0!important; }
.iq-cover { height:250mm; break-after:page; page-break-after:always; display:flex; flex-direction:column; }
.iq-cover > * { flex-shrink:0; }
.iq-cover-period { align-self:flex-start; padding:3mm 7mm; border:1.6px solid #7c3aed; border-radius:9mm; color:#6d28d9; font-size:13pt; font-weight:700; }
.iq-cover-title { font-size:15pt; text-align:center; margin-top:9mm; }
.iq-cover h1 { text-align:center; font-size:34pt; margin:4mm 0 10mm; line-height:1.3; }
.iq-name-row { display:flex; justify-content:center; gap:6mm; margin:0 0 10mm; }
.iq-name-row > div { display:flex; align-items:center; border:1.4px solid #374151; border-radius:3mm; padding:3mm; font-weight:700; }
.iq-name-row span { display:inline-block; width:45mm; }
.iq-cover-notice { padding:8mm; border:1px solid #374151; border-radius:4mm; font-size:11pt; }
.iq-cover-notice p { margin-bottom:5mm; }
.iq-signature { margin:3mm 0 7mm; min-height:13mm; border:1px dashed #6b7280; background:#f5f3ff; display:flex; align-items:center; justify-content:center; padding:2mm; font-size:12pt; letter-spacing:.1em; }
.iq-cover-bottom { margin-top:auto; background:#ede9fe; border-radius:3mm; padding:4mm; text-align:center; font-weight:700; }
.iq-cover-org { text-align:center; margin-top:8mm; font-size:15pt; font-weight:700; }
.iq-two-columns { column-count:2; column-gap:8mm; column-rule:1px solid #e5e7eb; }
.iq-question { margin-bottom:6mm; break-inside:avoid; }
.iq-prompt { margin-bottom:2mm; font-weight:600; }
.iq-prompt .katex { font-weight:400; }
.iq-question-number { font-weight:700; margin-inline-end:1mm; }
.iq-points { color:#6d28d9; font-size:9pt; white-space:nowrap; }
.iq-choices { list-style:none; padding:0; margin:2mm 0 0; }
.iq-choices li { display:flex; gap:1mm; margin:0 0 1.2mm; }
.iq-choices li > div { flex:1; min-width:0; }
.iq-choice-number { flex:none; width:4.5mm; }
.iq-short-answer { border-bottom:1px solid #6b7280; width:40mm; height:9mm; }
.iq-essay-space { height:34mm; background:repeating-linear-gradient(transparent,transparent 8mm,#d1d5db 8mm,#d1d5db calc(8mm + 1px)); }
.iq-passage { margin-bottom:5mm; }
.iq-passage-head { font-weight:700; margin-bottom:2mm; break-after:avoid; }
.iq-passage-body { background:#f5f3ff; border:1px solid #ddd6fe; padding:3.5mm 4mm; border-radius:2mm; }
.iq-passage-body p { text-align:justify; }
.iq-attribution { text-align:right; font-size:8pt; color:#6b7280; margin-top:2mm; }
.iq-box { border:1px solid #4b5563; border-radius:2mm; padding:3mm; margin:2.5mm 0; font-size:9pt; break-inside:avoid; }
.iq-label { text-align:center; font-weight:700; margin-bottom:1.5mm; }
.iq-answer-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1mm; margin:0 0 7mm; font-size:9pt; }
.iq-answer-grid > div { display:flex; border:1px solid #ddd6fe; min-width:0; }
.iq-answer-grid span { background:#f5f3ff; padding:1.5mm; text-align:center; min-width:7mm; }
.iq-answer-grid strong { flex:1; padding:1.5mm; text-align:center; }
.iq-solution { margin-bottom:5mm; break-inside:avoid; }
.iq-solution h3 { margin:0 0 2mm; font-size:10pt; break-after:avoid; }
.iq-answer { color:#6d28d9; }
.iq-intent { font-weight:700; }
.iq-others { border-top:1px solid #e5e7eb; padding-top:2mm; color:#4b5563; margin-top:2mm; }
.iq-source { color:#6b7280; font-size:8pt; break-inside:avoid; }
.iq-media { margin:2mm 0; text-align:center; break-inside:avoid; }
.iq-media img,.iq-media svg { display:block; max-width:100%; max-height:85mm; height:auto; margin:0 auto; object-fit:contain; }
.iq-media svg { width:100%; font-family:'Noto Sans CJK KR',sans-serif; font-size:13px; overflow:visible; }
.iq-media.iq-shape svg { width:auto; }
.iq-media figcaption,.iq-graph-key { font-size:8pt; margin-top:1mm; line-height:1.45; }
.iq-table-wrap { max-width:100%; margin:2mm 0; }
.iq-print-document table { table-layout:fixed; border-collapse:collapse; width:100%; font-size:8.5pt; }
.iq-print-document td,.iq-print-document th { border:1px solid #94a3b8; padding:1.5mm; overflow-wrap:anywhere; vertical-align:top; }
.iq-print-document tr { break-inside:avoid; }
.iq-print-document caption { font-weight:700; margin-bottom:1mm; }
.iq-print-document th { background:#f5f3ff; }
.iq-math { break-inside:avoid; max-width:100%; }
.iq-print-document .katex { font-size:1.05em; direction:ltr; text-indent:0; }
.iq-print-document .katex-display { margin:.5em 0; overflow:visible; }
eqn,section.eqn { display:block; text-align:center; }
.iq-study-table { font-size:10pt!important; }
.iq-study-table th:first-child { width:30%; }
.iq-study-table th,.iq-study-table td { padding:3mm; }
.iq-study-table small { display:block; color:#6b7280; font-size:8pt; font-weight:400; }
.iq-example { padding-left:2mm; border-left:2px solid #ddd6fe; margin:2mm 0; }
.iq-vocab-blank { min-height:12mm; border-bottom:1px dotted #94a3b8; }
.iq-timeline { list-style:none; padding:0; margin:0; }
.iq-timeline li { display:grid; grid-template-columns:30mm minmax(0,1fr); gap:5mm; padding:3mm 0 5mm; border-bottom:1px solid #e5e7eb; break-inside:avoid; }
.iq-timeline h3 { font-size:11pt; margin:0 0 1.5mm; }
.iq-timeline-year { color:#6d28d9; font-weight:700; }
.iq-category { color:#6b7280; font-size:8pt; }
.iq-confidential { color:#b91c1c; font-family:'Noto Sans CJK KR',sans-serif; font-size:8pt; margin-bottom:3mm; }
.iq-missing-media { color:#b91c1c; padding:3mm; border:1px dashed #f87171; font-size:9pt; }
.iq-print-document [lang]:lang(ja) { font-family:'Noto Serif CJK KR',serif; font-language-override:'JAN'; }
.iq-print-document [lang]:lang(zh-Hans),.iq-print-document [lang="zh"],.iq-print-document [lang="zh-CN"],.iq-print-document [lang="zh-SG"] { font-family:'Noto Serif CJK KR',serif; font-language-override:'ZHS'; }
.iq-print-document [lang]:lang(zh-Hant),.iq-print-document [lang="zh-TW"] { font-family:'Noto Serif CJK KR',serif; font-language-override:'ZHT'; }
.iq-print-document [lang="zh-HK"],.iq-print-document [lang="zh-MO"] { font-family:'Noto Serif CJK KR',serif; font-language-override:'ZHH'; }
ruby { ruby-position:over; ruby-align:center; } rt { font-size:.55em; line-height:1; }
.iq-print-document pre { white-space:pre-wrap; }
.iq-print-document u { text-underline-offset:2px; }
@media screen { body:has(>.iq-print-document) { padding:8mm; } }
@media print { .iq-cover { height:250mm; } .iq-document-head { margin-top:0; } }
`;
