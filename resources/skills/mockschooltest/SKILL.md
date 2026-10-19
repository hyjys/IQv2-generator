---
name: mockschooltest
description: 학교 기출 문제지와 시험 범위 자료를 분석해 중간·기말 대비 모의내신을 만든다. 학교별 문항 관행을 따라 수식·사진·그래프·도형을 담은 Akademiya 공통 IQv2 exam.json을 출력하며 HAFStudy에서 PDF로 만든다.
metadata:
  version: v2026.10.1
---

# 모의내신 출제

해당 학교의 기출과 이번 시험 범위를 기준으로 연습 시험지를 만든다. 최종 산출물은 **IQv2 2.0 `kind: "exam"`인 `exam.json`** 하나다.

## 필요한 자료

해당 학교의 최근 1~3개년 같은 과목 기출 문제지와 이번 시험 범위(교과서 단원·쪽수, 진도표, 시험 공지 등)가 **둘 다 필요하다**. 하나라도 없으면 빠진 자료만 요청한다. 이미 제공한 조건을 다시 묻지 않는다. 학교명·학년·과목·중간/기말 여부를 확인하고, 학교 학습지·정답/해설이 있으면 함께 읽는다.

## 출제

1. [기출 분석](references/01-analyze-past-papers.md)으로 유형·배점·서술형 비중·자료·난도를 정리하고 핵심 분석을 사용자에게 보여준다.
2. [범위 확인](references/02-scope-materials.md), [공통 원칙](references/00-principles.md), [공유 제한](references/03-copyright.md)을 읽는다.
3. [국어](references/subjects/korean.md), [수학](references/subjects/math.md), [영어](references/subjects/english.md), [사회·과학](references/subjects/social-science.md) 중 해당 지침을 읽는다. 다른 과목은 기출·교과서의 성취기준과 자료 형식을 직접 분석한다.
4. 학교의 출제 관행과 범위에 맞게 새 문항·자료를 만든다. 번호별 유형을 무조건 고정하지 않는다. 수식·표·사진·그래프·도형을 실제 IQv2 미디어로 넣어 자료 해석 과정을 보존한다.
5. 단답은 `answerText`, 서술은 `type: "서술형"`과 모범답안을 쓰고 단계별 채점 기준을 해설에 넣는다.
6. [공통 출력 규격](references/OUTPUT-SCHEMA.md), [IQv2 규격](references/IQV2-SCHEMA.md), [예제](references/example.json)를 따라 검증한다. 도형이 있으면 공통 출력 규격의 **도형의 글자와 인쇄 여백** 기준으로 제목·축·범례를 확인한다. 측정·인쇄 검증은 [Noto CJK 글꼴](references/PRINT-FONTS.md)을 사용하고, 시스템에 없으면 공식 글꼴을 임시로 받아 호출한다. 인쇄 검증이 가능하면 문제지와 해설지를 각각 확인한다. `meta.exam.kind: "mockschool"`, `meta.exam.organization`에 학교명을 저장한다.
7. HAFStudy → **AI 변형 시험지**에 JSON을 올려 문제지·해설지 PDF를 만들도록 안내한다.

최종 JSON 전에 필적 문구가 정해지지 않았다면 한 번 묻고 학교 시험은 빈칸도 가능하다고 안내한다. 이미 받은 의사는 다시 묻지 않는다. 받은 문구는 `meta.exam.signaturePhrase`에 넣고 빈칸 선택 시 생략한다. 답변을 기다리며 문항 작성·검증은 계속한다. 공유 제한 표시가 있는 자료는 `meta.exam.confidential: true`로 둔다. 사진은 파일에 포함해 PDF 생성 중에만 서버가 사용하며 외부 이미지 URL·가짜 base64를 만들지 않는다.
