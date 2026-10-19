# IQv2 2.0 공통 출력 규격

원천은 ImsiQuiz `src/engine/types.ts`와 `validate.ts`다. ImsiQuiz·HAFStudy 퀴즈·HAFStudy PDF 시험지가 함께 사용한다. 실제 업로드 검증 결과가 최종 판정이다.

## 공통

```json
{"schemaVersion":"2.0","kind":"quiz","meta":{"title":"제목","language":"ko"},"questions":[]}
```

`kind`는 `quiz`, `exam`, `vocab`, `timeline`. `meta.title`은 비어 있지 않은 문자열이다. `subject`, `subtitle`, `description`, `tags`는 선택이다. `language`는 UI 언어 `ko`·`en`·`ja`·`zh`이며 제2외국어 문항의 원문은 어느 문자든 담을 수 있다. `difficulty`는 1~5 정수다.

초 단위 시간은 정수다. `minSolveTimeSec`는 0~86400, `timeLimitSec`는 `null` 또는 1~86400이며 최소 시간이 제한 시간보다 길면 안 된다. `mode`는 `practice` 또는 `exam`; `revealPolicy`는 `perQuestion` 또는 `atEnd`다. `kind: "exam"`은 `atEnd`를 쓴다. `shuffleQuestions`, `shuffleChoices`, `leaderboard`는 불리언. 실제 시험 배열을 유지하려면 섞기 두 값을 `false`로 둔다.

인쇄 메타데이터는 `meta.exam`에 둔다: `{kind:"mockmock"|"mockschool",grade?:1|2|3,periodLabel?:string,organization?:string,system?:string,confidential?:boolean,signaturePhrase?:string}`. `system`은 목표 학년도 문자열이다. 문항 수·총점은 문항 배열에서 계산한다. 옛 v1의 메타 필드나 최상위 kind를 섞지 않는다.

## 퀴즈·시험 문항

`questions`에는 하나 이상 문항이 필요하다. `number`는 중복 없는 1 이상 정수. `points`는 0보다 크고 1000 이하인 **0.5 단위 숫자**(예: 1, 1.5, 2, 2.5, 3, 4). `prompt`와 `explanation.correct`는 비어 있지 않은 문자열이다.

| type | 정답 | 주의 |
|---|---|---|
| `5지선다` | 문자열 5개의 `choices`, 숫자 1~5의 `answer` | 선택지에 ① 등의 접두 번호를 붙이지 않는다. |
| `OX` | O는 `answer:1`, X는 `answer:2` | choices 생략 가능 |
| `단답형` | `answerText:["허용 답안", "..."]` | `matchMode:"exact"|"normalized"` |
| `서술형` | `answerText:["모범답안"]` 권장 | 단계별 채점 기준을 해설에 쓴다. 자동 채점에 제약이 있다. |
| `순서 배열` | 2개 이상 `choices`, 정답 순서의 문자열 배열 `answerText` | 선택 항목과 정답 항목 텍스트가 일치해야 한다. |

`explanation`은 `{correct:string,intent?:string,others?:string[],media?:IqMedia[]}`다. 문항에 `tags`, `shuffle`, `minSolveTimeSec`, `timeLimitSec`를 선택적으로 넣는다. 정규화 비교는 대소문자·공백·구두점을 완화하므로 구분이 중요한 수학·언어 답안에는 `exact`를 쓴다.

## 공유 지문·보기·미디어 위치

공유 지문은 `passages: [{id:"p1",body:"...",range:[1,3],instruction:"...",boxes:[],media:[],source:"...",author:"...",work:"..."}]`로 저장한다. `id`, `body` 외 필드는 선택이다. 문항 `passageId`는 존재하는 지문의 id 또는 `null`이다. 보기 상자는 `{label:string,body:string,media?:IqMedia[]}`이다.

`media` 배열은 **문항·지문·보기 상자·해설**에 놓을 수 있다. 문항의 `choiceMedia`는 `choices`와 같은 길이의 **자료 배열의 배열**이며 자료가 없는 선택지는 `[]`로 둔다. 자료를 텍스트와 어느 순서로 읽어야 하는지 발문·레이블에서 분명히 한다.

텍스트는 `**굵게**`, `__밑줄__`, `*기울임*`, `~~취소선~~`와 `$인라인 LaTeX$`·`$$블록 LaTeX$$`를 쓸 수 있다. 일본어·중국어의 언어별 글자 모양과 독음은 아래 허용 인라인 태그를 사용한다. 그 밖의 원시 HTML·스크립트는 넣지 않는다. JSON 문자열에서 LaTeX의 역슬래시는 `\\`로 저장한다.

## 일본어·중국어 글자 모양과 독음

리치텍스트 필드(지문·발문·선택지·보기·해설·paragraph·표의 문자열) 안에서는 다음 **인라인 태그만** 사용한다. 문서 전체 HTML이나 CSS를 만들지 않는다.

- 언어 지정: `<span lang="ja">日本語</span>`, `<span lang="zh-Hans">简体中文</span>`, `<span lang="zh-Hant">繁體中文</span>`.
- 허용 lang 값은 `ja`, `zh`, `zh-Hans`, `zh-Hant`, `zh-CN`, `zh-SG`, `zh-TW`, `zh-HK`, `zh-MO`다. 일반 간체/번체 구분은 Hans/Hant를, 대만·홍콩 등 지역 자형이 중요하면 해당 지역 값을 쓴다. 목록에 없는 조합을 임의로 추가하지 않는다.
- 독음: `<ruby lang="ja">学校<rp>(</rp><rt>がっこう</rt><rp>)</rp></ruby>`. `ruby`·`rt`·`rp`도 같은 lang 값만 선택적으로 받으며 자식은 부모의 언어를 이어받는다. 독음이 정답을 누설하는 문항에는 ruby를 넣지 않는다.
- 속성은 **lang만** 허용한다. 따옴표로 값을 감싸고 닫는 태그를 쓴다. `style`·`class`·이벤트·`dir`·`img`·`rb`·`rtc` 등 허용 목록 밖 마크업은 표시용 문자로 처리되므로 사용하지 않는다. 사진은 image 미디어로 넣는다.
- lang는 같은 한자의 **지역별 글자 모양을 선택하기 위한 정보**다. 간체·번체·신자체·구자체로 글자 자체를 변환하지 않는다. 예를 들어 `国`과 `國`, `学`과 `學`의 구별이 필요하면 해당 문자를 실제로 써야 한다.
- 원문 코드 포인트와 이미 제공된 IVS(한자+variation selector)를 보존한다. 임의 간체화·번체화·호환 정규화나 variation selector 제거를 하지 않는다. IVS를 추측해서 만들지 않으며, 특정 변형 글자 모양을 정확히 평가하려면 실제 출력 폰트의 지원 여부도 확인한다.
- `answerText`는 태그 없는 실제 답안 문자열이다. 문자 차이를 채점해야 한다면 `matchMode:"exact"`를 쓰고 허용하는 이체자만 별도 답안으로 명시한다. SVG diagram의 text·그래프 축 레이블·이미지 alt처럼 일반 문자열로 처리되는 곳에는 HTML 태그를 넣지 않는다.

```json
{
  "type": "paragraph",
  "text": "일본어: <ruby lang=\"ja\">学校<rp>(</rp><rt>がっこう</rt><rp>)</rp></ruby> / 간체: <span lang=\"zh-Hans\">学校</span> / 번체: <span lang=\"zh-Hant\">學校</span>"
}
```

근거 확인일: 2026-09-28. [W3C의 언어 속성·상속과 글꼴 선택](https://www.w3.org/International/questions/qa-css-lang), [W3C의 ruby·rt·rp 설명](https://www.w3.org/TR/html-ruby-extensions/), [Unicode의 variation sequence·IVS 정의](https://www.unicode.org/reports/tr37/)를 참고했다. 위 태그/속성 허용 범위는 웹 표준 전체가 아니라 IQv2 렌더러의 지원 범위다.

## IqMedia 블록

| type | 필드 |
|---|---|
| `paragraph` | 비어 있지 않은 `text` |
| `math` | 비어 있지 않은 `latex`, 선택 불리언 `display` |
| `table` | 문자열 2차원 배열 `rows`, 선택 `headers:string[]`·`caption:string`; 1~200행·1~30열, 모든 행과 머리글의 열 수 일치 |
| `graph` | `graphType:"bar"|"line"`, `points:[{label:string,value:number}]` 2~20개, 선택 `title`; 값은 유한한 수 |
| `shape` | `shape:"rectangle"|"circle"|"triangle"|"line"|"arrow"`, 선택 `label`·`stroke`·`fill`·`width`·`height`; 색은 `#RRGGBB`, 너비 32~800, 높이 32~500 |
| `image` | `src`, 비어 있지 않은 `alt`, 선택 `width` |
| `diagram` | `width`·`height` 32~1600, `elements` 1~300개, 선택 `caption` |

graph는 범주 간 간격이 일정하다. 수치 x축 간격·함수 곡선·기하 조건이 중요하면 diagram으로 좌표를 계산한다. 이미지 src는 업로드가 발급한 `iq://u/<32자리 16진수>` 또는 완전한 `data:image/png;base64,...`·`data:image/jpeg;base64,...`·`data:image/webp;base64,...`다. 외부 URL·SVG·파일 경로는 허용하지 않는다. PNG/JPEG/WebP는 이미지 1개 최대 2MiB, 문서 합계 8MiB(해독한 바이트). 이미지를 프로그램으로 인코딩하며 base64를 상상해서 쓰지 않는다. HAFStudy PDF로 독립 전달할 이미지는 data URL로 포함한다. PDF 서버는 렌더링 중 임시 사용 후 정리하며 원본을 보관하는 기능이 아니다.

### diagram.elements

좌표 원점은 왼쪽 위, x는 오른쪽, y는 아래다. 모든 좌표는 유한한 숫자이고 절댓값 10000 이하다. 실제 도형은 width/height 안에 들어오게 설계한다.

- 선/화살표: `{type:"line"|"arrow",x1,y1,x2,y2}`
- 원: `{type:"circle",cx,cy,r}`
- 타원: `{type:"ellipse",cx,cy,rx,ry}`
- 사각형: `{type:"rect",x,y,width,height}`
- 꺾은선/다각형: `{type:"polyline"|"polygon",points:[[x,y],[x,y],...]}`
- 문자: `{type:"text",x,y,text,fontSize?:number,anchor?:"start"|"middle"|"end"}`; 생략 시 `fontSize:16`, `anchor:"start"`로 퀴즈·PDF에 동일하게 적용한다.

공통 선택 필드: `stroke:"#RRGGBB"`, `fill:"#RRGGBB"|"none"`, `strokeWidth:number`. 원의 반지름과 사각형/타원의 크기는 양수다. raw SVG·HTML·외부 자원·이벤트 핸들러·임의 path 문자열을 넣지 않는다. 도형의 글자는 짧은 레이블로 쓰고 복잡한 수식은 math로 분리한다.

```json
{
  "type": "diagram",
  "width": 240,
  "height": 160,
  "caption": "삼각형 ABC (단위: cm)",
  "elements": [
    {"type":"polygon","points":[[30,120],[190,120],[30,30]],"fill":"none","stroke":"#111111"},
    {"type":"text","x":20,"y":140,"text":"A"},
    {"type":"text","x":195,"y":140,"text":"B"},
    {"type":"text","x":20,"y":20,"text":"C"}
  ]
}
```

## 단어

`meta.vocab`은 `sourceLang`, `targetLang` 비어 있지 않은 문자열과 `testDirections` 배열이 필요하다. 방향은 `term2meaning`, `meaning2term`, `definition2term`. 정의→단어 방향에는 정의가 있어야 한다.

`entries` 각 항목은 중복 없는 양의 정수 `id`, 문자열 `term`, 비어 있지 않은 문자열 배열 `meaning`이 필수다. `reading`, `pos`, `definition`, `example`, `exampleMeaning`, `note`, `category`는 선택이다. 문제는 서버가 생성하므로 `questions`를 만들지 않는다. 오답 구성이 가능하도록 구별되는 항목을 5개 이상 준비한다.

## 연표

`entries`의 각 항목은 양의 정수 `id`, 보이는 연도 문자열 `year`, 시간순 정수 `sortKey`, 문자열 `event`가 필수다. 허용 연도 배열 `yearAnswer`, `detail`, 문자열 배열 `category`는 선택이다. `meta.timeline.modes`는 `browse`, `flashcard`, `yearQuiz`, `eventQuiz`, `orderQuiz` 배열이다. 순서 퀴즈는 2개 이상 사건이 필요하고 사건명이 겹치지 않아야 한다. `questions`를 만들지 않는다.

## 검증

JSON 파싱, 빈 배열·필수 문자열, 중복 ID/번호, 지문 참조, 정답·해설·배점, 자료 필드와 크기를 확인한다. IQv1의 0부터 시작하는 정답이나 exam v1의 문자열 answer를 섞지 않는다. 파일에는 JSON 밖 설명·펜스·주석·자리표시자를 넣지 않는다.
