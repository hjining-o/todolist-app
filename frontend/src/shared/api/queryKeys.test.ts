import { queryKeys } from './queryKeys'

it('키 팩토리는 앞부분 키로 무효화할 수 있는 배열을 만든다', () => {
  expect(queryKeys.todos({ page: 1 })).toEqual(['todos', { page: 1 }])
  expect(queryKeys.todos()).toEqual(['todos', {}])
  expect(queryKeys.todo('1')).toEqual(['todo', '1'])
  expect(queryKeys.categories()).toEqual(['categories'])
  expect(queryKeys.teams()).toEqual(['teams'])
  expect(queryKeys.members('t')).toEqual(['members', 't'])
  expect(queryKeys.me()).toEqual(['me'])
  expect(queryKeys.histories('1')).toEqual(['histories', '1'])
})
