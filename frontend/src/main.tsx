import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from '@/app/App'
import { GlobalErrorBanner } from '@/app/GlobalErrorBanner'
import { createQueryClient } from '@/app/queryClient'
import '@/shared/i18n'
import { Toaster } from '@/shared/components/ui/sonner'
import './index.css'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GlobalErrorBanner />
          <App />
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
