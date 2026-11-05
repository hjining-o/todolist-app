import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/config/db.js';
import * as identitiesRepo from '../../src/repositories/identities.repo.js';
import * as usersRepo from '../../src/repositories/users.repo.js';
import { truncateAll } from './helpers/db.js';

beforeEach(truncateAll);
afterAll(() => pool.end());

describe('SOC-01 user_identities', () => {
  it('password_hash NULL 사용자를 만들고 identity로 조회하며, 사용자 삭제 시 함께 지워진다', async () => {
    const user = await usersRepo.insertUser(pool, { email: 's@example.com', passwordHash: null, name: '소셜' });
    await identitiesRepo.insertIdentity(pool, { provider: 'google', providerUserId: 'g1', userId: user.id });

    expect((await identitiesRepo.findUserByIdentity(pool, 'google', 'g1')).id).toBe(user.id);
    expect(await identitiesRepo.findUserByIdentity(pool, 'google', 'nope')).toBeNull();
    await expect(
      identitiesRepo.insertIdentity(pool, { provider: 'google', providerUserId: 'g1', userId: user.id }),
    ).rejects.toMatchObject({ code: '23505' });

    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    expect((await pool.query('SELECT 1 FROM user_identities')).rowCount).toBe(0);
  });
});
