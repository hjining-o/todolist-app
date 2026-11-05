// 무효화는 앞부분 키(['todos'] 등)로 한다
export const queryKeys = {
  todos: (params?: object) => ['todos', params ?? {}] as const,
  todo: (id: string) => ['todo', id] as const,
  categories: () => ['categories'] as const,
  teams: () => ['teams'] as const,
  members: (teamId: string) => ['members', teamId] as const,
  me: () => ['me'] as const,
  histories: (todoId: string) => ['histories', todoId] as const,
}
