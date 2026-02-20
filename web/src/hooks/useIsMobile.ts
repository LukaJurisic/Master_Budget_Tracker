import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

function detectMobileViewport() {
  if (typeof window === 'undefined') return false

  const capacitor = (window as typeof window & { Capacitor?: { getPlatform?: () => string } }).Capacitor
  const nativePlatform = capacitor?.getPlatform?.()
  if (nativePlatform && nativePlatform !== 'web') {
    return true
  }

  const byWidth = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
  if (byWidth) return true

  const ua = (navigator.userAgent || '').toLowerCase()
  const mobileUA = /android|iphone|ipad|ipod|mobile/.test(ua)
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const touchCapable = navigator.maxTouchPoints > 1

  // WebView sometimes reports larger CSS widths than expected; trust mobile UA/touch signals.
  return mobileUA || coarsePointer || touchCapable
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => detectMobileViewport())

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const pointerQuery = window.matchMedia('(pointer: coarse)')
    const onChange = (event: MediaQueryListEvent) => {
      if (event) {
        setIsMobile(detectMobileViewport())
      }
    }

    setIsMobile(detectMobileViewport())
    mediaQuery.addEventListener('change', onChange)
    pointerQuery.addEventListener('change', onChange)

    return () => {
      mediaQuery.removeEventListener('change', onChange)
      pointerQuery.removeEventListener('change', onChange)
    }
  }, [])

  return isMobile
}
