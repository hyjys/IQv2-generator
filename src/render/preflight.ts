export interface PrintPreflightIssue { code: string; path: string; message: string }

/** Self-contained so Electron can execute this in an isolated world with page JS disabled. */
export async function preflightDocument(document: Document): Promise<PrintPreflightIssue[]> {
  const issues: PrintPreflightIssue[] = [];
  const add = (code: string, path: string, message: string) => { issues.push({ code, path, message }); };
  const location = (node: Element, fallback: string) => {
    const media = node.closest('[data-media-path]');
    if (media) return media.getAttribute('data-media-path') || fallback;
    const question = node.closest('[data-question-number],[data-answer-number]');
    if (question) return `questions[number=${question.getAttribute('data-question-number') || question.getAttribute('data-answer-number')}]`;
    return fallback;
  };
  const required = ['Noto Sans CJK KR', 'Noto Serif CJK KR'];
  for (const family of required) {
    try {
      const loaded = await document.fonts.load(`16px "${family}"`);
      if (!loaded.some(font => font.family.replace(/["']/g, '') === family && font.status === 'loaded')) add('PRINT_FONT', '$', `${family} 실제 번들 글꼴을 불러오지 못했습니다.`);
    } catch { add('PRINT_FONT', '$', `${family} 글꼴을 해독할 수 없습니다.`); }
  }
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map(async (image, index) => {
    try { await image.decode(); if (!image.naturalWidth || !image.naturalHeight) throw new Error('empty'); }
    catch { add('PRINT_IMAGE', location(image, `images[${index}]`), '이미지를 해독할 수 없습니다. 실제 PNG/JPEG/WebP 파일로 다시 포함하세요.'); }
  }));
  const svgs = document.querySelectorAll<SVGSVGElement>('[data-media-kind="diagram"] svg');
  svgs.forEach((svg, index) => {
    const view = svg.viewBox.baseVal; const padding = 8;
    const path = location(svg, `diagrams[${index}]`);
    if (!(view.width > 0 && view.height > 0)) { add('PRINT_DIAGRAM', path, '도형 viewBox 크기가 올바르지 않습니다.'); return; }
    Array.from(svg.children).forEach((node, elementIndex) => {
      if (!('getBBox' in node)) return;
      const element = node as SVGGraphicsElement;
      try {
        const box = element.getBBox();
        const stroke = Number.parseFloat(getComputedStyle(element).strokeWidth) || 0;
        const edge = element.tagName.toLowerCase() === 'text' ? 0 : stroke / 2;
        if (box.x - edge < view.x + padding || box.y - edge < view.y + padding || box.x + box.width + edge > view.x + view.width - padding || box.y + box.height + edge > view.y + view.height - padding) {
          const label = element.tagName.toLowerCase() === 'text' ? `글자 “${element.textContent?.slice(0, 45)}”` : `도형 요소 ${elementIndex + 1}`;
          add('PRINT_DIAGRAM_CLIP', `${path}.elements[${elementIndex}]`, `${label}의 실제 Noto CJK 경계가 도형 안쪽 8px 여백을 넘습니다. 좌표·글자 크기 또는 도형 크기를 조정하세요.`);
        }
      } catch { add('PRINT_DIAGRAM', `${path}.elements[${elementIndex}]`, '도형 요소의 실제 경계를 측정할 수 없습니다.'); }
    });
  });
  // Convert physical print units through Chromium's own CSS pixel measurement.
  const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;width:186mm;height:267mm;pointer-events:none'; document.body.append(probe);
  const page = probe.getBoundingClientRect(); probe.remove();
  document.querySelectorAll<HTMLElement>('.iq-media,.iq-math,.iq-table-wrap').forEach((node, index) => {
    const rect = node.getBoundingClientRect();
    if (rect.height > page.height + 1) add('PRINT_PAGE_HEIGHT', location(node, `renderedMedia[${index}]`), '한 장의 인쇄 영역보다 큰 자료입니다. 자료를 나누거나 크기를 줄이세요.');
    // The closest rendered block is already constrained to its column by CSS.
    if (node.scrollWidth > node.clientWidth + 2 || rect.width > page.width + 2) add('PRINT_PAGE_WIDTH', location(node, `renderedMedia[${index}]`), '자료가 실제 인쇄 열 너비를 넘습니다. 수식을 나누거나 자료 폭을 조정하세요.');
  });
  document.querySelectorAll<HTMLElement>('.katex-display').forEach((node, index) => {
    const math = node.querySelector('.katex');
    if (math && math.getBoundingClientRect().width > node.getBoundingClientRect().width + 2) add('PRINT_MATH_WIDTH', location(node, `displayMath[${index}]`), '표시 수식이 인쇄 열 너비를 넘습니다. aligned 등으로 수식을 나누세요.');
  });
  return issues;
}

export const printPreflightScript = `(${preflightDocument.toString()})(document)`;
