import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { apiClient } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface CategoryMerchantStackedBarProps {
  dateFrom: string
  dateTo: string
  disabled?: boolean
}

// Color palette for different merchants
const MERCHANT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
  '#14b8a6', '#f43f5e', '#22c55e', '#a855f7', '#0ea5e9',
  '#65a30d', '#dc2626', '#9333ea', '#059669', '#ea580c'
];

export function CategoryMerchantStackedBar({ dateFrom, dateTo, disabled }: CategoryMerchantStackedBarProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const isMobile = useIsMobile()

  // Get available categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  })

  // Auto-select "QSR" as default when categories load
  useEffect(() => {
    if (categories && categories.length > 0 && selectedCategoryId === null && !hasInitialized) {
      // Find QSR category first
      const qsrCategory = categories.find(cat => 
        cat.name.toLowerCase() === 'qsr' || 
        cat.name.toLowerCase().includes('quick service') ||
        cat.name.toLowerCase().includes('fast food')
      )
      
      if (qsrCategory) {
        setHasInitialized(true)
        setSelectedCategoryId(qsrCategory.id)
      } else {
        // Fallback to any restaurant/food category
        const fallbackCategory = categories.find(cat => 
          cat.name.toLowerCase().includes('restaurant') || 
          cat.name.toLowerCase().includes('dining') ||
          cat.name.toLowerCase().includes('food')
        )
        setHasInitialized(true)
        if (fallbackCategory) {
          setSelectedCategoryId(fallbackCategory.id)
        }
      }
    }
  }, [categories])

  // Get merchant spending data for the selected category
  const { data: merchantData, isLoading: merchantLoading } = useQuery({
    queryKey: ['category-merchant-stacked', selectedCategoryId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCategoryId) return null
      
      // This endpoint will need to be created in the backend
      const response = await fetch(`/api/analytics/category-merchant-breakdown?category_id=${selectedCategoryId}&date_from=${dateFrom}&date_to=${dateTo}`)
      if (!response.ok) throw new Error('Failed to fetch merchant data')
      return response.json()
    },
    enabled: !!selectedCategoryId && !!dateFrom && !!dateTo,
  })

  const handleCategoryChange = (value: string) => {
    if (value === '' || value === '__none__') {
      setSelectedCategoryId(null)
    } else {
      setSelectedCategoryId(parseInt(value))
    }
  }

  const formatChartData = (data: any) => {
    if (!data?.months) return []
    
    // Transform the data into format suitable for stacked bar chart
    return data.months.map((monthData: any) => {
      const [year, monthNum] = monthData.month.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`
      
      const chartEntry: any = { month: monthLabel }
      
      // Add each merchant as a separate key for stacking
      monthData.merchants?.forEach((merchant: any, index: number) => {
        chartEntry[merchant.name] = Math.abs(merchant.amount) // Use absolute value for display
      })
      
      return chartEntry
    })
  }

  // Get unique merchants across all months for consistent stacking
  const getAllMerchants = (data: any) => {
    if (!data?.months) return []
    
    const merchantSet = new Set<string>()
    data.months.forEach((monthData: any) => {
      monthData.merchants?.forEach((merchant: any) => {
        merchantSet.add(merchant.name)
      })
    })
    
    return Array.from(merchantSet)
  }

  // Filter categories to only show expense categories
  const expenseCategories = (categories?.filter(cat => 
    cat.name !== 'Income' && !cat.name.toLowerCase().includes('income')
  ) || []).sort((a, b) => a.name.localeCompare(b.name))

  const chartData = formatChartData(merchantData)
  const allMerchants = getAllMerchants(merchantData)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Merchant Breakdown</CardTitle>
        <CardDescription>Monthly spending by merchant within selected category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Category selector */}
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:space-x-2">
            <label className="text-sm font-medium">Category:</label>
            <div className="w-full sm:w-64">
              <Select 
                value={selectedCategoryId ? selectedCategoryId.toString() : ""} 
                onValueChange={handleCategoryChange}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category to analyze" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6} avoidCollisions>
                  <SelectItem value="__none__">Select a category to analyze</SelectItem>
                  {expenseCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chart area */}
          <div className="h-72 sm:h-80">
            {!selectedCategoryId ? (
              <EmptyState 
                title="Select a category"
                description="Choose a category from the dropdown to view merchant breakdown"
              />
            ) : merchantLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-gray-500">Loading merchant data...</div>
              </div>
            ) : !merchantData || chartData.length === 0 ? (
              <EmptyState 
                title="No merchant data"
                description="This category has no merchant data in the selected date range"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 24, left: 64, bottom: 52 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    angle={isMobile ? 0 : -35}
                    textAnchor={isMobile ? "middle" : "end"}
                    interval={isMobile ? "preserveStartEnd" : 0}
                    minTickGap={isMobile ? 16 : 8}
                    height={isMobile ? 30 : 60}
                    fontSize={isMobile ? 10 : 12}
                  />
                  <YAxis tickFormatter={formatCurrency} width={isMobile ? 44 : 70} tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length > 0) {
                        // Filter out entries with 0 values and sort by amount descending
                        const sortedPayload = payload
                          .filter(entry => entry.value && entry.value > 0)
                          .sort((a, b) => (b.value as number) - (a.value as number))
                        
                        if (sortedPayload.length === 0) return null
                        
                        return (
                          <div className="max-w-[260px] rounded-lg border border-border bg-background p-3 shadow-lg sm:max-w-none">
                            <p className="font-medium mb-2">{`Month: ${label}`}</p>
                            {sortedPayload.map((entry, index) => (
                              <div key={index} className="flex justify-between items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-sm" 
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span>{entry.name}</span>
                                </div>
                                <span className="font-medium">{formatCurrency(entry.value as number)}</span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  
                  {/* Create a Bar for each merchant */}
                  {allMerchants.map((merchant, index) => (
                    <Bar
                      key={merchant}
                      dataKey={merchant}
                      stackId="merchants"
                      fill={MERCHANT_COLORS[index % MERCHANT_COLORS.length]}
                      name={merchant}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary stats */}
          {merchantData && chartData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs text-gray-600 sm:flex sm:justify-between sm:text-sm">
              <span>Merchants: {allMerchants.length}</span>
              <span>Months: {chartData.length}</span>
              <span>Total: {formatCurrency(merchantData.total || 0)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
