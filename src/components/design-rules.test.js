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
    // 음식 색(docs/design.md "음식 색", 2026-11-26): 음식 그림에서 뽑은 옅은 면(tint-*)과 작은 점(dot-*)만 뺀다
    const offPalette = Object.entries(tailwindColors).filter(([name, hex]) => {
      if (/^(tint|dot)-/.test(name)) return false;
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

  // ---- 화면 규칙 (docs/design.md, 2026-11-25) ----

  it('간격은 눈금(4, 8, 12, 16, 24, 32)만 쓴다', () => {
    // Tailwind 숫자 1칸은 4px이다. 0.5(2px)는 같은 종류 줄 사이에만 쓴다. px-5(20), gap-5, px-7, -1.5, -2.5, 대괄호 값은 눈금 밖이다
    const ON_GRID = new Set(['0', 'px', '0.5', '1', '2', '3', '4', '6', '8']);
    const spacing =
      /(?<![\w-])-?(gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(\[[^\]]+\]|\d+(?:\.\d+)?|px)(?![\w.-])/g;
    // 굴러가는 화면 끝을 비우는 자리(떠 있는 단추 줄이나 탭 막대 높이만큼)는 묶음 사이 간격이 아니라 자리다. pb-10 이상과 pt-16만 뺀다
    const isClearance = (prop, value) => (prop === 'pb' && Number(value) >= 10) || (prop === 'pt' && value === '16');
    const found = files.flatMap(({ file, text }) => {
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
    const found = files
      .filter(({ file }) => !ORANGE_OK.includes(file))
      .map(({ file, text }) => ({ file, count: (text.match(area) || []).length }))
      .filter(({ count }) => count > 1)
      .map(({ file, count }) => `${file}: 주황 면 ${count}곳`);
    expect(found).toEqual([]);
  });

  // ---- 아래 탭, 박스 크기, 글자 (docs/design.md "떠 있는 아래 탭과 박스, 글자 정돈", 2026-11-26) ----

  it('아래 탭은 떠 있는 흰 알약, 세 칸 같은 크기, 지금 화면만 옅은 주황 원에 주황 아이콘이다', () => {
    const tab = files.find(({ file }) => file === 'src/app/(tabs)/_layout.tsx').text;
    expect(tab).toMatch(/rounded-full bg-background/);
    expect(tab).toMatch(/FLOAT_SHADOW/);
    expect(tab).toMatch(/h-full flex-1 items-center justify-center/);
    expect(tab).toMatch(/on \? 'bg-primary-soft' : ''/);
    expect(tab).toMatch(/color=\{on \? 'primary' : 'muted'\}/);
  });

  it('카드는 모서리 24(rounded-3xl), 안 여백 16이다. 모서리 16짜리 회색 카드를 새로 만들지 않는다', () => {
    const card = files.find(({ file }) => file === 'src/components/card.tsx').text;
    expect(card).toMatch(/rounded-3xl bg-surface p-4/);
    // 카드 크기의 회색 면(안 여백 p-4 이상)은 24로 맞춘다. 단추, 입력칸, 고르기 칸(높이를 정한 것)은 뺀다
    const old = /rounded-2xl bg-surface p-[468]\b/;
    const ALLOW = ['src/app/about.tsx', 'src/app/dev/parts.tsx', 'src/components/redeem-sheet.tsx'];
    const found = files
      .filter(({ file }) => !ALLOW.includes(file))
      .flatMap(({ file, text }) => text.split('\n').flatMap((line, i) => (old.test(line) ? [`${file}:${i + 1}`] : [])));
    expect(found).toEqual([]);
  });

  it('글자 크기는 역할 표에 있는 것만 쓴다. 4xl 이상은 결정이 나는 순간과 코드 화면에만', () => {
    // 표: 화면 제목 3xl, 구역과 창 제목 xl, 카드 제목 lg, 본문 base, 보조 sm, 칩과 라벨 xs, 큰 숫자 3xl
    // 2xl은 표에 없다. 그림 안 글자(아바타 72의 첫 글자, 도감의 물음표), 로고, 숫자 입력칸만 예외
    // 소개 화면(노트북 넓은 판)과 부품 견본 화면은 앱 화면이 아니라 뺀다
    const TWO_XL_OK = ['src/app/about.tsx', 'src/app/dev/parts.tsx', 'src/components/avatar.tsx', 'src/components/food-dex.tsx', 'src/components/logo.tsx', 'src/components/redeem-sheet.tsx'];
    const BIG_OK = [
      'src/components/result-moment.tsx',
      'src/components/result-card.tsx',
      'src/app/onboarding.tsx',
      'src/components/invite-card.tsx',
      'src/components/coupon-code.tsx',
      'src/app/g/[code].tsx',
      'src/components/headcount-stepper.tsx',
      'src/app/about.tsx',
      'src/app/dev/parts.tsx',
    ];
    const found = files.flatMap(({ file, text }) => {
      const bad = [];
      if (!TWO_XL_OK.includes(file) && /(?<![\w-])text-2xl(?![\w-])/.test(text)) bad.push(`${file}: text-2xl`);
      if (!BIG_OK.includes(file) && /(?<![\w-])text-[4-9]xl(?![\w-])/.test(text)) bad.push(`${file}: text-4xl 이상`);
      return bad;
    });
    expect(found).toEqual([]);
  });

  it('굵기는 역할 표대로: 800과 900은 로고만, 작은 글자(12, 14)는 700으로 쓰지 않는다 (병주 2026-11-26)', () => {
    // 굵게(700)는 읽는 순서를 정하는 곳(화면, 구역, 카드 제목과 이름, 큰 숫자, 주 단추)에만. 칩, 정보 줄, 안내 한 줄은 400이나 600
    // 로고는 글이 아니라 이름을 그린 표시라 800을 그대로 둔다
    const heavy = /(?<![\w-])font-(?:extrabold|black)(?![\w-])|fontWeight[=:]\s*\{?['"]?(?:800|900|heavy|black)/;
    const smallBold = /(?<![\w-])text-(?:xs|sm)(?![\w-])[^'"`\n]*(?<![\w-])font-bold(?![\w-])|(?<![\w-])font-bold(?![\w-])[^'"`\n]*(?<![\w-])text-(?:xs|sm)(?![\w-])/;
    const found = files.flatMap(({ file, text }) =>
      text.split('\n').flatMap((line, i) => {
        if (/^\s*(\/\/|\*|\{\/\*)/.test(line)) return [];
        const bad = [];
        if (file !== 'src/components/logo.tsx' && heavy.test(line)) bad.push(`${file}:${i + 1} 800 이상`);
        if (smallBold.test(line)) bad.push(`${file}:${i + 1} 작은 글자 700`);
        return bad;
      })
    );
    expect(found).toEqual([]);
  });

  it('단추는 주 단추만 700, 나머지 단추는 600이다', () => {
    const button = files.find(({ file }) => file === 'src/components/button.tsx').text;
    expect(button).toMatch(/primary \? 'font-bold' : 'font-semibold'/);
  });

  it('상자를 테두리로 그리지 않는다. 옅은 면으로 나눈다', () => {
    // 허용하는 선: 한쪽 구분선(border-b 등), 겹친 동그라미 사이의 바탕색 고리, 잠깐 보이는 주황 선(상태)
    const boxWidth = /(?<![\w-])border(?:-(?:\d+|\[[^\]]+\]))?(?![\w-])/;
    const ringColor = /(?<![\w-])border-(?:surface|background|primary|on-primary|transparent)(?![\w-])/;
    const styleLine = /borderColor:\s*colors(?:\.(?:muted|text|ink)\b|\[['"](?:muted|text|ink|surface-strong)['"]\])/;
    const found = files
      .flatMap(({ file, text }) =>
        text
          .split('\n')
          .flatMap((line, i) => {
            // 입력 초점선은 상자 장식이 아니다. 파일 전체가 아닌 이 클래스 선언만 허용한다.
            if (file === 'src/components/text-field.tsx' && /rounded-2xl border-2 bg-surface/.test(line) && (text.split('\n')[i + 1] ?? '').includes("focused ? 'border-ink' : 'border-surface'")) return [];
            return (boxWidth.test(line) && !ringColor.test(line)) || styleLine.test(line) ? [`${file}:${i + 1}`] : [];
          })
      );
    expect(found).toEqual([]);
  });

  it('글자를 말줄임으로 자르지 않는다. numberOfLines, ellipsizeMode, adjustsFontSizeToFit을 쓰지 않고 줄바꿈한다 (병주, 2026-11-25)', () => {
    const textDirs = ['../app', '.'].map((dir) => path.join(__dirname, dir));
    const cut = /\b(numberOfLines|ellipsizeMode|adjustsFontSizeToFit)\b/;
    const found = textDirs
      .flatMap(screenFiles)
      .flatMap((file) =>
        fs
          .readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ line: line.replace(/\s\/\/\s.*$/, ''), i }))
          .filter(({ line }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line) && cut.test(line))
          .map(({ i }) => `${path.relative(path.join(__dirname, '../..'), file)}:${i + 1}`)
      );
    expect(found).toEqual([]);
  });

  it('화면에 보이는 글을 가운뎃점(·) 같은 기호로 잇지 않는다. 조각을 간격 8로 떨어뜨린다(TextPieces)', () => {
    // 화면 파일과 화면 글을 만드는 src/api, src/hooks, src/constants를 본다. 주석 줄과 줄 끝 주석은 뺀다 (2026-11-25)
    const textDirs = ['../app', '.', '../api', '../hooks', '../constants'].map((dir) => path.join(__dirname, dir));
    const dot = /[\u00B7\u318D\u2022\u2219\u30FB]/;
    const found = textDirs
      .flatMap(screenFiles)
      .flatMap((file) =>
        fs
          .readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ line: line.replace(/\s\/\/\s.*$/, ''), i }))
          .filter(({ line }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line) && dot.test(line))
          .map(({ i }) => `${path.relative(path.join(__dirname, '../..'), file)}:${i + 1}`)
      );
    expect(found).toEqual([]);
  });

  // 2026-11-26 전체 화면 검수에서 찾은 어긋남을 다시 생기지 않게 막는다 (docs/design.md "화면 검수")
  it('굴러가는 화면의 옆 여백은 16(px-4)이다. 결과 순간과 현황판도 같은 왼쪽 선에서 시작한다', () => {
    // 창(같이 먹을 사람) 안 여백 24와 소개, 부품 견본 화면은 앱 화면 옆 여백이 아니라 뺀다
    const OK = ['src/components/headcount-modal.tsx', 'src/app/dev/parts.tsx', 'src/app/about.tsx'];
    const found = files.flatMap(({ file, text }) =>
      OK.includes(file)
        ? []
        : [...text.matchAll(/contentContainerClassName="([^"]*)"/g)]
            .filter(([, cls]) => /(?<![\w-])(?:p|px)-(?:5|6|7|8)(?![\w-])/.test(cls))
            .map(([, cls]) => `${file}: ${cls}`)
    );
    expect(found).toEqual([]);
  });

  it('창 제목은 20(text-xl)이다. 창 안에서 30 이상은 코드(아이디, 초대 코드)에만 쓴다', () => {
    const SHEETS = [
      'src/components/create-group-modal.tsx',
      'src/components/headcount-modal.tsx',
      'src/components/sheets.tsx',
      'src/components/report-sheet.tsx',
      'src/components/group-menu.tsx',
      'src/components/redeem-sheet.tsx',
    ];
    const found = files
      .filter(({ file }) => SHEETS.includes(file))
      .filter(({ text }) => /(?<![\w-])text-[3-9]xl(?![\w-])/.test(text))
      .map(({ file }) => file);
    expect(found).toEqual([]);
  });

  it('줄 단추(창의 고르기 줄, 설정 줄)는 다른 단추처럼 600이다. 확인 창의 빨간 단추는 옆 "취소"와 같은 크기다', () => {
    const sheets = files.find(({ file }) => file === 'src/components/sheets.tsx').text;
    const settings = files.find(({ file }) => file === 'src/components/settings-list.tsx').text;
    expect(sheets).not.toMatch(/text-(?:base|lg) font-bold \$\{danger/);
    expect(settings).not.toMatch(/text-base font-bold \$\{danger/);
    expect(sheets).toMatch(/text-xl font-semibold text-danger/);
  });

  it('단추 바탕색은 variant로만 정한다. Button에 className으로 bg-를 넘기지 않는다(바탕이 부딪혀 단추가 면에 묻힌다)', () => {
    const found = files.flatMap(({ file, text }) =>
      [...text.matchAll(/<Button\b[^>]*?className="([^"]*)"/gs)]
        .filter(([, cls]) => /(?<![\w-])bg-/.test(cls))
        .map(([, cls]) => `${file}: ${cls}`)
    );
    expect(found).toEqual([]);
  });

  // ---- 음식 색 (docs/design.md "음식 색", 2026-11-26) ----

  it('음식 색은 food-tint.ts에서만 고른다. 화면 파일에 bg-tint-, bg-dot- 이름을 직접 쓰지 않는다', () => {
    const direct = /(?<![\w-])(?:bg|text|border)-(?:tint|dot)-[a-z]+/;
    const found = files.filter(({ text }) => direct.test(text)).map(({ file }) => file);
    expect(found).toEqual([]);
  });

  it('음식 색 면 위 글자 대비는 4.5:1 이상이다 (회색 글자, 못 먹는 것 경고의 붉은 글자, 검정)', () => {
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const tints = Object.entries(tailwindColors).filter(([name]) => name.startsWith('tint-'));
    expect(tints.length).toBeGreaterThan(0);
    const low = tints.flatMap(([name, hex]) =>
      ['muted', 'danger', 'text'].filter((fg) => ratio(tailwindColors[fg], hex) < 4.5).map((fg) => `${name} 위 ${fg}`)
    );
    expect(low).toEqual([]);
  });

  it('음식 색 동그라미가 쓰는 색은 모두 tailwind.config.js 토큰에 있다', () => {
    for (const cls of FOOD_COLOR_CLASSES) {
      expect(tailwindColors).toHaveProperty(cls.replace(/^bg-/, ''));
    }
  });
});
