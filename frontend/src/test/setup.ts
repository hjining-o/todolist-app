import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import i18n from '@/shared/i18n'

// 기존 한국어 단언이 통과하도록 언어를 ko 로 고정한다
await i18n.changeLanguage('ko')
afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('ko')
})

// 개발용 debug/info 로그가 테스트 출력을 어지럽히지 않게 한다(warn/error는 그대로)
console.debug = () => {}
console.info = () => {}

// Radix가 jsdom에 없는 API를 부른다(Q-04)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
window.matchMedia ??= (query: string) =>
  ({
    matches: query.includes('min-width'), // 기본은 데스크톱. 모바일은 테스트에서 matchMedia 를 바꿔 쓴다
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList
