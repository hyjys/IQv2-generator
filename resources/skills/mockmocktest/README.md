# 모의모의고사 스킬 (mockmocktest) v2026.10.1

수능·전국연합 학력평가 직전 연습용 "모의모의고사"를 만드는 스킬입니다.
**Claude와 ChatGPT 모두에서 쓸 수 있습니다.**

## Claude에서 쓰기

1. 이 폴더를 통째로 ZIP으로 압축해 Claude의 **스킬(Skill)** 로 업로드합니다.
   (Claude Code를 쓴다면 `~/.claude/skills/mockmocktest/` 에 폴더째 넣어도 됩니다.)
2. 새 대화에서 기출 문제지 PDF를 첨부하고 "모의모의고사 만들어줘"라고 요청합니다.

## ChatGPT(또는 다른 AI)에서 쓰기

1. ZIP을 풀어 `SKILL.md` 와 `references/` 안의 파일들을 대화에 첨부합니다.
   - 최소한 `SKILL.md`, `references/00-principles.md`, 해당 체제 문서(`01-system-2027.md` 또는 `02-system-2028.md`),
     해당 영역 문서(`references/subjects/*.md`), `references/OUTPUT-SCHEMA.md`, `references/IQV2-SCHEMA.md`는 반드시 함께 넣으세요.
2. 같은 대화에 **기출 문제지 PDF 또는 해당 체제의 공식 예시문항**을 첨부합니다.
3. "첨부한 SKILL.md 절차대로 모의모의고사 exam.json을 만들어줘"라고 요청합니다.

## 무엇이 나오나요

이 스킬의 산출물은 **IQv2 2.0 `exam.json` 파일 하나**입니다. 시험지 디자인(표지·2단 본문·해설지)은
AI가 만들지 않습니다.

`exam.json`을 **HAFStudy → AI 변형 시험지** 메뉴에 올리면
문제지 PDF와 해설지 PDF가 만들어집니다. https://hafs.akademiya.kr

> 로그인한 이용자라면 사용할 수 있습니다.
> 생성된 PDF에는 내려받은 사람의 이름과 이메일이 워터마크로 들어갑니다.

## 준비물

- **(필수)** 최근 1~3개년 같은 과목의 기출 문제지 PDF 또는 해당 체제의 평가원 공식 예시문항
- (권장) 그 시험의 해설지 PDF
- **(필수)** 목표 학년도·시험 종류/월·학년·영역/선택과목·범위

첨부물이 없으면 스킬은 문항을 만들지 않고 무엇이 필요한지만 안내합니다. 정상 동작입니다.

## 개인 학습용

만들어진 시험지는 개인 학습용입니다. 첨부한 기출 원문을 그대로 복제·재배포하지 않습니다.
