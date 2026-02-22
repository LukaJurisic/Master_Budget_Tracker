import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { rewriteApiUrlForNative, resolveAppKey } from './lib/runtime'
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
const appKey = resolveAppKey()

function isApiRequestUrl(inputUrl: string): boolean {
  try {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    const parsed = new URL(inputUrl, currentOrigin)
    return parsed.pathname === '/api' || parsed.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function mergeHeaders(baseHeaders?: HeadersInit, initHeaders?: HeadersInit): Headers {
  const merged = new Headers(baseHeaders ?? {})
  const extra = new Headers(initHeaders ?? {})
  extra.forEach((value, key) => {
    merged.set(key, value)
  })
  return merged
}

function withAppKeyHeaders(targetUrl: string, init?: RequestInit, baseHeaders?: HeadersInit): RequestInit | undefined {
  if (!appKey || !isApiRequestUrl(targetUrl)) {
    return init
  }
  const headers = mergeHeaders(baseHeaders, init?.headers)
  headers.set('x-app-key', appKey)
  return { ...(init ?? {}), headers }
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string') {
    const rewritten = rewriteApiUrlForNative(input)
    const nextInit = withAppKeyHeaders(rewritten, init)
    return originalFetch(rewritten, nextInit)
  }

  if (input instanceof Request) {
    const rewritten = rewriteApiUrlForNative(input.url)
    const nextInit = withAppKeyHeaders(rewritten, init, input.headers)
    if (rewritten !== input.url) {
      return originalFetch(new Request(rewritten, input), nextInit)
    }
    return originalFetch(input, nextInit)
  }

  if (input instanceof URL) {
    const rewritten = rewriteApiUrlForNative(input.toString())
    const nextInit = withAppKeyHeaders(rewritten, init)
    return originalFetch(rewritten, nextInit)
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





















