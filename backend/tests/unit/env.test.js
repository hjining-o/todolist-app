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
    const out = load({ JWT_SECRET: 's3cr3t-value-'.repeat(5), CORS_ORIGINS: 'http://localhost:5173' });
    expect(out).toContain('DATABASE_URL');
    expect(out).not.toContain('s3cr3t-value-');
  });

  it('JWT_SECRET이 48바이트 미만이면 기동 실패(W-07)', () => {
    expect(
      load({ DATABASE_URL: 'postgres://u:pw-hidden@h/db', JWT_SECRET: 'short', CORS_ORIGINS: 'http://localhost:5173' }),
    ).toContain('48바이트');
  });

  const ok = { DATABASE_URL: 'postgres://h/db', JWT_SECRET: 'x'.repeat(48), CORS_ORIGINS: 'http://localhost:5173' };

  it('필수 값이 모두 있으면 통과', () => {
    expect(load(ok)).toBe('');
  });

  it('CORS_ORIGINS가 없으면 기동 실패', () => {
    expect(load({ ...ok, CORS_ORIGINS: '' })).toContain('CORS_ORIGINS');
  });

  it('CORS_ORIGINS는 쉼표로 여러 출처를 받고, 경로·끝 /가 붙으면 기동 실패', () => {
    expect(load({ ...ok, CORS_ORIGINS: 'http://localhost:5173, https://app.example.com' })).toBe('');
    expect(load({ ...ok, CORS_ORIGINS: 'https://app.example.com/' })).toContain('https://app.example.com/');
    expect(load({ ...ok, CORS_ORIGINS: 'app.example.com' })).toContain('app.example.com');
  });

  it('토큰 만료 환경변수는 1 이상 정수만 허용(생략하면 기본값)', () => {
    expect(load({ ...ok, ACCESS_TOKEN_TTL_MINUTES: '30', REFRESH_TOKEN_TTL_DAYS: '14' })).toBe('');
    for (const bad of ['0', '-1', '1.5', '15m']) {
      expect(load({ ...ok, ACCESS_TOKEN_TTL_MINUTES: bad })).toContain('ACCESS_TOKEN_TTL_MINUTES');
      expect(load({ ...ok, REFRESH_TOKEN_TTL_DAYS: bad })).toContain('REFRESH_TOKEN_TTL_DAYS');
    }
  });

  it('COOKIE_SAMESITE는 lax·none만 허용', () => {
    expect(load({ ...ok, COOKIE_SAMESITE: 'none' })).toBe('');
    expect(load({ ...ok, COOKIE_SAMESITE: 'strict' })).toContain('COOKIE_SAMESITE');
  });
});
