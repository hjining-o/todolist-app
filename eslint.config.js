import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

const be = (dir) => `./backend/src/${dir}`;
const fe = (dir) => `./frontend/src/${dir}`;

export default [
  { ignores: ['**/node_modules/', '**/dist/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    plugins: { import: importPlugin },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      // 레이어 규칙(Q-12): target이 from을 import하면 오류
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: be('routes'), from: be('repositories'), message: 'BE-01: routes는 services를 거친다' },
            {
              target: be('domain'),
              from: [be('config'), be('services'), be('repositories'), be('routes'), be('middleware')],
              message: 'BE-03: domain은 순수 함수만',
            },
            { target: be('repositories'), from: [be('services'), be('routes')], message: 'BE-05' },
            { target: fe('pages'), from: fe('pages'), message: 'FE-01: pages 간 import 금지' },
            { target: fe('features'), from: [fe('pages'), fe('app')], message: 'FE-02' },
            { target: fe('shared'), from: [fe('features'), fe('pages'), fe('stores')], message: 'FE-03' },
          ],
        },
      ],
    },
  },
  {
    // BE-04: pg는 config/db.js, repositories/, db/ 스크립트에서만
    files: ['backend/src/**/*.js'],
    ignores: ['backend/src/config/db.js', 'backend/src/repositories/**', 'backend/src/db/**'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: 'pg', message: 'BE-04' }] }] },
  },
  {
    files: ['backend/src/domain/**/*.js'],
    rules: { 'no-restricted-imports': ['error', { paths: ['pg', 'express'] }] },
  },
];
