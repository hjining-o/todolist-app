import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// 테스트는 항상 .env.test(테스트 DB)를 쓴다. 셸 환경변수보다 우선한다
export default {
  test: {
    env: parseEnv(readFileSync(new URL('./.env.test', import.meta.url), 'utf8')),
    globalSetup: ['./tests/global-setup.js'],
    // 통합 테스트가 같은 테스트 DB를 쓰고 TRUNCATE하므로 파일을 순차 실행한다
    fileParallelism: false,
  },
};
