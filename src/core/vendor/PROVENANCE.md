# Canonical IQv2 engine snapshot

The adjacent `types.ts`, `validate.ts`, and `media.ts` are byte-for-byte copies of the Akademiya ImsiQuiz engine. Keep local portability and authoring policies in `../validation.ts` and `../assets.ts`; do not silently modify the canonical copy.

- Upstream repository (verified local `origin`): `https://github.com/inoyu4649/Akademiya.git`
- Upstream commit: `88f7bade7d8004c51f891961d0c6d7930d5185b2`
- Upstream paths: `imsiquiz/src/engine/{types.ts,validate.ts,media.ts}`
- Copied from the user's local Akademiya checkout on 2026-10-19 (Asia/Seoul).
- Copyright and authorship remain with the upstream project. This snapshot is included at the owner's explicit request to make the standalone desktop authoring tool work without the Akademiya checkout or server.

SHA-256 of the copied files (original CRLF/LF preserved):

| File | SHA-256 |
| --- | --- |
| media.ts | C005D94E91409B4899C4403893601A9561BE8D72012B5DA25E1CC664ABA454EA |
| types.ts | 7F2F9295310BCDE034009EF40361F926A221F3E26B629D93503BFD6DDDE6A5B6 |
| validate.ts | ABC85588E3CB0362660CB3539FD04FCB730384B35C5A19663107A4D28EAAFFCD |

To update: choose an upstream commit, replace all three files together, update this record and root `AKADEMIYA_INTEGRATION.md`, run the entire core test suite, then compare the bundled skill schemas and example fixtures against the new canonical validator. Canonical acceptance alone is deliberately insufficient for portable export: unresolved `iq://` assets, malformed raster files, nonconsecutive exam numbers, missing exam reveal policy, invalid ordering answers, and obvious diagram clipping receive additional errors.

`validateDocument` is synchronous and checks file container/header structure. Call `validateRasterDecoding` before a final export to verify actual pixels using a browser image decoder or Electron's `nativeImage` adapter. Diagram text bounds are warnings estimated without a font engine; preview and print with the bundled Noto CJK fonts before final approval. Never label automatic structure validation as factual, pedagogical, copyright, or exact PDF-layout certification.
