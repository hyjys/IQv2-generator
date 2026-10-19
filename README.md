# IQv2 Generator

Akademiya 소스나 서버 없이 IQv2 2.0 문서를 작성·검증하고 문제지와 해설지를 PDF로 만드는 MIT 라이선스의 공개 Electron 데스크톱 앱입니다. ImsiQuiz의 실제 테마 CSS와 IQv2 엔진을 포함하며, Windows·macOS·Linux용 패키지 설정과 운영체제별 CI가 있습니다.

완성된 설치 파일은 [GitHub Releases](https://github.com/hyjys/IQv2-generator/releases)에서 받습니다. Windows는 `.exe` 설치 파일 또는 `.zip`, macOS는 CPU에 맞는 `.dmg` 또는 `.zip`, Linux는 `.AppImage` 또는 `.deb`를 선택하세요. 새 버전은 같은 페이지에서 받아 설치하며 문서 JSON은 앱 바깥의 사용자 폴더에 보관합니다. 자동 업데이트는 제공하지 않습니다. 릴리스의 `SHA256SUMS.txt`로 내려받은 파일의 해시를 확인할 수 있습니다.

세 가지 제작 흐름을 지원합니다.

| 제작 흐름 | IQv2 표현 |
| --- | --- |
| 일반 IQv2 콘텐츠 | `quiz`, `exam`, `vocab`, `timeline` |
| 모의모의고사 | `kind: "exam"`, `meta.exam.kind: "mockmock"` |
| 모의내신 | `kind: "exam"`, `meta.exam.kind: "mockschool"` |

`mockmock`과 `mockschool`은 별도 최상위 `kind`가 아닙니다. 세 스킬과 공통 규격·과목별 지침의 스냅샷을 `resources/skills/`에 넣었습니다. 실제 문항의 근거 자료, 교육과정, 정답 유일성, 출처·공유 조건은 작성자가 검토해야 합니다. 앱의 형식 검증으로 문항의 학술적 정답을 증명할 수는 없습니다.

## 실행

Node.js 26 이상과 npm을 준비합니다. 이 저장소에서 한 번 설치하면 편집·문서 검증·로컬 PDF 생성에 Akademiya 프로젝트나 네트워크가 필요하지 않습니다. 공식 서비스 연결에는 인터넷과 해당 계정 로그인이 필요합니다.

```sh
npm ci
npm run dev
```

프로덕션 실행과 현재 운영체제용 설치 파일 생성:

```sh
npm run build
npm start
npm run dist
```

결과는 `release/`에 생성됩니다. Windows·macOS·Linux 모두 x64와 arm64를 지원합니다. 각각의 네이티브 CI에서 Windows NSIS·ZIP, macOS DMG·ZIP, Ubuntu 26.04 AppImage·DEB를 빌드·검증합니다. 파일명에는 OS와 아키텍처가 명시됩니다(예: IQv2-Generator-0.1.0-windows-arm64-setup.exe, IQv2-Generator-0.1.0-linux-x64.AppImage). 다른 운영체제의 실제 실행은 해당 OS의 CI 결과로 확인하세요. 로컬 Windows 검증 결과만으로 macOS·Linux 실행이 검증되었다고 간주하지 않습니다. macOS 서명·공증과 Windows 코드 서명은 별도 인증서 설정이 필요하며, 현재 CI는 서명 없이 패키징합니다. 운영체제가 게시자 확인을 요청할 수 있습니다.

| 운영체제 | 아키텍처 | 설치 파일 예시 |
| --- | --- | --- |
| Windows | x64 | `IQv2-Generator-0.1.0-windows-x64-setup.exe` |
| Windows | arm64 | `IQv2-Generator-0.1.0-windows-arm64-setup.exe` |
| macOS | x64 | `IQv2-Generator-0.1.0-macos-x64.dmg` |
| macOS | arm64 | `IQv2-Generator-0.1.0-macos-arm64.dmg` |
| Ubuntu 26.04 | x64 | `IQv2-Generator-0.1.0-linux-x64.deb` |
| Ubuntu 26.04 | arm64 | `IQv2-Generator-0.1.0-linux-arm64.deb` |

저장소 관리자가 `v0.1.0`처럼 `v*` 태그를 push하면 세 운영체제의 x64·arm64 여섯 네이티브 작업에서 빌드·검증·패키징을 마친 뒤 GitHub Release에 설치 파일과 SHA-256 체크섬을 자동 게시합니다. 한 운영체제라도 실패하면 게시하지 않습니다. 배포 워크플로에는 GitHub가 제공하는 저장소 토큰을 사용하며 코드 서명 비밀키는 포함하지 않습니다.

## 사용

1. 제작 흐름과 콘텐츠 종류를 골라 예제를 만듭니다. 예제는 편집 연습용이며 실제 시험 설계를 대신하지 않습니다.
2. 메타데이터·문항·자료를 편집하거나 UTF-8 IQv2 JSON을 엽니다. 수식·표·그래프·도형·사진과 지문을 미리 봅니다.
3. 검증 결과의 JSON 경로를 따라 오류를 고칩니다. 사진은 실제 PNG/JPEG/WebP 데이터를 포함해야 독립적으로 열 수 있습니다.
4. JSON을 저장하고 문제지·해설지 PDF를 각각 내보냅니다. PDF를 열어 페이지 넘김과 표·도형의 글자를 확인하세요.
5. JSON은 ImsiQuiz 또는 HAFStudy → 퀴즈 → 만들기 → JSON 가져오기 → 미리보기로 가져옵니다. 시험 JSON은 HAFStudy의 AI 변형 시험지에서도 사용할 수 있습니다.

정답 번호는 1부터 시작하고 시험은 `meta.revealPolicy: "atEnd"`를 사용합니다. 원격 이미지 URL과 서버 종속 `iq://` 참조는 독립 실행 검증에서 거부하므로 실제 이미지 파일로 바꾸세요. PDF는 내장 Chromium과 공식 Noto CJK·KaTeX 글꼴을 사용합니다. HAFStudy 서버의 PDF와 페이지 배치가 완전히 같다고 보장하지 않습니다.

## 공식 서비스 연결

왼쪽 **Akademiya 연결**에서 HAFStudy 홈, HAFS Tools AI 시험지, HAFStudy 퀴즈, ImsiQuiz를 전용 브라우저 창으로 엽니다. 공식 테마의 시험지는 HAFS Tools AI 시험지에서 서버 PDF를 생성하세요. 퀴즈는 각 만들기 화면에서 **JSON 가져오기**를 사용합니다. 앱은 유효한 현재 JSON을 준비하고, 사용자가 서비스의 JSON 파일 선택기를 눌렀을 때 해당 파일을 고를 수 있게 연결합니다. 로그인·최종 가져오기·게시·PDF 생성 버튼은 공식 사이트에서 직접 진행합니다.

HAFStudy와 `/quiz`는 같은 브라우저 세션으로 로그인 상태를 공유합니다. 로컬 편집 창과 로그인 세션은 격리됩니다. Akademiya 로그인은 서비스 창에서 진행할 수 있으며, Google이 내장 브라우저 로그인을 거부하면 창의 외부 브라우저 메뉴를 이용하세요. 외부 브라우저의 로그인 세션은 앱과 별개입니다. 앱/설치 파일 아이콘은 원본 ImsiQuiz 로고이며 출처는 `assets/branding/PROVENANCE.md`에 있습니다.

## AI 에이전트용 CLI

기계 판독 출력은 `--json`, 종료 코드는 성공 `0`, 문서 오류 `1`, 명령·입출력·실행 오류 `2`입니다. `npm run cli --` 뒤에 명령을 붙이거나 `npm link` 후 `iqv2`로 실행합니다. 기존 출력은 `--force`를 명시해야 덮어씁니다.

```sh
npm run cli -- schema --profile mockschool --json
npm run cli -- init --profile mockmock --out ./work/exam.json --json
npm run cli -- validate ./work/exam.json --json
npm run cli -- inspect ./work/exam.json --json
npm run cli -- render ./work/exam.json --mode questions --out ./work/questions.html --json
npm run cli -- pdf ./work/exam.json --out-dir ./work/pdf --json
```

`init`의 프로필은 `quiz`, `exam`, `vocab`, `timeline`, `mockmock`, `mockschool`입니다. `schema --json`은 필수 필드·미디어 위치·제한과 원문 규격 문서를 함께 제공합니다. `validate`는 JPEG/PNG/WebP의 실제 픽셀까지 해독합니다. `--warnings-as-errors`를 붙이면 경고도 종료 코드 `1`로 처리합니다. `render` 모드는 `questions`, `answers`, `study`이며 독립 HTML에 글꼴을 포함합니다. HTML은 모든 CJK 글리프를 포함하므로 수십 MiB일 수 있습니다. `pdf`는 `questions.pdf`와 `answers.pdf`를 모두 만듭니다.

설치한 앱 실행 파일에서도 같은 인터페이스를 사용할 수 있습니다.

```sh
"IQv2 Generator.exe" --cli validate "C:\work\exam.json" --json
"/Applications/IQv2 Generator.app/Contents/MacOS/IQv2 Generator" --cli pdf ./exam.json --out-dir ./pdf --json
./IQv2-Generator.AppImage --cli inspect ./exam.json --json
```

실제 설치 파일 이름은 `release/` 결과를 따릅니다. Node CLI의 검증·HTML 생성은 화면 없이 실행할 수 있습니다. Electron PDF 엔진은 Linux에서 화면 세션이 필요하므로 CI·서버에서는 `xvfb-run -a npm run cli -- pdf ...`로 실행합니다. JSON 문서에 임의 JavaScript를 넣어 실행하는 기능은 없습니다.

## 검증과 구조

```sh
npm run typecheck
npm test
npm run build
npm run test:desktop
```

Electron smoke test는 실제 앱을 숨겨서 실행해 샌드박스, preload API, UTF-8 JSON 열기·저장, 허가되지 않은 경로 쓰기 거부, 이미지 첨부, 문제지·해설지 PDF 생성을 확인합니다. 증거는 `artifacts/desktop-smoke/`에 남습니다. 운영체제별 패키징은 `.github/workflows/desktop.yml`에서 수행합니다.

PDF를 만들기 전에 실제 번들 Noto CJK 글꼴을 해독하고 도형의 글자·선 경계를 측정합니다. 도형 안쪽 8px 여백, 수식의 실제 열 너비, 자료의 A4 영역 초과를 검사하며 실패하면 `[PRINT_DIAGRAM_CLIP] questions[0].media[...].elements[...]` 같은 경로를 표시합니다. CLI에서는 `PRINT_PREFLIGHT`와 `issues` 배열을 JSON으로 내보내고 종료 코드 `1`을 반환합니다.

서비스 브라우저 검증은 `npm run test:services`로 실행합니다. 실제 웹콘텐츠 창에 로컬 HTTPS 테스트 페이지를 제공하고, 네이티브 확인 후에만 현재 JSON이 선택되는지·취소·일반 파일 선택·세션 공유·Node 격리를 확인합니다. 이 테스트는 실제 사이트에 업로드하지 않습니다. `node scripts/service-smoke.cjs --live`는 추가로 공식 네 페이지를 읽기 전용 GET으로 확인합니다. 로그인과 실제 서비스 가져오기·서버 PDF 변환은 사용자의 계정으로 진행해야 합니다.

| 경로 | 역할 |
| --- | --- |
| `src/core/` | 브라우저·CLI가 함께 쓰는 IQv2 검증·템플릿·이미지 검사 |
| `src/core/vendor/` | Akademiya 원본 엔진과 변경 출처 |
| `src/render/` | Markdown·KaTeX·7종 미디어·인쇄 HTML/CSS |
| `src/styles/imsiquiz-theme.css` | ImsiQuiz 원본 디자인 토큰 |
| `electron/` | 격리된 메인 프로세스·preload·PDF 엔진·CLI 번들 |
| `scripts/` | AI용 CLI, 빌드 자산 준비, 실제 Electron smoke test |
| `resources/skills/` | 세 스킬과 모든 참조 문서·예제의 독립 스냅샷 |
| `assets/` | 글꼴과 라이선스·체크섬 |

Electron renderer는 Node.js를 사용할 수 없으며 IPC는 앱의 최상위 프레임에서만 받습니다. 로컬 편집 창의 앱 외부 탐색·팝업·권한 요청·원격 네트워크 접근을 차단합니다. 별도의 서비스 브라우저 창은 전용 영구 세션으로 공식 사이트에 접속하며 Node.js나 로컬 preload API를 제공하지 않습니다. 파일은 사용자가 연 경로 또는 저장 대화상자로 선택한 경로에만 쓰며, 임시 파일을 거쳐 저장합니다. PDF 전용 창은 preload와 문서 JavaScript 없이 동작하고 인쇄 후 임시 HTML을 삭제합니다.

의존성 확인 시점은 `dependency-versions.json`, 자산 출처는 `THIRD_PARTY_NOTICES.md`, 스킬 갱신용 계약과 제한은 루트의 AI 인수인계 문서를 참고하세요. 프로젝트 소스는 `LICENSE`의 MIT 라이선스이며, 포함된 글꼴·외부 라이브러리는 각 원본 라이선스를 따릅니다.
