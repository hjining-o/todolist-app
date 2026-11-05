import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from '@/app/App'
import { GlobalErrorBanner } from '@/app/GlobalErrorBanner'
import { createQueryClient } from '@/app/queryClient'
import './index.css'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GlobalErrorBanner />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
