# 시험지 검증용 Noto CJK 글꼴

도형의 글자 크기·여백을 재거나 인쇄 결과를 검증할 때 읽는다. HAFStudy 서버는 본문에 Noto Serif CJK, 도형·기능성 텍스트에 Noto Sans CJK를 사용한다. 다른 글꼴에서 통과한 자료가 서버에서는 영역을 넘을 수 있으므로 **Noto CJK를 검증에 사용한다**.

## 설치 확인과 미설치 시 호출

1. 한국어 시험지는 `Noto Sans CJK KR`와 `Noto Serif CJK KR`의 실제 설치 여부를 확인한다. `Noto Sans KR`·`Noto Serif KR` 또는 일반 sans-serif/serif가 있다는 것만으로 같은 글꼴이라고 판단하지 않는다. Linux의 `fc-match`는 미설치 시 대체 글꼴을 반환하므로 반환된 **family 이름**을 확인한다. Windows·macOS는 등록된 글꼴 목록이나 글꼴 파일의 family 메타데이터를 확인한다. 브라우저의 `document.fonts.check()`만으로 시스템 설치 여부를 판정하지 않는다.
2. 필요한 Noto CJK가 설치되어 있으면 그 글꼴을 명시해 사용한다. **없으면 공식 저장소에서 해당 글꼴을 임시 작업 폴더로 다운로드하고 검증 렌더러에 로드한다.** 사용자에게 시스템 설치를 요구하거나 자동으로 시스템 글꼴 폴더를 수정하지 않는다. 같은 작업에서 받은 파일은 재사용한다.
3. 한국어 Regular 글꼴의 직접 다운로드 주소:
   - Sans: `https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf`
   - Serif: `https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/Korean/NotoSerifCJKkr-Regular.otf`
   파일 다운로드 실패나 빈 응답을 성공으로 처리하지 않는다. 필요한 굵기·일본어·중국어 지역별 글꼴은 [공식 Sans 안내](https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md)와 [공식 Serif 안내](https://github.com/notofonts/noto-cjk/blob/main/Serif/README.md)에서 해당 OTF를 고른다. 원문 언어와 `lang`에 맞는 JP·SC·TC·HK 자형을 유지한다.

## 임시 렌더러에 로드

Chromium 검증에서는 다운로드한 OTF 바이트를 `@font-face`의 `data:font/otf;base64,...`로 포함하고, 본문은 Serif CJK KR, 도형·레이블은 Sans CJK KR를 명시한다. 글꼴의 실제 메타데이터와 같은 family 이름을 사용한다. 다른 시스템 글꼴이 먼저 선택되지 않도록 검증용 CSS의 우선순위도 확인한다. 아래는 **검증 HTML용 예시**이며 최종 `exam.json`에 넣는 내용이 아니다.

```css
@font-face {
  font-family: 'Noto Sans CJK KR';
  src: url(data:font/otf;base64,실제_OTF_바이트의_base64) format('opentype');
  font-weight: 400;
}
@font-face {
  font-family: 'Noto Serif CJK KR';
  src: url(data:font/otf;base64,실제_OTF_바이트의_base64) format('opentype');
  font-weight: 400;
}
body { font-family: 'Noto Serif CJK KR', serif; }
.media-figure svg { font-family: 'Noto Sans CJK KR', sans-serif; }
```

측정 전에 필요한 글꼴의 `document.fonts.load(...)`와 `document.fonts.ready`를 기다리고 로드 오류를 확인한다. 이미지 기반 검증이면 같은 OTF 파일을 해당 렌더러에 직접 지정한다. HAFStudy 서버 인쇄 경로는 외부 네트워크 요청을 차단하므로 검증 HTML에도 외부 폰트 URL·로컬 파일 URL을 남기지 않고 실제 바이트를 포함한다.

그 뒤 [출력 규격의 도형 여백](OUTPUT-SCHEMA.md#도형의-글자와-인쇄-여백)을 확인하고 문제지·해설지 각각의 출력 성공과 잘림 여부를 검사한다. 검증 도구나 네트워크가 없어 글꼴을 로드할 수 없으면 Noto CJK 인쇄 검증 미완료를 밝힌다. 폰트 파일·CSS·검증 PDF를 최종 시험지 JSON의 자료로 추가하지 않는다.
