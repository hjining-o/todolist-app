import { describe, expect, it } from 'vitest';
import { diffTodo, filterChanges } from '../../src/domain/history-diff.js';

const FIELDS = ['title', 'description', 'startAt', 'endAt', 'completed', 'category', 'sharedTeamIds'];
const CAT = { id: 'c1', name: '기본' };
const snap = (o = {}) => ({
  title: 'a',
  description: null,
  startAt: new Date('2099-01-10T00:00:00Z'),
  endAt: new Date('2099-01-12T00:00:00Z'),
  completed: false,
  category: CAT,
  sharedTeamIds: [],
  ...o,
});
const keys = (d) => Object.keys(d.changes).sort();

describe('diffTodo', () => {
  it('U1 등록(before null)은 CREATED, 7개 필드 전부 old null', () => {
    const d = diffTodo(null, snap());
    expect(d.action).toBe('CREATED');
    expect(keys(d)).toEqual([...FIELDS].sort());
    for (const f of FIELDS) expect(d.changes[f].old).toBeNull();
    expect(d.changes.startAt.new).toBe('2099-01-10T00:00:00.000Z');
    expect(d.changes.endAt.new).toBe('2099-01-12T00:00:00.000Z');
    expect(d.changes.description.new).toBeNull();
    expect(d.changes.sharedTeamIds.new).toEqual([]);
    expect(d.changes.category.new).toEqual(CAT);
  });

  it('U2 같은 스냅숏은 null(이력 미기록)', () => {
    expect(diffTodo(snap(), snap())).toBeNull();
  });

  it('U3 title만 바뀌면 UPDATED, 키는 title만', () => {
    const d = diffTodo(snap(), snap({ title: 'b' }));
    expect(d.action).toBe('UPDATED');
    expect(d.changes).toEqual({ title: { old: 'a', new: 'b' } });
  });

  it('U4·T-04 완료와 title이 함께 바뀌면 COMPLETED 1건, 두 키 모두 포함', () => {
    const d = diffTodo(snap(), snap({ title: 'b', completed: true }));
    expect(d.action).toBe('COMPLETED');
    expect(keys(d)).toEqual(['completed', 'title']);
    expect(d.changes.completed).toEqual({ old: false, new: true });
  });

  it('U5 완료 해제는 UNCOMPLETED', () => {
    const d = diffTodo(snap({ completed: true }), snap());
    expect(d.action).toBe('UNCOMPLETED');
    expect(d.changes).toEqual({ completed: { old: true, new: false } });
  });

  it('U6 같은 시각의 다른 Date 인스턴스는 변경 아님', () => {
    expect(diffTodo(snap(), snap({ startAt: new Date('2099-01-10T00:00:00Z') }))).toBeNull();
  });

  it('U7 sharedTeamIds 순서만 다르면 변경 아님', () => {
    expect(diffTodo(snap({ sharedTeamIds: ['b', 'a'] }), snap({ sharedTeamIds: ['a', 'b'] }))).toBeNull();
  });

  it('U8 category는 id가 다르면 {id,name} 객체로 old/new', () => {
    const d = diffTodo(snap(), snap({ category: { id: 'c2', name: 'Work' } }));
    expect(d.action).toBe('UPDATED');
    expect(d.changes).toEqual({ category: { old: CAT, new: { id: 'c2', name: 'Work' } } });
  });

  it('U9 description null에서 문자열로 바뀌면 description 키', () => {
    const d = diffTodo(snap(), snap({ description: 'x' }));
    expect(d.changes).toEqual({ description: { old: null, new: 'x' } });
  });
});

describe('filterChanges', () => {
  const viewer = (o) => ({ isOwner: false, teamIds: [], ...o });

  it('F1 비소유자는 category만 있으면 null(숨김)', () => {
    const changes = { category: { old: CAT, new: { id: 'c2', name: 'W' } } };
    expect(filterChanges(changes, viewer())).toBeNull();
  });

  it('F2 비소유자는 category만 빠지고 입력 객체는 불변', () => {
    const changes = { category: { old: CAT, new: CAT }, title: { old: 'a', new: 'b' } };
    const copy = structuredClone(changes);
    expect(filterChanges(changes, viewer())).toEqual({ title: { old: 'a', new: 'b' } });
    expect(changes).toEqual(copy);
  });

  it('F3 소유자는 category 유지', () => {
    const changes = { category: { old: CAT, new: CAT } };
    expect(filterChanges(changes, viewer({ isOwner: true }))).toEqual(changes);
  });

  it('F4 보는 팀 밖 팀만 바뀐 sharedTeamIds는 필드 삭제, 그것뿐이면 null', () => {
    const changes = { sharedTeamIds: { old: ['m'], new: ['m', 's'] } };
    expect(filterChanges(changes, viewer({ teamIds: ['m'] }))).toBeNull();
  });

  it('F5 sharedTeamIds는 old·new를 보는 팀으로 거름 ([]→[m,s] 는 []→[m])', () => {
    const changes = { sharedTeamIds: { old: [], new: ['m', 's'] } };
    expect(filterChanges(changes, viewer({ teamIds: ['m'] }))).toEqual({ sharedTeamIds: { old: [], new: ['m'] } });
  });

  it('F6 CREATED의 old null은 유지, new는 거른 뒤 []로 남는다', () => {
    const changes = { sharedTeamIds: { old: null, new: ['s'] } };
    expect(filterChanges(changes, viewer({ teamIds: ['m'] }))).toEqual({ sharedTeamIds: { old: null, new: [] } });
  });

  it('F7 비소유자의 CREATED는 category만 빠지고 나머지 6개 유지', () => {
    const { changes } = diffTodo(null, snap());
    const out = filterChanges(changes, viewer());
    expect(Object.keys(out).sort()).toEqual(FIELDS.filter((f) => f !== 'category').sort());
  });
});
