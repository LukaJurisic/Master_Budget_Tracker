import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import { formatMonthLong, getCurrentMonth, isAfterCurrentMonth } from '@/lib/formatters'

// Dashboard components
import { CardsRow } from '@/components/dashboard/CardsRow'
import { NetWorthArea } from '@/components/dashboard/NetWorthArea'
import { IncomeVsExpensesLines } from '@/components/dashboard/IncomeVsExpensesLines'
import { CategoryDoughnut } from '@/components/dashboard/CategoryDoughnut'
import { TopCategoriesBar } from '@/components/dashboard/TopCategoriesBar'
import { CategoryDetailsList } from '@/components/dashboard/CategoryDetailsList'
import { TopMerchants } from '@/components/dashboard/TopMerchants'

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

  const { data: lines, isLoading: linesLoading, error: linesError } = useQuery({
    queryKey: ['dashboard-lines'],
    queryFn: () => apiClient.getDashboardLines(),
  })

  // Debug logging
  console.log('Dashboard lines query result:', { lines, linesLoading, linesError })
  
  // If there's an error, log it
  if (linesError) {
    console.error('Dashboard lines query error:', linesError)
  }

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

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Financial overview for {formatMonthLong(effectiveMonth || selectedMonth)}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            max={meta?.latest_data_month || getCurrentMonth()}
            className="px-3 py-2 border rounded-lg"
          />
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Latest Available Banner */}
      {showFallbackBanner && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800">
                <strong>Latest available</strong> – {formatMonthLong(selectedMonth)} has no data. 
                Showing {formatMonthLong(effectiveMonth || '')} instead.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      {cards && <CardsRow cards={cards} />}

      {/* Charts Row 1: Net Worth and Income vs Expenses */}
      <div className="grid gap-6 md:grid-cols-2">
        {lines && <NetWorthArea data={lines} />}
        {lines && <IncomeVsExpensesLines data={lines} />}
      </div>

      {/* Charts Row 2: Category Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {categories && <CategoryDoughnut data={categories} effectiveMonth={effectiveMonth || selectedMonth} />}
        {categories && <TopCategoriesBar data={categories} />}
      </div>

      {/* Bottom Row: Details and Merchants */}
      <div className="grid gap-6 md:grid-cols-2">
        {categories && <CategoryDetailsList data={categories} />}
        {topMerchants && <TopMerchants data={topMerchants} />}
      </div>
    </div>
  )
}



















