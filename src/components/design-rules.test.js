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

  it('음식 색 동그라미가 쓰는 색은 모두 tailwind.config.js 토큰에 있다', () => {
    for (const cls of FOOD_COLOR_CLASSES) {
      expect(tailwindColors).toHaveProperty(cls.replace(/^bg-/, ''));
    }
  });
});
