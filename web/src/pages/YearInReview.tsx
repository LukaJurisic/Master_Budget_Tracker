import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { ChevronLeft, ChevronRight, Expand, Landmark, Music2, Pause, Play, Sparkles, Trophy, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const MIN_YEAR = 2022
const STORY_INTERVAL_MS = 5000

type WrappedSlide = {
  id: string
  title: string
  subtitle: string
  accent: string
  body: ReactNode
}

function useWrappedSoundtrack() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const intervalRef = useRef<number | null>(null)
  const stepRef = useRef(0)

  const clearAll = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
    gainRef.current = null
  }

  const playTone = (ctx: AudioContext, gainNode: GainNode, frequency: number, offset: number, duration = 0.24) => {
    const now = ctx.currentTime + offset
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(gainNode)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }

  const tick = () => {
    const ctx = audioContextRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return

    const progressions = [
      [261.63, 329.63, 392.0],
      [293.66, 369.99, 440.0],
      [329.63, 415.3, 493.88],
      [349.23, 440.0, 523.25],
    ]
    const chord = progressions[stepRef.current % progressions.length]
    playTone(ctx, gain, chord[0], 0.0)
    playTone(ctx, gain, chord[1], 0.1)
    playTone(ctx, gain, chord[2], 0.2)
    stepRef.current += 1
  }

  const start = async () => {
    if (audioContextRef.current) return
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtor) return

    const ctx = new AudioCtor()
    const gain = ctx.createGain()
    gain.gain.value = 0.18
    gain.connect(ctx.destination)

    audioContextRef.current = ctx
    gainRef.current = gain
    stepRef.current = 0
    tick()
    intervalRef.current = window.setInterval(() => {
      tick()
    }, 600)
  }

  const stop = () => {
    clearAll()
  }

  useEffect(() => {
    return () => {
      clearAll()
    }
  }, [])

  return { start, stop }
}

function toYear(month: string | null | undefined): number | null {
  if (!month) return null
  const parsed = Number.parseInt(month.slice(0, 4), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function shortMonth(month: string) {
  const year = Number.parseInt(month.slice(0, 4), 10)
  const monthIndex = Number.parseInt(month.slice(5, 7), 10) - 1
  const date = new Date(year, monthIndex, 1)
  return date.toLocaleString('en-CA', { month: 'short' })
}

function monthLabel(month: string) {
  const year = Number.parseInt(month.slice(0, 4), 10)
  const monthIndex = Number.parseInt(month.slice(5, 7), 10) - 1
  const date = new Date(year, monthIndex, 1)
  return date.toLocaleString('en-CA', { month: 'short', year: 'numeric' })
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  words.forEach((word) => {
    const candidate = `${line}${word} `
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, currentY)
      line = `${word} `
      currentY += lineHeight
    } else {
      line = candidate
    }
  })

  if (line) {
    ctx.fillText(line.trim(), x, currentY)
  }
}

async function createWrappedCardBlob(year: number, income: number, savings: number, category: string, merchant: string) {
  const width = 1080
  const height = 1920
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#c026d3')
  gradient.addColorStop(0.5, '#4f46e5')
  gradient.addColorStop(1, '#06b6d4')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 44px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText('SignalLedger Wrapped', 80, 120)
  ctx.font = '700 92px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText(`${year}`, 80, 250)
  ctx.font = '600 54px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText('Year in Review', 80, 330)

  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillRect(80, 420, width - 160, 330)
  ctx.fillRect(80, 790, width - 160, 250)
  ctx.fillRect(80, 1080, width - 160, 520)

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '500 30px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText('Income', 120, 490)
  ctx.font = '700 62px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText(formatCurrency(income), 120, 570)

  ctx.font = '500 30px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText('Net Savings', 120, 660)
  ctx.font = '700 62px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText(formatCurrency(savings), 120, 740)

  ctx.font = '700 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText('Top Category', 120, 860)
  ctx.font = '600 44px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  drawWrappedText(ctx, category || 'No category data', 120, 920, width - 240, 56)

  ctx.font = '700 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillText('Top Merchant', 120, 1150)
  ctx.font = '600 44px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  drawWrappedText(ctx, merchant || 'No merchant data', 120, 1210, width - 240, 56)

  ctx.font = '500 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('Generated with SignalLedger', 80, height - 90)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function WrappedStoryCard({
  slide,
  slideIndex,
  slideCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onJump,
  onTapAdvance,
  touchStartX,
  fullScreen = false,
}: {
  slide: WrappedSlide
  slideIndex: number
  slideCount: number
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  onJump: (index: number) => void
  onTapAdvance: () => void
  touchStartX: React.MutableRefObject<number | null>
  fullScreen?: boolean
}) {
  const progress = ((slideIndex + 1) / Math.max(1, slideCount)) * 100

  return (
    <Card
      className={`relative overflow-hidden rounded-3xl border-0 bg-gradient-to-br ${slide.accent} ${fullScreen ? 'h-full' : ''}`}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current
        const endX = event.changedTouches[0].clientX
        if (startX === null) return
        const delta = endX - startX
        if (delta > 45 && canGoPrev) onPrev()
        if (delta < -45 && canGoNext) onNext()
        touchStartX.current = null
      }}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button')) return
        onTapAdvance()
      }}
    >
      <CardContent className={`relative p-5 ${fullScreen ? 'h-full flex flex-col justify-between' : ''}`}>
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mb-3 flex items-center justify-between text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">SignalLedger Wrapped</p>
            <h2 className={`${fullScreen ? 'text-3xl' : 'text-2xl'} font-bold`}>{slide.title}</h2>
            <p className={`${fullScreen ? 'text-base' : 'text-sm'} text-white/85`}>{slide.subtitle}</p>
          </div>
          <Sparkles className="h-6 w-6 animate-pulse" />
        </div>

        {slide.body}

        <div className="mt-5 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={onPrev} disabled={!canGoPrev}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: slideCount }, (_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => onJump(index)}
                className={`h-2.5 w-2.5 rounded-full ${index === slideIndex ? 'bg-white' : 'bg-white/40'}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={onNext} disabled={!canGoNext}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function YearInReview() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [musicOn, setMusicOn] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const [storyModeOpen, setStoryModeOpen] = useState(false)
  const [isSharingCard, setIsSharingCard] = useState(false)
  const { start, stop } = useWrappedSoundtrack()
  const touchStartX = useRef<number | null>(null)
  const shouldAutoOpenStory = searchParams.get('story') === '1'

  const { data: availableMonths } = useQuery({
    queryKey: ['wrapped-available-months'],
    queryFn: () => apiClient.getAnalyticsAvailableMonths(),
  })

  const availableYears = useMemo(() => {
    const minY = toYear(availableMonths?.min_month)
    const maxY = toYear(availableMonths?.max_month)
    if (!minY || !maxY) return []

    const currentYear = new Date().getFullYear()
    const highestCompletedYear = currentYear - 1
    const boundedMax = Math.min(maxY, highestCompletedYear)
    const boundedMin = Math.max(minY, MIN_YEAR)
    if (boundedMax < boundedMin) return []

    const years: number[] = []
    for (let year = boundedMax; year >= boundedMin; year -= 1) {
      years.push(year)
    }
    return years
  }, [availableMonths?.max_month, availableMonths?.min_month])

  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) {
      setSelectedYear(availableYears[0])
      return
    }
    if (selectedYear && !availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  useEffect(() => {
    if (musicOn) {
      start().catch(() => undefined)
    } else {
      stop()
    }
  }, [musicOn, start, stop])

  useEffect(() => {
    setSlideIndex(0)
  }, [selectedYear])

  useEffect(() => {
    if (!selectedYear || !shouldAutoOpenStory) return
    setStoryModeOpen(true)
  }, [selectedYear, shouldAutoOpenStory])

  const dateFrom = selectedYear ? `${selectedYear}-01-01` : ''
  const dateTo = selectedYear ? `${selectedYear}-12-31` : ''
  const enabled = !!selectedYear

  const { data: summaryRange, isLoading: summaryLoading } = useQuery({
    queryKey: ['wrapped-summary-range', selectedYear],
    queryFn: () => apiClient.getAnalyticsSummaryRange(dateFrom, dateTo),
    enabled,
  })

  const { data: topCategories } = useQuery({
    queryKey: ['wrapped-top-categories', selectedYear],
    queryFn: () => apiClient.getSpendingAmountByCategory(dateFrom, dateTo, 5),
    enabled,
  })

  const { data: topMerchants } = useQuery({
    queryKey: ['wrapped-top-merchants', selectedYear],
    queryFn: () => apiClient.getSpendingAmountByMerchant(dateFrom, dateTo, 5),
    enabled,
  })

  const chartData = useMemo(() => {
    const flows = summaryRange?.income_vs_expenses ?? []
    const savings = new Map((summaryRange?.savings_by_month ?? []).map((row) => [row.month, row.net_savings]))
    return flows.map((row) => ({
      month: shortMonth(row.month),
      income: row.income ?? 0,
      expenses: row.expenses ?? 0,
      savings: savings.get(row.month) ?? 0,
    }))
  }, [summaryRange?.income_vs_expenses, summaryRange?.savings_by_month])

  const topCategory = topCategories?.data?.[0]
  const topMerchant = topMerchants?.data?.[0]
  const peakSavings = useMemo(() => {
    const values = (summaryRange?.savings_by_month ?? []).map((row) => row.net_savings)
    return values.reduce((max, value) => Math.max(max, value), 0)
  }, [summaryRange?.savings_by_month])
  const peakIncomeMonth = useMemo(() => {
    const flows = summaryRange?.income_vs_expenses ?? []
    if (flows.length === 0) return null
    return flows.reduce((best, row) => (row.income > best.income ? row : best), flows[0])
  }, [summaryRange?.income_vs_expenses])
  const strongestSavingsMonth = useMemo(() => {
    const savings = summaryRange?.savings_by_month ?? []
    if (savings.length === 0) return null
    return savings.reduce((best, row) => (row.net_savings > best.net_savings ? row : best), savings[0])
  }, [summaryRange?.savings_by_month])

  const handleShareCard = async () => {
    if (!selectedYear || isSharingCard) return
    setIsSharingCard(true)
    try {
      const blob = await createWrappedCardBlob(
        selectedYear,
        summaryRange?.income_total ?? 0,
        summaryRange?.savings_total ?? 0,
        topCategory?.category ?? '',
        topMerchant?.merchant ?? ''
      )
      if (!blob) return

      const text = `My ${selectedYear} Wrapped: saved ${formatCurrency(summaryRange?.savings_total ?? 0)} on income ${formatCurrency(summaryRange?.income_total ?? 0)} in SignalLedger.`
      const file = new File([blob], `signalledger-wrapped-${selectedYear}.png`, { type: 'image/png' })
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
      }

      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          title: `${selectedYear} Wrapped`,
          text,
          files: [file],
        })
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `signalledger-wrapped-${selectedYear}.png`
      link.click()
      URL.revokeObjectURL(url)
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // noop
    } finally {
      setIsSharingCard(false)
    }
  }

  const slides: WrappedSlide[] = useMemo(() => [
    {
      id: 'intro',
      title: `${selectedYear ?? 'Year'} Wrapped`,
      subtitle: 'A quick rewind of your money story',
      accent: 'from-fuchsia-600 via-indigo-500 to-cyan-400',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-white/85">
            Your financial highlights are ready. Tap through and relive the year in a Spotify-inspired flow.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-white/75">Income</p>
              <p className="text-xl font-bold text-white">{formatCurrency(summaryRange?.income_total ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-white/75">Saved</p>
              <p className="text-xl font-bold text-white">{formatCurrency(summaryRange?.savings_total ?? 0)}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'flow',
      title: 'Cashflow Pulse',
      subtitle: 'Your month-by-month rhythm',
      accent: 'from-sky-500 via-blue-500 to-indigo-600',
      body: (
        <div className="space-y-3">
          <div className="h-48 rounded-xl bg-white/10 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="month" tick={{ fill: 'white', fontSize: 10 }} />
                <YAxis tick={{ fill: 'white', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="income" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chartData.length === 0 && (
            <p className="text-xs text-white/80">No monthly chart data for this year yet.</p>
          )}
          <p className="text-xs text-white/80">
            Avg monthly income {formatCurrency(summaryRange?.income_avg ?? 0)} and spending {formatCurrency(summaryRange?.expense_avg ?? 0)}.
          </p>
        </div>
      ),
    },
    {
      id: 'category',
      title: 'Category Champion',
      subtitle: 'Where most of your spending went',
      accent: 'from-orange-500 via-rose-500 to-fuchsia-600',
      body: (
        <div className="space-y-4">
          <div className="rounded-xl bg-white/15 p-4 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/75">Top category</p>
            <p className="mt-1 text-2xl font-bold text-white">{topCategory?.category ?? 'No category data'}</p>
            <p className="text-white/90">{formatCurrency(topCategory?.total_amount ?? 0)}</p>
          </div>
          <div className="space-y-2">
            {topCategories?.data?.slice(0, 3).map((item, index) => (
              <div key={item.category} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm text-white">
                <span>{index + 1}. {item.category}</span>
                <span>{formatCurrency(item.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'merchant',
      title: 'Merchant MVP',
      subtitle: 'Your most frequent spending destination',
      accent: 'from-emerald-500 via-teal-500 to-cyan-500',
      body: (
        <div className="space-y-4">
          <div className="rounded-xl bg-white/15 p-4 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/75">Top merchant</p>
            <p className="mt-1 text-2xl font-bold text-white">{topMerchant?.merchant ?? 'No merchant data'}</p>
            <p className="text-white/90">{formatCurrency(topMerchant?.total_amount ?? 0)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/10 p-3 text-white">
              <p className="text-[11px] uppercase text-white/70">Months Tracked</p>
              <p className="text-xl font-bold">{chartData.length}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 text-white">
              <p className="text-[11px] uppercase text-white/70">Best Savings Month</p>
              <p className="text-xl font-bold">{formatCurrency(peakSavings)}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'insights',
      title: 'Headline Insights',
      subtitle: 'Your standout moments this year',
      accent: 'from-teal-500 via-blue-500 to-indigo-600',
      body: (
        <div className="space-y-3">
          <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/75">Peak income month</p>
            <p className="mt-1 text-xl font-bold text-white">
              {peakIncomeMonth ? `${monthLabel(peakIncomeMonth.month)} - ${formatCurrency(peakIncomeMonth.income)}` : 'No data'}
            </p>
          </div>
          <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/75">Strongest savings month</p>
            <p className="mt-1 text-xl font-bold text-white">
              {strongestSavingsMonth ? `${monthLabel(strongestSavingsMonth.month)} - ${formatCurrency(strongestSavingsMonth.net_savings)}` : 'No data'}
            </p>
          </div>
          <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/75">Savings rate</p>
            <p className="mt-1 text-xl font-bold text-white">{(summaryRange?.pct_saved ?? 0).toFixed(1)}%</p>
          </div>
        </div>
      ),
    },
    {
      id: 'finale',
      title: 'You Finished The Year',
      subtitle: 'Same data, new energy for next year',
      accent: 'from-violet-600 via-purple-500 to-blue-500',
      body: (
        <div className="space-y-4">
          <div className="rounded-xl bg-white/15 p-4 backdrop-blur">
            <p className="text-white/85">
              Net savings for {selectedYear}: <span className="font-bold text-white">{formatCurrency(summaryRange?.savings_total ?? 0)}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-white/90">
            <div className="rounded-lg bg-white/10 p-2">
              <Sparkles className="mx-auto mb-1 h-4 w-4" />
              <p className="text-[11px]">Momentum</p>
            </div>
            <div className="rounded-lg bg-white/10 p-2">
              <Wallet className="mx-auto mb-1 h-4 w-4" />
              <p className="text-[11px]">Discipline</p>
            </div>
            <div className="rounded-lg bg-white/10 p-2">
              <Landmark className="mx-auto mb-1 h-4 w-4" />
              <p className="text-[11px]">Growth</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={handleShareCard} disabled={isSharingCard}>
            {isSharingCard ? 'Preparing Card...' : 'Share Highlights'}
          </Button>
        </div>
      ),
    },
  ], [
    chartData,
    handleShareCard,
    isSharingCard,
    peakIncomeMonth,
    peakSavings,
    selectedYear,
    strongestSavingsMonth,
    summaryRange?.expense_avg,
    summaryRange?.income_avg,
    summaryRange?.income_total,
    summaryRange?.pct_saved,
    summaryRange?.savings_total,
    topCategory?.category,
    topCategory?.total_amount,
    topCategories?.data,
    topMerchant?.merchant,
    topMerchant?.total_amount,
  ])

  useEffect(() => {
    if (!autoPlay || slides.length === 0) return
    const id = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length)
    }, STORY_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [autoPlay, slides.length])

  useEffect(() => {
    if (!storyModeOpen) return
    if (!navigator.vibrate) return
    navigator.vibrate(8)
  }, [slideIndex, storyModeOpen])

  const boundedSlideIndex = Math.min(slideIndex, Math.max(0, slides.length - 1))
  const activeSlide = slides[boundedSlideIndex] ?? slides[0]
  const canGoPrev = boundedSlideIndex > 0
  const canGoNext = boundedSlideIndex < slides.length - 1

  const goPrev = () => {
    if (!canGoPrev) return
    setSlideIndex((prev) => prev - 1)
  }

  const goNext = () => {
    if (!canGoNext) return
    setSlideIndex((prev) => prev + 1)
  }

  const tapAdvance = () => {
    if (canGoNext) {
      goNext()
      return
    }
    setSlideIndex(0)
  }

  const closeStoryMode = () => {
    setStoryModeOpen(false)
    if (!shouldAutoOpenStory) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('story')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Year in Review
            </h1>
            <p className="text-sm text-muted-foreground">Spotify-style finance recap by year cohort</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant={musicOn ? 'default' : 'outline'} size="sm" onClick={() => setMusicOn((prev) => !prev)}>
              <Music2 className="mr-2 h-4 w-4" />
              {musicOn ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStoryModeOpen(true)} disabled={!selectedYear}>
              <Expand className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableYears.map((year) => (
            <Button
              key={year}
              size="sm"
              variant={year === selectedYear ? 'default' : 'outline'}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Auto-play story mode</p>
          <Button size="sm" variant={autoPlay ? 'default' : 'outline'} onClick={() => setAutoPlay((prev) => !prev)}>
            {autoPlay ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      {summaryLoading && (
        <Card className="rounded-3xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Loading your wrapped story...</p>
          </CardContent>
        </Card>
      )}

      {!summaryLoading && !selectedYear && (
        <Card className="rounded-3xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">No completed years available yet. Wrapped unlocks after year-end.</p>
          </CardContent>
        </Card>
      )}

      {!summaryLoading && selectedYear && activeSlide && (
        <WrappedStoryCard
          slide={activeSlide}
          slideIndex={boundedSlideIndex}
          slideCount={slides.length}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrev}
          onNext={goNext}
          onJump={(index) => setSlideIndex(index)}
          onTapAdvance={tapAdvance}
          touchStartX={touchStartX}
        />
      )}

      {storyModeOpen && selectedYear && activeSlide && (
        <div className="fixed inset-0 z-50 bg-black/85 p-3">
          <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-white">
              <p className="text-sm font-semibold">{selectedYear} Wrapped Story Mode</p>
              <Button variant="secondary" size="sm" onClick={closeStoryMode}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <WrappedStoryCard
                slide={activeSlide}
                slideIndex={boundedSlideIndex}
                slideCount={slides.length}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goPrev}
                onNext={goNext}
                onJump={(index) => setSlideIndex(index)}
                onTapAdvance={tapAdvance}
                touchStartX={touchStartX}
                fullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
