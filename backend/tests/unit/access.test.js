import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryOwned, todoCanEdit, todoIsOwner, todoVisible } from '../../src/repositories/sql/access.js';

const srcDir = join(import.meta.dirname, '../../src');
const accessPath = join(srcDir, 'repositories/sql/access.js');
const fns = { todoVisible, todoCanEdit, todoIsOwner, categoryOwned };
const badValues = ['1', '1 OR true', '6f1c2b1e-0000-4000-8000-000000000000', 0, -1, 1.5, NaN, undefined];

describe('API-04 권한 SQL 조각 (단위)', () => {
  describe.each(Object.entries(fns))('%s', (_name, fn) => {
    it.each(badValues)('잘못된 파라미터 번호 %j는 TypeError (SQL 인젝션 방지)', (n) => {
      expect(() => fn(n)).toThrow(TypeError);
    });

    it('파라미터는 지정한 $3만 사용한다 (R2)', () => {
      const sql = fn(3);
      expect(sql.match(/\$\d+/g)).toSatisfy((m) => m.length > 0 && m.every((x) => x === '$3'));
    });
  });

  it('access.js는 import가 없다 (순수 문자열 모듈)', () => {
    expect(readFileSync(accessPath, 'utf8')).not.toMatch(/^\s*import\b/m);
  });

  it('권한 조건은 access.js에만 있다 (R19, R21 단일 출처)', () => {
    const files = readdirSync(srcDir, { recursive: true })
      .filter((f) => f.endsWith('.js'))
      .map((f) => join(srcDir, f))
      .filter((f) => f !== accessPath);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/role\s+IN\s*\(\s*'OWNER'\s*,\s*'MANAGER'\s*\)/);
      expect(text, f).not.toMatch(/\b[tc]\.owner_id\s*=\s*\$/);
    }
  });
});
