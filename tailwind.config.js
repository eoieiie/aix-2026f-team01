// 색은 여기 이름으로만 쓴다. 화면 파일에 색 코드를 직접 쓰지 않는다 (spec.md 3절 5번)
// 값은 src/constants/colors.json 한곳에 있다. SVG처럼 className을 못 받는 곳은 그 파일에서 같은 이름으로 꺼낸다
// 주황 하나를 강조색으로 쓰고 나머지는 검정, 흰색, 회색만 쓴다 (spec.md 7절)
const colors = require('./src/constants/colors.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 다크 모드는 아직 쓰지 않는다. 'media'면 시스템 설정과 충돌해 웹에서 오류가 난다
  darkMode: 'class',
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
