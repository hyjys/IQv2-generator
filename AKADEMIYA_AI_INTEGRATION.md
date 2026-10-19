---
document: akademiya-iqv2-generator-integration
contractVersion: 1
appVersion: 0.1.0
schemaVersion: "2.0"
updated: 2026-10-19
repository: https://github.com/hyjys/IQv2-generator
distribution: https://github.com/hyjys/IQv2-generator/releases
license: MIT
upstreamRepository: https://github.com/inoyu4649/Akademiya
upstreamCommit: 88f7bade7d8004c51f891961d0c6d7930d5185b2
runtimeRequiresAkademiyaCheckout: false
runtimeRequiresNetwork: false
optionalServiceBrowserRequiresNetwork: true
---

# Akademiya AI 인수인계 및 스킬 갱신 계약

이 문서는 Akademiya를 작업하는 AI가 IQv2 Generator와 세 스킬을 함께 갱신하기 위한 진입점이다. 사용자 데이터, 비밀키, Akademiya 서버·DB·로그인 코드는 포함하지 않는다. 저장소는 public MIT OSS이며 배포는 GitHub Releases를 사용한다.

## 지원 양식과 단일 원천

| 스킬 / 제작 흐름 | 문서 필드 | 앱/CLI profile |
| --- | --- | --- |
| iqv2-generator | `schemaVersion:"2.0"`, `kind:quiz|exam|vocab|timeline` | `quiz`, `exam`, `vocab`, `timeline` |
| mockmocktest | `kind:"exam"`, `meta.exam.kind:"mockmock"` | `mockmock` |
| mockschooltest | `kind:"exam"`, `meta.exam.kind:"mockschool"` | `mockschool` |

세 흐름을 네 가지 최상위 kind와 혼동하지 않는다. 시험 v1 신규 생성은 지원하지 않는다. `questions`와 `entries`를 혼합하지 않는다. IQv2 JSON 자체에 앱 전용 envelope나 출처 분석 필드를 임의로 주입하지 않는다.

원본 IQv2 계약은 Akademiya `imsiquiz/src/engine/{types,validate,media}.ts`다. 이 프로젝트의 `src/core/vendor/`는 해당 세 파일을 바이트 단위로 보존한다. SHA와 원본 경로는 `src/core/vendor/PROVENANCE.md`다. `.gitattributes`가 원본 줄바꿈 변환을 막으며 테스트가 해시를 확인한다. 구조를 바꿀 때에는 양쪽 원본과 스킬 문서를 함께 갱신하고 snapshot 변경을 명시한다. 로컬 전용 검증은 `src/core/validation.ts`와 `assets.ts`에 덧붙인다.

ImsiQuiz 원본 테마는 `src/styles/imsiquiz-theme.css`이며 `--iq-*` 토큰을 사용한다. 테마를 갱신할 때 원본 파일을 직접 덮어쓸 수 있고, 앱 배치는 `src/styles/app.css`가 담당한다. 렌더러 Markdown과 인쇄 어댑터의 정확한 출처·차이는 `src/render/PROVENANCE.md`에 기록한다. 이 앱의 PDF 레이아웃은 HAFStudy 인쇄 코드를 참고한 독립 구현이며 페이지별 완전 일치를 보장하는 호환성 계약은 아니다.

## AI Agent CLI 계약

저장소에서는 `node scripts/iqv2.cjs ...`를 사용한다. npm 안내문을 제외한 JSON만 얻으려면 `npm --silent run cli -- ...`도 가능하다. 설치 앱은 `<실행 파일> --cli ...`를 지원한다. 생성·검증·스키마 열람에 Akademiya 체크아웃이나 API 키가 필요하지 않다. PDF는 내장 Electron Chromium을 사용한다.

```sh
node scripts/iqv2.cjs schema --profile mockschool --json
node scripts/iqv2.cjs init --profile mockschool --out ./work/exam.json --json
# AI가 원자료를 읽고 work/exam.json을 직접 편집한다.
node scripts/iqv2.cjs validate ./work/exam.json --json
node scripts/iqv2.cjs inspect ./work/exam.json --json
node scripts/iqv2.cjs render ./work/exam.json --mode questions --out ./work/questions.html --json
node scripts/iqv2.cjs render ./work/exam.json --mode answers --out ./work/answers.html --json
node scripts/iqv2.cjs pdf ./work/exam.json --out-dir ./work/pdf --json
```

`init --profile`은 위 표의 여섯 값만 받는다. `render --mode`는 `questions|answers|study`다. `pdf`는 `questions.pdf`와 `answers.pdf`를 모두 만든다. 출력 파일이 존재하면 실패하며, 의도적으로 교체하려는 경우에만 `--force`를 붙인다. 경로에 공백이 있으면 쉘 규칙에 맞게 인용한다. Linux 화면 없는 환경의 PDF는 `xvfb-run -a` 아래에서 실행한다.

| 종료 코드 | 의미 | Agent의 다음 행동 |
| --- | --- | --- |
| 0 | 요청 완료 / 오류 없는 문서 | 경고 및 내용 검토 후 다음 단계 |
| 1 | IQv2 문서 오류 또는 경고를 오류로 설정 | `issues[].path`를 따라 JSON 수정 후 재검증 |
| 2 | 잘못된 명령, 경로, IO, 런타임/인쇄 실패 | 명령·파일·환경 또는 인쇄 자료 수정 |

검증 JSON의 안정적 필드: `valid`, `ok`, `profile`, `path`, `issues:[{severity,path,message,code?}]`, `stats:{questions,entries,passages,totalPoints,images,imageBytes}`. `inspect`는 meta와 kind/schemaVersion을 더한다. 메시지 문장은 사람이 읽는 정보이므로 문장 일치에 의존하지 말고 `path`와 선택적 `code`를 사용한다. `--warnings-as-errors`는 내용 검토 알림도 실패로 취급하므로 일반적인 자동 수정 루프는 먼저 `valid`와 error 항목을 본다.

## 검증 수준

1. JSON 파싱·UTF-8/BOM·문서 크기, 원본 canonical validator, 필수/선택 필드 타입, ID·참조·정답 범위·배점·시험 정책을 검사한다.
2. 독립 전달 규칙을 추가한다. 외부 URL·파일 경로·서버 종속 `iq://u/...` 이미지는 완전한 PNG/JPEG/WebP data URL로 교체해야 한다. 사진 MIME·base64·파일 구조·한 장 2MiB·합계 8MiB·실제 픽셀 해독을 검사한다. Node CLI는 sharp, GUI는 Chromium, 패키지 CLI는 Electron nativeImage를 사용한다.
3. 실제 KaTeX 파서로 미디어와 인라인 수식의 오류를 검사한다. Markdown은 허용 CJK lang/ruby 태그 외의 임의 HTML을 실행하지 않는다. 의미 있는 비교에서는 원래 코드 포인트와 IVS를 유지한다.
4. 도형 좌표·크기·획·화살촉·레이블 여백을 검사한다. 정적 글자 폭 추정은 경고이며, 실제 PDF 경로는 인쇄 미디어·A4 열 크기와 로드된 Noto CJK의 SVG getBBox를 측정해 8px 여백·페이지 크기·수식 넘침 오류를 차단한다. PRINT_PREFLIGHT 오류는 CLI 종료 1과 구체적 path로 반환한다. 직접 시각 검토도 함께 사용한다. 시험 문제지와 해설지는 서로 다른 출력이므로 두 파일을 따로 생성하고 확인한다.
5. `CONTENT_REVIEW` 같은 경고는 정답의 사실성, 유일성, 교육과정, 예상 풀이 시간, 듣기 자료, 출처·저작권 검토를 대체하지 못함을 뜻한다. 프로그램이 검증하지 않은 내용을 ‘완벽하게 확인했다’고 표현하지 않는다. 자동 출제 모델/API는 내장하지 않았으며 편집기·스킬·작업 지시서·CLI를 통해 AI 제작을 연결한다.

## 세 스킬에 반영할 권장 변경

원문 스킬과 모든 참조 파일의 스냅샷이 `resources/skills/{iqv2-generator,mockmocktest,mockschooltest}/`에 있다. 새 환경에서는 이 폴더만으로 규격을 열람할 수 있다. 스킬의 본래 산출물은 계속 UTF-8 IQv2 JSON 하나이며, PDF·검증 보고서는 별도 보조 산출물이다.

- 검증 단계에 위 CLI 명령과 Releases 설치 링크를 넣는다. Akademiya 소스가 없는 컴퓨터에서도 검증·인쇄할 수 있다는 점을 안내한다. 서버 가져오기 미리보기도 최종 환경의 호환성 확인으로 유지한다.
- iqv2-generator는 네 종류를 모두 검증한다. vocab의 방향·정의, timeline의 정렬·중복, 모든 중첩 미디어 위치를 검사한다. PDF 독립 이미지 규칙을 quiz/exam 공통으로 적용한다.
- mockmocktest는 목표 시험 학년도·해당 체제 기출·공식 예시를 요구하고, 학년만으로 학년도를 고정하지 않는다. mockschooltest는 학교 기출과 이번 범위가 모두 필요하다. 자동 형식 통과를 출제 근거 확보로 간주하지 않는다.
- 필적 문구는 사용자가 선택한 문구 또는 빈칸 의사를 유지한다. 앱 템플릿은 빈칸으로 시작하므로 템플릿에 임의 문구를 채워 넣지 않는다. 제한 자료는 `confidential:true`로 표시한다.
- 도형 검증에는 실제 전체 Noto CJK 글꼴을 사용한다. `assets/fonts/manifest.json`은 공식 OTF 원본·WOFF2 변환·SHA를, `regional-shaping-audit.json`은 ko/ja/Hans/Hant/HK 자형 선택과 IVS 지원 근거를 기록한다. 언어 태그를 문자 자체 변환으로 설명하지 않는다.

**발견된 원본 예제 오류:** 제공된 `mockschooltest/references/example.json`은 `meta.exam.kind:"mockmock"`이며 학교 `organization`이 없다. mockmocktest 예제와 동일하다. 스킬 담당자는 모의내신 예제를 `mockschool`과 실제 예시 학교명으로 교정해야 한다. 이 프로젝트는 출처 보존을 위해 스냅샷과 테스트 fixture를 그대로 유지하고 `createTemplate('mockschool')`에서 올바른 독립 예제를 제공한다. 예제 문항 수나 학년도는 실제 시험 설계로 복사하지 않는다.

## 저장소 작업·배포·검증

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:desktop
npm run dist
```

`build`는 내장 CJK·KaTeX 자산과 CLI를 먼저 생성한다. `public/render-assets.css`, `public/print-preflight.js`, `dist/`, `electron/cli-bundle.cjs`, `release/`, `artifacts/`는 생성물이며 Git에 넣지 않는다. 글꼴 원본과 라이선스는 Git에 보관한다. npm 라이브러리는 업데이트 전 registry 최신 버전을 확인하고 exact version과 lockfile을 함께 갱신한다. 확인한 버전은 `dependency-versions.json`이다. global-agent 4.1.3 override는 electron-builder의 취약한 roarr/sprintf-js 전이 경로를 제거하기 위한 것으로, override 변경 시 패키징·감사를 다시 수행한다.

`.github/workflows/desktop.yml`은 Windows·macOS·Linux Ubuntu 26.04의 x64/arm64 여섯 네이티브 runner에서 검증하고 NSIS/ZIP, DMG/ZIP, AppImage/DEB를 만든다. `v*` 태그에서는 여섯 작업 모두 성공하고 각 OS/arch의 두 배포 파일이 존재하는지 확인한 뒤 GitHub Release와 SHA256SUMS.txt를 게시한다. 서명 인증서는 포함하지 않으며 자동 업데이트는 없다. 버전 변경은 package.json과 lockfile, 본 문서·릴리스 정보를 함께 갱신한다. UI 버전은 package.json을 읽는다. CI 완료 여부와 아티팩트를 직접 확인한 뒤 해당 플랫폼 검증을 보고한다.

파일명은 `IQv2-Generator-${version}-${platform}-${arch}.${ext}`이며 NSIS는 `-setup.exe`로 끝난다. platform은 `windows|macos|linux`, arch는 `x64|arm64`로 고정한다. electron-builder가 Linux 확장자에 따라 x64를 `x86_64`·`amd64`로 확장하므로 `scripts/normalize-artifacts.cjs`의 afterAllArtifactBuild 훅이 실제 파일명을 x64로 통일한다. DEB 내부 아키텍처 메타데이터는 배포 표준을 유지한다. Release 게시 전에 OS/arch별 두 파일, 합계 12개가 정확히 있는지 검사한다.

## 주요 파일 API

선택적인 공식 서비스 브라우저는 `electron/services.cjs`가 담당한다. 접속 목적은 HAFS Tools AI 서버 테마의 PDF와 실제 퀴즈 업로드다. 검증한 경로는 `https://hafs.akademiya.kr/tools/exam-papers`, `https://hafs.akademiya.kr/quiz/?view=create`, `https://iq.akademiya.kr/?view=create`다. `openService({service,text?})`는 고정된 네 목적지만 받는다(`hafstudy`, `exam`, `hafquiz`, `imsiquiz`). 영구 서비스 세션을 로컬 창과 격리하고, HAFStudy 홈과 `/quiz`에는 같은 세션을 쓴다. Chromium이 공식 쿠키·OAuth를 관리하며 토큰을 복사하지 않는다. 원격 창은 preload·Node API를 받지 않는다.

Electron에 존재하지 않는 `select-file` 이벤트를 구현했다고 가정하지 않는다. 실제 파일 전달은 Chromium CDP의 사용자 파일 선택 이벤트와 파일 입력 노드를 확인하는 지원 인터페이스를 사용한다. 단일 JSON 선택기·공식 서비스 origin·사용자 확인 조건을 만족할 때만 앱이 준비한 임시 `.json`을 선택한다. 실제 가져오기·게시·서버 PDF 생성은 원격 사이트에서 사용자가 따로 실행한다. 파일 준비가 업로드 완료를 뜻하지 않는다. Google의 내장 브라우저 OAuth 제한을 User-Agent 변조로 우회하지 않으며, 외부 브라우저는 별개 세션임을 안내한다.

| 위치 | 공개 계약 |
| --- | --- |
| `src/core/index.ts` | `createTemplate(profile)`, `parseDocument(text)`, `validateDocument(value)`, `validateRasterDecoding(value,decoder?)`, `schemaGuide` |
| `src/render/index.ts` | `renderDocument(doc,mode)`, `printStyles`, `getStandaloneHtml(doc,mode,baseUrl?)`, `validateRenderDocument(doc)` |
| `src/render/assets.ts` | Node 전용 `buildOfflineAssetCss(rootDir)`; 브라우저에 fs 모듈을 번들하지 않는다 |
| `scripts/cli.ts` | `runCli(args,context)`를 Node bin과 패키지 Electron이 공유 |
| `electron/preload.cjs` | `window.desktop`: `openDocument`, `saveDocument`, `chooseImage`, `exportPdf`, `appInfo` |
| `src/main.ts` | 구조/원본 편집, 메타데이터·지문·미디어·작업 지시서, 자동 초안, 검증·인쇄 연결 |

테스트 fixture는 원본 여섯 예제와 전 문항/미디어 형식을 포함한다. 원본 snapshot SHA, XSS 방어, CJK 자형·IVS, 소수 배점, 1-based 정답, 선택지 미디어·해설 미디어, 악성·손상·과대 입력, 실제 이미지 decode, CLI 종료 코드, 실제 Electron 파일 왕복과 두 PDF를 검증한다. 사용자 문서나 원본 비공개 시험은 테스트 fixture로 커밋하지 않는다.
