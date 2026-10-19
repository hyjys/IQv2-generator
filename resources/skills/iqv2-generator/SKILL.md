---
name: iqv2-generator
description: 학습 자료나 사용자가 지정한 주제로 ImsiQuiz·HAFStudy 퀴즈에 업로드할 IQv2 퀴즈, 시험, 단어장, 연표 JSON을 만든다. ChatGPT와 Claude에서 같은 지침을 쓴다.
---

# IQv2 콘텐츠 생성

ImsiQuiz·HAFStudy 퀴즈·HAFStudy PDF 시험지가 함께 읽는 **IQv2 2.0 JSON 파일 하나**를 만든다. `kind: "exam"`은 HAFStudy의 AI 변형 시험지 메뉴에서 PDF로 만들 수 있다. 신규 시험에 옛 exam.json v1 규격을 쓰지 않는다.

## 시작

사용자가 콘텐츠 종류(`quiz` 퀴즈, `exam` 시험, `vocab` 단어, `timeline` 연표), 주제·범위, 분량을 지정했는지 확인한다. 빠진 핵심 조건만 묻는다. 첨부 자료를 기준으로 만들어 달라는 요청이면 그 자료를 읽기 전에는 내용을 채우지 않는다. 일반 주제 생성은 사용자가 허용한 범위에서 가능하다.

## 작성

1. [IQv2 규격](references/IQV2-SCHEMA.md)을 읽고 요청한 종류의 필드와 정답 규칙을 따른다. 필요하면 [네 종류 예제](references/examples/) 중 해당 파일을 참고한다.
2. 학습 자료의 사실·범위에 맞는 항목을 작성한다. 근거가 모호한 연도, 정의, 정답은 추측하지 말고 자료에서 확인하거나 사용자에게 확인한다. 첨부 문항을 그대로 베끼지 말고 요청 목적에 맞게 새로 출제한다.
3. 퀴즈·시험은 모든 문항의 정답과 `explanation.correct`를 채우고, 선택지가 중복되거나 정답이 여러 개인지 점검한다. 단어는 뜻과 언어 방향, 연표는 실제 시간순 `sortKey`를 점검한다.
4. 최종 결과를 UTF-8 `iqv2.json` 파일로 제공한다. JSON 외의 해설 문서나 HTML을 파일 안에 섞지 않는다. 사용 환경에서 파일 생성이 불가능하면 JSON 코드 블록만 제공한다.
5. 사용자에게 **ImsiQuiz 또는 HAFStudy → 퀴즈 → 만들기 → JSON 가져오기 → 미리보기**에서 검사한 뒤 가져오도록 안내한다. 미리보기 오류가 나오면 오류 경로를 기준으로 JSON을 수정한다.

## 품질·호환성

- 최상위 `schemaVersion`은 문자열 `"2.0"`; `kind`는 네 종류 중 하나다. 파일은 유효한 JSON이어야 하며 주석·마크다운·후행 쉼표를 넣지 않는다.
- `quiz`·`exam`에는 `questions`, `vocab`·`timeline`에는 `entries`를 넣는다. `exam`은 정답을 문항마다 공개하지 않도록 `meta.revealPolicy: "atEnd"`로 둔다.
- 정답 번호는 **1부터** 센다. 5지선다는 1~5, OX는 1(O)·2(X)다. 단답·순서 배열의 정답은 `answerText` 배열이다.
- 수식은 LaTeX, 표는 table, 그래프는 graph, 복합도형은 diagram으로 제공한다. 사진은 검증된 PNG/JPEG/WebP를 base64 data URL로 포함하거나 실제 발급된 `iq://u/<32자리 16진수>`를 사용한다. PDF 독립 전달에는 이미지 데이터를 포함한다. 외부 URL·가짜 주소·자리표시자를 만들지 않는다. PDF 생성 이미지는 서버에서 임시 사용 후 정리된다.
- 공개 콘텐츠에 개인정보, 비공개 시험 원문, 출처를 알 수 없는 장문의 발췌를 넣지 않는다. 사용자가 제공한 자료에 공유 제한이 있으면 공개 업로드 전에 그 제한을 알린다.

## ChatGPT와 Claude

Claude의 스킬 업로드에는 이 폴더가 들어 있는 ZIP을 사용한다. ChatGPT에서는 `SKILL.md`의 지침을 맞춤 GPT 지침이나 대화에 넣고 `references/IQV2-SCHEMA.md`와 필요한 예제 파일을 함께 제공한다. 두 환경 모두 최종 산출물은 같은 IQv2 JSON이다.
