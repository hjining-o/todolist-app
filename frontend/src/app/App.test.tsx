import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from './App'

it('빈 라우트로 렌더링된다', () => {
  const { container } = render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  expect(container).toBeEmptyDOMElement()
})
