# Third-party and source notices

## Akademiya / ImsiQuiz / HAFStudy

User-requested source extraction from the local Akademiya checkout, repository `inoyu4649/Akademiya`, source revision `88f7bade7d8004c51f891961d0c6d7930d5185b2`.

- `src/core/vendor/`: shared IQv2 types, media helpers and canonical validator. Exact source paths and SHA-256 values are in `src/core/vendor/PROVENANCE.md`.
- `src/render/markdown.ts`: the canonical ImsiQuiz Markdown implementation. Media projection and print layout are adaptations described in `src/render/PROVENANCE.md`.
- `src/styles/imsiquiz-theme.css`: original `imsiquiz/src/shared/themes.css`, retained as an independent source file.
- `assets/branding/`: original ImsiQuiz logo plus PNG/ICO/ICNS app icons; source hash and conversion details are in its PROVENANCE.md.
- `resources/skills/`: snapshots of the explicitly requested `iqv2-generator`, `mockmocktest`, and `mockschooltest` skills and their references.

The owner explicitly requested an independent public open-source distribution of these sources. This project's source distribution uses the MIT license in root `LICENSE`. External libraries and fonts retain their own licenses; trademark/brand ownership remains with the respective owner.

## Noto CJK

The actual full Noto Sans CJK KR and Noto Serif CJK KR fonts are bundled, including full pan-CJK glyphs and language-specific `locl` substitutions. Original official OTF files are losslessly compressed into WOFF2. The source revision, original/derived SHA-256 values and the compression procedure are recorded in `assets/fonts/manifest.json`. License texts:

- `assets/licenses/Noto-CJK-Sans-OFL.txt`
- `assets/licenses/Noto-CJK-Serif-OFL.txt`

These fonts use the SIL Open Font License, Version 1.1. Their names and copyright statements are retained. No font editor or operating-system font installation is required at runtime.

## npm dependencies

Dependency versions are pinned in `package-lock.json`; registry versions checked before installation are recorded in `dependency-versions.json`. The installed package LICENSE/NOTICE files remain authoritative and are included by the package manager and desktop packager where applicable.

| Component | Purpose | License family |
| --- | --- | --- |
| Electron / Chromium | Desktop runtime and PDF generation | MIT; Chromium component notices |
| electron-builder | Native installation packages | MIT |
| KaTeX | Offline mathematical typesetting and fonts | MIT |
| markdown-it | Safe Markdown tokenization | MIT |
| markdown-it-cjk-friendly | CJK-aware emphasis rules | MIT |
| markdown-it-texmath | Math integration | MIT |
| sharp / libvips | Full Node CLI raster decoding | Apache-2.0; LGPL-2.1-or-later for libvips |
| pdf-lib | PDF tooling | MIT |
| tsx | Development TypeScript execution | MIT |
| TypeScript, Vite, esbuild | Typecheck and bundling | Apache-2.0; MIT |

Electron distributes Chromium third-party notices with its runtime. This document records provenance and is not a substitute for those notices or for the original package licenses.
