import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api'
import { useIsMobile } from '@/hooks/useIsMobile'

interface DateRangePickerProps {
  onRangeChange: (startDate: string, endDate: string) => void
  disabled?: boolean
}

export function DateRangePicker({ onRangeChange, disabled }: DateRangePickerProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const isMobile = useIsMobile()

  // Get available date range from backend
  const { data: availableMonths } = useQuery({
    queryKey: ['analytics-available-months'],
    queryFn: () => apiClient.getAnalyticsAvailableMonths(),
  })

  // Initialize date range when data loads (only once)
  useEffect(() => {
    if (availableMonths?.min_month && availableMonths?.latest_with_data && !startDate && !endDate) {
      const minDate = `${availableMonths.min_month}-01`
      // Calculate month-end of latest data correctly
      const latestMonth = availableMonths.latest_with_data
      const [year, month] = latestMonth.split('-').map(Number)
      const monthEnd = new Date(year, month, 0) // month is 1-based, so this gets last day of that month
      const maxDate = monthEnd.toISOString().split('T')[0]
      
      setStartDate(minDate)
      setEndDate(maxDate)
      onRangeChange(minDate, maxDate)
    }
  }, [availableMonths]) // Remove onRangeChange from deps to prevent loops

  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    if (value && endDate) {
      onRangeChange(value, endDate)
    }
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
    if (startDate && value) {
      onRangeChange(startDate, value)
    }
  }

  const handleQuickRange = (range: 'ytd' | 'last12' | 'all') => {
    if (!availableMonths?.min_month || !availableMonths?.latest_with_data) return

    let newStartDate = ''
    // Calculate month-end of latest data correctly
    const latestMonth = availableMonths.latest_with_data
    const [year, month] = latestMonth.split('-').map(Number)
    const monthEnd = new Date(year, month, 0) // month is 1-based, so this gets last day of that month
    const maxDate = monthEnd.toISOString().split('T')[0]

    switch (range) {
      case 'ytd':
        // Year to date: January 1st of latest data year to latest data month-end
        newStartDate = year + '-01-01'
        break
      case 'last12':
        // Last 12 months from latest data month
        const last12Start = new Date(year, month - 12, 1) // 12 months back, first day
        newStartDate = last12Start.toISOString().split('T')[0]
        break
      case 'all':
        // All available data
        newStartDate = `${availableMonths.min_month}-01`
        break
    }

    setStartDate(newStartDate)
    setEndDate(maxDate)
    onRangeChange(newStartDate, maxDate)
  }

  if (!availableMonths?.min_month) {
    return (
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-gray-500">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Loading date range...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const minAllowed = `${availableMonths.min_month}-01`
  // Allow dates up to today, not just latest data month
  const today = new Date()
  const maxAllowed = today.toISOString().split('T')[0]

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-4 sm:pt-6">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <Label className="text-sm font-medium text-blue-800">Date Range Filter</Label>
          </div>
          
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <div className="grid grid-cols-[40px_1fr] items-center gap-2">
              <Label htmlFor="start-date" className="text-xs text-gray-600">From:</Label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                min={minAllowed}
                max={maxAllowed}
                disabled={disabled}
                className="w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:ring-blue-300 disabled:bg-gray-100"
              />
            </div>
            
            <div className="grid grid-cols-[40px_1fr] items-center gap-2">
              <Label htmlFor="end-date" className="text-xs text-gray-600">To:</Label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                min={minAllowed}
                max={maxAllowed}
                disabled={disabled}
                className="w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:ring-blue-300 disabled:bg-gray-100"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-1 sm:flex sm:space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickRange('ytd')}
                disabled={disabled}
                className="h-8 px-2 py-1 text-xs"
              >
                YTD
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickRange('last12')}
                disabled={disabled}
                className="h-8 px-2 py-1 text-xs"
              >
                Last 12M
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickRange('all')}
                disabled={disabled}
                className="h-8 px-2 py-1 text-xs"
              >
                All Time
              </Button>
            </div>
          </div>
          
          {availableMonths.min_month && availableMonths.latest_with_data && (
            <p className="text-xs text-gray-500">
              Available data: {availableMonths.min_month} to {availableMonths.latest_with_data}
              {isMobile ? ' (optimized for phone range picks)' : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
