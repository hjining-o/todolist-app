import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'

const flat = (o: object, p = ''): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)))
// en의 복수형 접미사(_one/_other)를 기본 키로 정규화한다
const norm = (k: string) => k.replace(/_(one|other)$/, '')
const keys = (o: object) => new Set(flat(o).map(([k]) => norm(k)))
const vars = (o: object) =>
  Object.fromEntries(flat(o).map(([k, v]) => [norm(k), [...new Set(v.match(/\{\{\w+\}\}/g) ?? [])].sort().join()]))

describe('locales', () => {
  it.each([
    ['en', en],
    ['zh', zh],
    ['ja', ja],
  ])('%s는 ko와 키·보간 변수가 같다', (_, lang) => {
    expect(keys(lang)).toEqual(keys(ko))
    expect(vars(lang)).toEqual(vars(ko))
  })

  it('en의 _one 키는 _other와 쌍이다', () => {
    const k = flat(en).map(([key]) => key)
    for (const key of k.filter((x) => x.endsWith('_one'))) expect(k).toContain(key.replace(/_one$/, '_other'))
  })
})
