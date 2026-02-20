import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, ComposedChart, Bar } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { apiClient, CategorySeries } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface CategoryFocusProps {
  dateFrom: string
  dateTo: string
  disabled?: boolean
}

export function CategoryFocus({ dateFrom, dateTo, disabled }: CategoryFocusProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const isMobile = useIsMobile()

  // Get available categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  })

  // Auto-select "Groceries" as default when categories load
  useEffect(() => {
    if (categories && categories.length > 0 && selectedCategoryId === null && !hasInitialized) {
      // Find Groceries category first
      const groceriesCategory = categories.find(cat => 
        cat.name.toLowerCase() === 'groceries' || 
        cat.name.toLowerCase() === 'grocery'
      )
      
      if (groceriesCategory) {
        setHasInitialized(true) // Set this BEFORE setting the category ID to prevent loops
        setSelectedCategoryId(groceriesCategory.id)
      } else {
        // Fallback to any category with "grocery", "groceries", or "food" in the name
        const fallbackCategory = categories.find(cat => 
          cat.name.toLowerCase().includes('grocery') || 
          cat.name.toLowerCase().includes('groceries') ||
          cat.name.toLowerCase().includes('food')
        )
        setHasInitialized(true)
        if (fallbackCategory) {
          setSelectedCategoryId(fallbackCategory.id)
        }
      }
    }
  }, [categories]) // Only depend on categories, not hasInitialized

  // Get category series data
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['analytics-category-series-v2', selectedCategoryId, dateFrom, dateTo], // v2 to bust cache
    queryFn: () => {
      if (!selectedCategoryId) return Promise.resolve(null);
      if (selectedCategoryId === -1) {
        // For "All Categories", we'll need a new endpoint or aggregate the data
        return apiClient.getAnalyticsAllCategoriesSeries(dateFrom, dateTo);
      }
      return apiClient.getAnalyticsCategorySeries(selectedCategoryId, dateFrom, dateTo);
    },
    enabled: !!selectedCategoryId && !!dateFrom && !!dateTo,
  })

  const handleCategoryChange = (value: string) => {
    if (value === '' || value === '__none__') {
      setSelectedCategoryId(null)
    } else if (value === 'all') {
      setSelectedCategoryId(-1) // Use -1 to indicate "all categories"
    } else {
      setSelectedCategoryId(parseInt(value))
    }
  }

  const formatChartData = (data: CategorySeries) => {
    const months = data?.months ?? data?.series?.map((s: any) => s.month) ?? [];
    const values = data?.values ?? data?.series?.map((s: any) => s.amount) ?? [];
    const txnCounts = data?.txn_counts ?? data?.series?.map((s: any) => s.txn_count) ?? [];
    
    if (months.length === 0) return [];
    
    return months.map((month: string, index: number) => {
      // Convert YYYY-MM to MMM YYYY format for display
      const [year, monthNum] = month.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`
      
      return {
        month: monthLabel,
        amount: values[index] ?? 0,
        txn_count: txnCounts[index] ?? 0,
      }
    })
  }

  // Filter categories to only show expense categories (simple now since no children)
  const expenseCategories = (categories?.filter(cat => 
    cat.name !== 'Income' && !cat.name.toLowerCase().includes('income')
  ) || []).sort((a, b) => a.name.localeCompare(b.name))


  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Focus</CardTitle>
        <CardDescription>Monthly spending with transaction count overlay and average line</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Category selector */}
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:space-x-2">
            <label className="text-sm font-medium">Category:</label>
            <div className="w-full sm:w-64">
              <Select 
                value={selectedCategoryId === null ? "" : selectedCategoryId === -1 ? "all" : selectedCategoryId.toString()} 
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category to analyze" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6} avoidCollisions>
                  <SelectItem value="__none__">Select a category to analyze</SelectItem>
                  <SelectItem value="all">All Categories</SelectItem>
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
                description="Choose a category from the dropdown to view its spending trend"
              />
            ) : categoryLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-gray-500">Loading category data...</div>
              </div>
            ) : !categoryData || (categoryData.total ?? 0) === 0 || formatChartData(categoryData).length === 0 ? (
              <EmptyState 
                title="No spending data"
                description="This category has no expenses in the selected date range"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={formatChartData(categoryData)}
                  margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 36, left: 64, bottom: 52 }}
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
                  <YAxis yAxisId="amount" tickFormatter={formatCurrency} width={isMobile ? 44 : 70} tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <YAxis yAxisId="count" orientation="right" width={isMobile ? 28 : 50} tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => {
                      if (name === 'amount') return [formatCurrency(value), 'Amount'];
                      if (name === 'txn_count') {
                        const amount = props.payload.amount;
                        const avgPerTxn = value > 0 ? amount / value : 0;
                        return [
                          <span style={{ color: '#22c55e', fontWeight: 500 }}>
                            {value} (avg: {formatCurrency(avgPerTxn)})
                          </span>, 
                          'Transactions'
                        ];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
                    itemSorter={(item: any) => {
                      // Sort to show amount first, then txn_count
                      if (item.dataKey === 'amount') return -1;
                      if (item.dataKey === 'txn_count') return 1;
                      return 0;
                    }}
                  />
                  
                  {/* Average line in blue */}
                  <ReferenceLine 
                    yAxisId="amount"
                    y={categoryData.monthly_avg ?? 0} 
                    stroke="#3b82f6" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={isMobile ? undefined : { value: `Avg: ${formatCurrency(categoryData.monthly_avg ?? 0)}`, position: "topRight" }}
                  />
                  
                  {/* Transaction count bars - darker for better visibility */}
                  <Bar
                    yAxisId="count"
                    dataKey="txn_count"
                    fill="rgba(34, 197, 94, 0.5)"
                    stroke="#16a34a"
                    strokeWidth={1}
                    name="txn_count"
                  />
                  
                  {/* Spending line */}
                  <Line
                    yAxisId="amount"
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={isMobile ? 2.5 : 3}
                    name="amount"
                    dot={{ r: isMobile ? 2.5 : 4, fill: "#3b82f6" }}
                    activeDot={{ r: isMobile ? 4 : 6, fill: "#2563eb" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary stats */}
          {categoryData && (categoryData.total ?? 0) > 0 && formatChartData(categoryData).length > 0 && (() => {
            const totalTxns = (categoryData.txn_counts ?? []).reduce((sum, count) => sum + count, 0);
            const avgPerTxn = totalTxns > 0 ? (categoryData.total ?? 0) / totalTxns : 0;
            return (
              <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs text-gray-600 sm:flex sm:justify-between sm:text-sm">
                <span>Total: {formatCurrency(categoryData.total ?? 0)}</span>
                <span>Monthly Avg: {formatCurrency(categoryData.monthly_avg ?? 0)}</span>
                <span>Avg/Transaction: {formatCurrency(avgPerTxn)}</span>
                <span>{formatChartData(categoryData).length} months</span>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  )
}
