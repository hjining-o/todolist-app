import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const envModule = new URL('../../src/config/env.js', import.meta.url).href;
const load = (env) => {
  try {
    execFileSync(process.execPath, ['-e', `import(${JSON.stringify(envModule)})`], { env, stdio: 'pipe' });
    return '';
  } catch (err) {
    return err.stderr.toString();
  }
};

describe('config/env.js', () => {
  it('환경변수가 없으면 키 이름만 담은 오류로 기동 실패', () => {
    const out = load({ JWT_SECRET: 's3cr3t-value-'.repeat(5) });
    expect(out).toContain('DATABASE_URL');
    expect(out).not.toContain('s3cr3t-value-');
  });

  it('JWT_SECRET이 48바이트 미만이면 기동 실패(W-07)', () => {
    expect(load({ DATABASE_URL: 'postgres://u:pw-hidden@h/db', JWT_SECRET: 'short' })).toContain('48바이트');
  });

  it('필수 값이 모두 있으면 통과', () => {
    expect(load({ DATABASE_URL: 'postgres://h/db', JWT_SECRET: 'x'.repeat(48) })).toBe('');
  });
});
