import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as categoriesRepo from '../../src/repositories/categories.repo.js';
import { truncateAll, createUser, createCategory, createTodo } from './helpers/db.js';
import { agentFor } from './helpers/agent.js';

const URL = '/api/categories';
const catRows = async (ownerId) =>
  (await pool.query('SELECT id, name FROM categories WHERE owner_id = $1 ORDER BY name', [ownerId])).rows;
const todoCats = async (ownerId) =>
  (await pool.query('SELECT id, category_id, updated_at FROM todos WHERE owner_id = $1 ORDER BY id', [ownerId])).rows;

// A의 Work에 할일 3건, 기본에 1건 / B 할일 1건
async function seedDeleteCase() {
  const a = await createUser();
  const b = await createUser();
  const work = await createCategory({ ownerId: a.id, name: 'Work' });
  for (let i = 0; i < 3; i++) await createTodo({ ownerId: a.id, categoryId: work.id });
  await createTodo({ ownerId: a.id, categoryId: a.defaultCategoryId });
  await createTodo({ ownerId: b.id, categoryId: b.defaultCategoryId });
  return { a, b, work };
}

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('카테고리 CRUD', () => {
  it('EX-19 목록은 본인 것만, 기본 먼저 이후 이름 오름차순, 키는 id·isDefault·name', async () => {
    const a = await createUser();
    const b = await createUser();
    await createCategory({ ownerId: a.id, name: 'Work' });
    await createCategory({ ownerId: a.id, name: 'Alpha' });
    await createCategory({ ownerId: b.id, name: 'Zeta' });

    const res = await agentFor(a.id).get(URL);
    expect(res.status).toBe(200);
    expect(res.body.items.map((c) => c.name)).toEqual(['기본', 'Alpha', 'Work']);
    expect(res.body.items[0].isDefault).toBe(true);
    for (const c of res.body.items) expect(Object.keys(c).sort()).toEqual(['id', 'isDefault', 'name']);
  });

  it('생성은 trim한 이름으로 201, 응답과 DB 모두 trim 값', async () => {
    const a = await createUser();
    const res = await agentFor(a.id).post(URL).send({ name: '  스터디  ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: res.body.id, name: '스터디', isDefault: false });
    const { rows } = await pool.query('SELECT name, is_default FROM categories WHERE id = $1', [res.body.id]);
    expect(rows).toEqual([{ name: '스터디', is_default: false }]);
  });

  it('경계 이름 한글 50자는 201, 51자는 400', async () => {
    const agent = agentFor((await createUser()).id);
    expect((await agent.post(URL).send({ name: '가'.repeat(50) })).status).toBe(201);
    const res = await agent.post(URL).send({ name: '가'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('name');
  });

  it('EX-15 생성: 대소문자·공백만 다른 이름은 409 CATEGORY_NAME_TAKEN', async () => {
    const a = await createUser();
    await createCategory({ ownerId: a.id, name: 'Work' });
    const agent = agentFor(a.id);
    for (const name of [' work ', 'WORK']) {
      const res = await agent.post(URL).send({ name });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_NAME_TAKEN');
    }
    expect(await catRows(a.id)).toHaveLength(2);
  });

  it('EX-15 변경: 다른 카테고리 이름과 대소문자만 달라도 409', async () => {
    const a = await createUser();
    await createCategory({ ownerId: a.id, name: 'Work' });
    const home = await createCategory({ ownerId: a.id, name: 'Home' });
    const res = await agentFor(a.id).patch(`${URL}/${home.id}`).send({ name: 'WORK' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_NAME_TAKEN');
    const { rows } = await pool.query('SELECT name FROM categories WHERE id = $1', [home.id]);
    expect(rows[0].name).toBe('Home');
  });

  it('EX-16 다른 사용자는 같은 이름을 쓸 수 있다', async () => {
    const a = await createUser();
    const b = await createUser();
    await createCategory({ ownerId: a.id, name: 'Work' });
    const res = await agentFor(b.id).post(URL).send({ name: 'Work' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Work');
  });

  it('EX-17 생성·변경 공백만 이름은 400 fields.name', async () => {
    const a = await createUser();
    const work = await createCategory({ ownerId: a.id, name: 'Work' });
    const agent = agentFor(a.id);
    const results = [
      await agent.post(URL).send({ name: '   ' }),
      await agent.patch(`${URL}/${work.id}`).send({ name: '   ' }),
    ];
    for (const res of results) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty('name');
    }
  });

  it.each([
    ['name 누락', {}, 'name'],
    ['name 숫자', { name: 123 }, 'name'],
    ['name null', { name: null }, 'name'],
    ['정의되지 않은 필드', { name: 'X', isDefault: true }, 'isDefault'],
  ])('V %s → 400 VALIDATION_ERROR', async (_n, body, field) => {
    const a = await createUser();
    const res = await agentFor(a.id).post(URL).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
    expect(await catRows(a.id)).toHaveLength(1);
  });

  it('V 배열 본문 → 400 VALIDATION_ERROR', async () => {
    const res = await agentFor((await createUser()).id)
      .post(URL)
      .send([]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('변경 성공: 이름 trim 저장, 자기 이름 대소문자만 바꿔도 200', async () => {
    const a = await createUser();
    const work = await createCategory({ ownerId: a.id, name: 'Work' });
    const agent = agentFor(a.id);

    const r1 = await agent.patch(`${URL}/${work.id}`).send({ name: ' Study ' });
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ id: work.id, name: 'Study', isDefault: false });

    const other = await createCategory({ ownerId: a.id, name: 'Work' });
    const r2 = await agent.patch(`${URL}/${other.id}`).send({ name: 'WORK' });
    expect(r2.status).toBe(200);
    expect(r2.body.name).toBe('WORK');
  });

  it('EX-18 기본 카테고리는 변경·삭제 403 DEFAULT_CATEGORY_PROTECTED, DB 변화 없음', async () => {
    const a = await createUser();
    await createTodo({ ownerId: a.id, categoryId: a.defaultCategoryId });
    const agent = agentFor(a.id);
    const results = [
      await agent.patch(`${URL}/${a.defaultCategoryId}`).send({ name: '바꿈' }),
      await agent.delete(`${URL}/${a.defaultCategoryId}`),
    ];
    for (const res of results) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DEFAULT_CATEGORY_PROTECTED');
    }
    expect(await catRows(a.id)).toEqual([{ id: a.defaultCategoryId, name: '기본' }]);
    expect((await todoCats(a.id))[0].category_id).toBe(a.defaultCategoryId);
  });

  it('EX-19 남의 카테고리·없는 uuid는 변경·삭제 404 NOT_FOUND, 남의 것은 그대로', async () => {
    const a = await createUser();
    const b = await createUser();
    const bWork = await createCategory({ ownerId: b.id, name: 'Work' });
    const agent = agentFor(a.id);
    for (const id of [bWork.id, randomUUID()]) {
      const results = [await agent.patch(`${URL}/${id}`).send({ name: '탈취' }), await agent.delete(`${URL}/${id}`)];
      for (const res of results) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
    }
    expect((await catRows(b.id)).map((c) => c.name)).toEqual(['Work', '기본']);
  });

  it('uuid 형식이 아닌 id는 변경·삭제 400 VALIDATION_ERROR', async () => {
    const agent = agentFor((await createUser()).id);
    const results = [await agent.patch(`${URL}/abc`).send({ name: 'X' }), await agent.delete(`${URL}/abc`)];
    for (const res of results) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty('categoryId');
    }
  });

  it('R9 삭제 시 소속 할일은 기본 카테고리로 이동, 개수 유지, 남의 할일 불변', async () => {
    const { a, b, work } = await seedDeleteCase();
    const beforeA = await todoCats(a.id);
    const beforeB = await todoCats(b.id);

    const res = await agentFor(a.id).delete(`${URL}/${work.id}`);
    expect(res.status).toBe(204);

    const afterA = await todoCats(a.id);
    expect(afterA).toHaveLength(4);
    expect(afterA.every((t) => t.category_id === a.defaultCategoryId)).toBe(true);
    for (const t of afterA) {
      const old = beforeA.find((o) => o.id === t.id);
      if (old.category_id === work.id) expect(t.updated_at.getTime()).toBeGreaterThan(old.updated_at.getTime());
    }
    expect((await catRows(a.id)).map((c) => c.id)).toEqual([a.defaultCategoryId]);
    expect(await todoCats(b.id)).toEqual(beforeB);
    expect(Number((await pool.query('SELECT count(*) FROM todos')).rows[0].count)).toBe(5);
  });

  it('롤백: 삭제 중간 실패 시 500 INTERNAL_ERROR, 할일 이동도 되돌려진다', async () => {
    const { a, work } = await seedDeleteCase();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(categoriesRepo, 'deleteCategory').mockRejectedValueOnce(new Error('boom'));

    const res = await agentFor(a.id).delete(`${URL}/${work.id}`);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(errSpy).toHaveBeenCalled();

    const { rows } = await pool.query('SELECT count(*) FROM todos WHERE category_id = $1', [work.id]);
    expect(Number(rows[0].count)).toBe(3);
    expect((await catRows(a.id)).map((c) => c.id)).toContain(work.id);
  });

  it('인증 없이 GET은 401', async () => {
    const res = await request(app).get(URL);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
