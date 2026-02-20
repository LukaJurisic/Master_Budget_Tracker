import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useIsMobile } from '@/hooks/useIsMobile'

// Import new analytics components
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { TotalsTriplet } from '@/components/dashboard/TotalsTriplet'
import { IncomeVsExpensesWithAverage } from '@/components/dashboard/IncomeVsExpensesWithAverage'
import { CategoryFocus } from '@/components/dashboard/CategoryFocus'
import { SavingsByMonth } from '@/components/dashboard/SavingsByMonth'
import { CategoryMerchantStackedBar } from '@/components/dashboard/CategoryMerchantStackedBar'
import { RecurringSubscriptions } from '@/components/dashboard/RecurringSubscriptions'
import { TransactionFrequencyByCategory } from '@/components/dashboard/TransactionFrequencyByCategory'
import { TransactionFrequencyByMerchant } from '@/components/dashboard/TransactionFrequencyByMerchant'
import { SpendingAmountByCategory } from '@/components/dashboard/SpendingAmountByCategory'
import { SpendingAmountByMerchant } from '@/components/dashboard/SpendingAmountByMerchant'

export default function AnalyticsDashboard() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isMobile = useIsMobile()

  // Get summary data for the selected range
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['analytics-summary-range', dateFrom, dateTo],
    queryFn: () => apiClient.getAnalyticsSummaryRange(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  })

  // Transaction frequency data
  const { data: categoryFrequency, isLoading: categoryFrequencyLoading } = useQuery({
    queryKey: ['transaction-frequency-category', dateFrom, dateTo],
    queryFn: () => apiClient.getTransactionFrequencyByCategory(dateFrom, dateTo, 10),
    enabled: !!dateFrom && !!dateTo,
  })

  const { data: merchantFrequency, isLoading: merchantFrequencyLoading } = useQuery({
    queryKey: ['transaction-frequency-merchant', dateFrom, dateTo],
    queryFn: () => apiClient.getTransactionFrequencyByMerchant(dateFrom, dateTo, 10),
    enabled: !!dateFrom && !!dateTo,
  })

  // Spending amount data
  const { data: categorySpending, isLoading: categorySpendingLoading } = useQuery({
    queryKey: ['spending-amount-category', dateFrom, dateTo],
    queryFn: () => apiClient.getSpendingAmountByCategory(dateFrom, dateTo, 10),
    enabled: !!dateFrom && !!dateTo,
  })

  const { data: merchantSpending, isLoading: merchantSpendingLoading } = useQuery({
    queryKey: ['spending-amount-merchant', dateFrom, dateTo],
    queryFn: () => apiClient.getSpendingAmountByMerchant(dateFrom, dateTo, 10),
    enabled: !!dateFrom && !!dateTo,
  })

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateFrom(startDate)
    setDateTo(endDate)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await apiClient.refreshData()
      await refetchSummary()
    } finally {
      setIsRefreshing(false)
    }
  }

  const isLoading = summaryLoading
  const hasDateRange = !!dateFrom && !!dateTo

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center space-x-2 text-2xl font-bold sm:text-3xl">
            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8" />
            <span>Analytics Dashboard</span>
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Excel-style financial analytics with date range filtering
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} className="w-full sm:w-auto">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker 
        onRangeChange={handleDateRangeChange}
        disabled={isRefreshing}
      />

      {/* Only show analytics content when we have a date range */}
      {hasDateRange && (
        <>
          {/* Totals Triplet */}
          <TotalsTriplet data={summaryData} isLoading={isLoading} />

          {/* Charts Row 1: Income vs Expenses and Savings */}
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <IncomeVsExpensesWithAverage data={summaryData} isLoading={isLoading} />
            <SavingsByMonth data={summaryData} isLoading={isLoading} />
          </div>

          {/* Charts Row 2: Category Focus (full width) */}
          <CategoryFocus 
            dateFrom={dateFrom} 
            dateTo={dateTo} 
            disabled={isRefreshing} 
          />

          {/* Transaction Frequency Row */}
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <TransactionFrequencyByCategory 
              data={categoryFrequency}
              isLoading={categoryFrequencyLoading}
              dateRange={`${dateFrom} to ${dateTo}`}
            />
            <TransactionFrequencyByMerchant 
              data={merchantFrequency}
              isLoading={merchantFrequencyLoading}
              dateRange={`${dateFrom} to ${dateTo}`}
            />
          </div>

          {/* Spending Amount Row */}
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <SpendingAmountByCategory 
              data={categorySpending}
              isLoading={categorySpendingLoading}
              dateRange={`${dateFrom} to ${dateTo}`}
            />
            <SpendingAmountByMerchant 
              data={merchantSpending}
              isLoading={merchantSpendingLoading}
              dateRange={`${dateFrom} to ${dateTo}`}
            />
          </div>

          {/* Category Merchant Stacked Bar Chart (full width) */}
          <CategoryMerchantStackedBar 
            dateFrom={dateFrom} 
            dateTo={dateTo} 
            disabled={isRefreshing} 
          />

          {/* Recurring Subscriptions */}
          <RecurringSubscriptions 
            dateFrom={dateFrom} 
            dateTo={dateTo}
          />
        </>
      )}

      {/* Loading state when no date range */}
      {!hasDateRange && (
        <div className="py-12 text-center">
          <p className="text-gray-500">
            {isMobile ? 'Pick a date range to load mobile analytics' : 'Select a date range to view analytics'}
          </p>
        </div>
      )}
    </div>
  )
}
