import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 테스트 시작 전 테스트 DB를 초기화한다. 실패하면 예외로 vitest를 중단한다
export default function setup() {
  execFileSync(process.execPath, ['src/db/reset-test.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
  });
}
