// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    // 화면은 DB를 직접 부르지 않는다 (spec.md 3절 2번). Supabase 호출은 src/api, src/hooks에만 둔다
    files: ['src/app/**', 'src/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@/api/*', '**/api/*'],
              message: '화면에서는 src/hooks의 훅만 쓴다. Supabase와 src/api는 데이터 접근 폴더에서만 부른다.',
            },
          ],
        },
      ],
    },
  },
]);
