import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { RefreshCw, AlertCircle, Play, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiClient, DashboardCards, DashboardLines, DashboardCategories, DashboardTopMerchant } from '@/lib/api'
import { formatMonthLong, getCurrentMonth } from '@/lib/formatters'

// Dashboard components
import { CardsRow } from '@/components/dashboard/CardsRow'
import { NetWorthArea } from '@/components/dashboard/NetWorthArea'
import { IncomeVsExpensesLines } from '@/components/dashboard/IncomeVsExpensesLines'
import { CategoryDoughnut } from '@/components/dashboard/CategoryDoughnut'
import { TopCategoriesBar } from '@/components/dashboard/TopCategoriesBar'
import { CategoryDetailsList } from '@/components/dashboard/CategoryDetailsList'
import { TopMerchants } from '@/components/dashboard/TopMerchants'

function isDashboardCards(value: unknown): value is DashboardCards {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.income === 'number' &&
    typeof v.expenses === 'number' &&
    typeof v.net_savings === 'number' &&
    typeof v.total_txns === 'number' &&
    typeof v.unmapped === 'number' &&
    typeof v.active_categories === 'number'
  )
}

function isDashboardLines(value: unknown): value is DashboardLines {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.income_by_month) &&
    Array.isArray(v.expenses_by_month) &&
    Array.isArray(v.networth_cumulative)
  )
}

function isDashboardCategories(value: unknown): value is DashboardCategories {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.breakdown) &&
    Array.isArray(v.top_categories) &&
    Array.isArray(v.category_details)
  )
}

function isDashboardTopMerchants(value: unknown): value is DashboardTopMerchant[] {
  return Array.isArray(value)
}

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get metadata for effective month logic
  const { data: meta } = useQuery({
    queryKey: ['dashboard-meta'],
    queryFn: () => apiClient.getDashboardMeta(),
  })

  // Calculate effective month (min of selected and latest available)
  const effectiveMonth = meta?.latest_data_month && selectedMonth > meta.latest_data_month 
    ? meta.latest_data_month 
    : selectedMonth

  const showFallbackBanner = meta?.latest_data_month && selectedMonth > meta.latest_data_month

  // Dashboard queries
  const { data: cards, isLoading: cardsLoading, refetch: refetchCards } = useQuery({
    queryKey: ['dashboard-cards', effectiveMonth],
    queryFn: () => apiClient.getDashboardCards(effectiveMonth),
    enabled: !!effectiveMonth,
  })

  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['dashboard-lines'],
    queryFn: () => apiClient.getDashboardLines(),
  })

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['dashboard-categories', effectiveMonth],
    queryFn: () => apiClient.getDashboardCategories(effectiveMonth),
    enabled: !!effectiveMonth,
  })

  const { data: topMerchants, isLoading: merchantsLoading } = useQuery({
    queryKey: ['dashboard-merchants', effectiveMonth],
    queryFn: () => apiClient.getDashboardTopMerchants(effectiveMonth),
    enabled: !!effectiveMonth,
  })


  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await apiClient.refreshData()
      await refetchCards()
    } finally {
      setIsRefreshing(false)
    }
  }

  const isLoading = cardsLoading || linesLoading || categoriesLoading || merchantsLoading
  const safeCards = isDashboardCards(cards) ? cards : null
  const safeLines = isDashboardLines(lines) ? lines : null
  const safeCategories = isDashboardCategories(categories) ? categories : null
  const safeTopMerchants = isDashboardTopMerchants(topMerchants) ? topMerchants : null

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button disabled>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-20 bg-gray-200 rounded"></div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Financial overview for {formatMonthLong(effectiveMonth || selectedMonth)}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            max={meta?.latest_data_month || getCurrentMonth()}
            className="h-10 w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
          />
          <Button onClick={handleRefresh} disabled={isRefreshing} className="h-10 w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Latest Available Banner */}
      {showFallbackBanner && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800 sm:text-base">
                <strong>Latest available</strong> – {formatMonthLong(selectedMonth)} has no data. 
                Showing {formatMonthLong(effectiveMonth || '')} instead.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-0 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-500 text-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Story Mode</p>
              <h3 className="mt-1 text-lg font-bold sm:text-xl">Your Year in Review is ready</h3>
              <p className="mt-1 text-sm text-blue-100">
                Open full-screen wrapped and tap through each chapter like a story.
              </p>
            </div>
            <Sparkles className="h-5 w-5 shrink-0 text-blue-100" />
          </div>
          <Button asChild variant="secondary" className="mt-4 w-full sm:w-auto">
            <Link to="/year-in-review?story=1">
              <Play className="mr-2 h-4 w-4" />
              View Your Wrapped
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      {safeCards && <CardsRow cards={safeCards} />}

      {/* Charts Row 1: Net Worth and Income vs Expenses */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {safeLines && <NetWorthArea data={safeLines} />}
        {safeLines && <IncomeVsExpensesLines data={safeLines} />}
      </div>

      {/* Charts Row 2: Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {safeCategories && <CategoryDoughnut data={safeCategories} effectiveMonth={effectiveMonth || selectedMonth} />}
        {safeCategories && <TopCategoriesBar data={safeCategories} />}
      </div>

      {/* Bottom Row: Details and Merchants */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {safeCategories && <CategoryDetailsList data={safeCategories} />}
        {safeTopMerchants && <TopMerchants data={safeTopMerchants} />}
      </div>
    </div>
  )
}



















