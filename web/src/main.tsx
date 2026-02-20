import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { rewriteApiUrlForNative } from './lib/runtime'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

const originalFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string') {
    return originalFetch(rewriteApiUrlForNative(input), init)
  }

  if (input instanceof Request) {
    const rewritten = rewriteApiUrlForNative(input.url)
    if (rewritten !== input.url) {
      return originalFetch(new Request(rewritten, input), init)
    }
    return originalFetch(input, init)
  }

  if (input instanceof URL) {
    return originalFetch(rewriteApiUrlForNative(input.toString()), init)
  }

  return originalFetch(input as any, init)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)





















