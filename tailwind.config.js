// 색은 여기 이름으로만 쓴다. 화면 파일에 색 코드를 직접 쓰지 않는다 (spec.md 3절 5번)
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 다크 모드는 아직 쓰지 않는다. 'media'면 시스템 설정과 충돌해 웹에서 오류가 난다
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#F2F2F5',
        text: '#111114',
        muted: '#6B6B76',
        primary: '#208AEF',
        'on-primary': '#FFFFFF',
        danger: '#D93636',
      },
    },
  },
  plugins: [],
};
