// 화면 파일이 명세의 디자인 규칙을 지키는지 검사한다 (spec.md 3절 5번, 7절)
// 파일을 읽어야 해서 Node의 fs를 쓴다. 앱 코드가 아니라 테스트라 .js로 둔다 (앱의 타입 검사에 Node 타입이 없다)
/* global __dirname, describe, it, expect */
const fs = require('fs');
const path = require('path');

const { FOOD_COLOR_CLASSES } = require('./food-dot');
const tailwindColors = require('../../tailwind.config.js').theme.extend.colors;

// 화면 폴더(src/app, src/components)의 .ts, .tsx 파일을 모두 읽는다. 테스트 파일은 뺀다
const SCREEN_DIRS = ['../app', '.'].map((dir) => path.join(__dirname, dir));

function screenFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return screenFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = SCREEN_DIRS.flatMap(screenFiles).map((file) => ({
  file: path.relative(path.join(__dirname, '../..'), file),
  text: fs.readFileSync(file, 'utf8'),
}));

// 다른 가지에서 고치는 중인 화면이다. "프레즐 규칙 그대로" 검사 세 개에서 잠깐 뺀다.
// 통일 점검 PR에서 이 목록을 비운다. 여기에 새 파일을 더하지 말고 화면을 규칙에 맞춘다
const NOT_YET = [
  'src/app/dev/',
  'src/components/legal-page.tsx',
];
const checked = files.filter(({ file }) => !NOT_YET.some((prefix) => file.startsWith(prefix)));

describe('디자인 규칙', () => {
  it('화면 파일에 색 코드를 직접 쓰지 않는다. tailwind.config.js의 색 이름만 쓴다', () => {
    // '#fff'처럼 따옴표로 감싼 값과 bg-[#fff]처럼 className 안에 대괄호로 넣은 값을 모두 잡는다
    const hex = /(?:['"`]#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})['"`])|(?:-\[#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\])/i;
    const found = files.filter(({ text }) => hex.test(text)).map(({ file }) => file);
    expect(found).toEqual([]);
  });

  it('앱 화면에 이모지를 쓰지 않는다', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const found = files.filter(({ text }) => emoji.test(text)).map(({ file }) => file);
    expect(found).toEqual([]);
  });

  it('색은 주황 하나와 검정, 흰색, 회색만 쓴다', () => {
    // 회색 계열(채도 0.1 미만)이거나 주황 계열(색상 15~35도)이어야 한다
    const offPalette = Object.entries(tailwindColors).filter(([, hex]) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const light = (max + min) / 2;
      const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
      if (sat < 0.1) return false;
      const hue = max === r ? (60 * (g - b)) / (max - min) : max === g ? 120 : 240;
      return !(hue >= 15 && hue <= 35);
    });
    expect(offPalette).toEqual([]);
  });

  // ---- 프레즐 규칙 그대로 (docs/design.md, 2026-11-25) ----

  it('간격은 눈금(4, 8, 12, 16, 24, 32)만 쓴다', () => {
    // Tailwind 숫자 1칸은 4px이다. 0.5(2px)는 같은 종류 줄 사이에만 쓴다. px-5(20), gap-5, px-7, -1.5, -2.5, 대괄호 값은 눈금 밖이다
    const ON_GRID = new Set(['0', 'px', '0.5', '1', '2', '3', '4', '6', '8']);
    const spacing =
      /(?<![\w-])-?(gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(\[[^\]]+\]|\d+(?:\.\d+)?|px)(?![\w.-])/g;
    // 굴러가는 화면 끝을 비우는 자리(떠 있는 단추 줄이나 탭 막대 높이만큼)는 묶음 사이 간격이 아니라 자리다. pb-10 이상과 pt-16만 뺀다
    const isClearance = (prop, value) => (prop === 'pb' && Number(value) >= 10) || (prop === 'pt' && value === '16');
    const found = checked.flatMap(({ file, text }) => {
      const bad = new Set();
      for (const [whole, prop, value] of text.matchAll(spacing)) {
        if (!ON_GRID.has(value) && !isClearance(prop, value)) bad.add(whole);
      }
      return bad.size > 0 ? [`${file}: ${[...bad].join(' ')}`] : [];
    });
    expect(found).toEqual([]);
  });

  it('주황 면은 파일 하나에 한 곳까지다. 룰렛 결과 순간과 결과 카드만 예외', () => {
    // 주황은 포인트로만 쓴다: 주 단추 하나나 상태 알약 하나. 고른 상태는 검정(bg-ink)으로 보인다
    const ORANGE_OK = ['src/components/result-moment.tsx', 'src/components/result-card.tsx'];
    const area = /\bbg-primary(?:-soft)?\b|backgroundColor:\s*colors(?:\.primary\b|\[['"]primary(?:-soft)?['"]\])/g;
    const found = checked
      .filter(({ file }) => !ORANGE_OK.includes(file))
      .map(({ file, text }) => ({ file, count: (text.match(area) || []).length }))
      .filter(({ count }) => count > 1)
      .map(({ file, count }) => `${file}: 주황 면 ${count}곳`);
    expect(found).toEqual([]);
  });

  it('상자를 테두리로 그리지 않는다. 옅은 면으로 나눈다', () => {
    // 허용하는 선: 한쪽 구분선(border-b 등), 겹친 동그라미 사이의 바탕색 고리, 잠깐 보이는 주황 선(상태)
    const BORDER_OK = {
      'src/components/text-field.tsx': '쓰는 중인 입력칸의 검정 선 (상태 표시)',
      'src/components/roulette.tsx': '바늘 삼각형을 테두리로 그린다',
    };
    const boxWidth = /(?<![\w-])border(?:-(?:\d+|\[[^\]]+\]))?(?![\w-])/;
    const ringColor = /(?<![\w-])border-(?:surface|background|primary|on-primary|transparent)(?![\w-])/;
    const styleLine = /borderColor:\s*colors(?:\.(?:muted|text|ink)\b|\[['"](?:muted|text|ink|surface-strong)['"]\])/;
    const found = checked
      .filter(({ file }) => !(file in BORDER_OK))
      .flatMap(({ file, text }) =>
        text
          .split('\n')
          .flatMap((line, i) =>
            (boxWidth.test(line) && !ringColor.test(line)) || styleLine.test(line) ? [`${file}:${i + 1}`] : []
          )
      );
    expect(found).toEqual([]);
  });

  it('음식 색 동그라미가 쓰는 색은 모두 tailwind.config.js 토큰에 있다', () => {
    for (const cls of FOOD_COLOR_CLASSES) {
      expect(tailwindColors).toHaveProperty(cls.replace(/^bg-/, ''));
    }
  });
});
