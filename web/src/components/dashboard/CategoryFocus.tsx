import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { apiClient, CategorySeries } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface CategoryFocusProps {
  dateFrom: string
  dateTo: string
  disabled?: boolean
}

export function CategoryFocus({ dateFrom, dateTo, disabled }: CategoryFocusProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

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
    queryKey: ['analytics-category-series', selectedCategoryId, dateFrom, dateTo],
    queryFn: () => selectedCategoryId ? apiClient.getAnalyticsCategorySeries(selectedCategoryId, dateFrom, dateTo) : Promise.resolve(null),
    enabled: !!selectedCategoryId && !!dateFrom && !!dateTo,
  })

  const handleCategoryChange = (value: string) => {
    if (value === '' || value === '__none__') {
      setSelectedCategoryId(null)
    } else {
      setSelectedCategoryId(parseInt(value))
    }
  }

  const formatChartData = (data: CategorySeries) => {
    const months = data?.months ?? data?.series?.map((s: any) => s.month) ?? [];
    const values = data?.values ?? data?.series?.map((s: any) => s.amount) ?? [];
    
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
        <CardDescription>Monthly spending for a specific category with average line</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Category selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Category:</label>
            <div className="w-64">
              <Select 
                value={selectedCategoryId ? selectedCategoryId.toString() : ""} 
                onValueChange={handleCategoryChange}
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
          <div className="h-80">
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
                <LineChart data={formatChartData(categoryData)} margin={{ top: 20, right: 30, left: 80, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={12}
                  />
                  <YAxis tickFormatter={formatCurrency} width={70} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  
                  {/* Average line in blue */}
                  <ReferenceLine 
                    y={categoryData.monthly_avg ?? 0} 
                    stroke="#3b82f6" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ 
                      value: `Avg: ${formatCurrency(categoryData.monthly_avg ?? 0)}`, 
                      position: "topRight" 
                    }}
                  />
                  
                  {/* Spending line */}
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name="amount"
                    dot={{ r: 4, fill: "#3b82f6" }}
                    activeDot={{ r: 6, fill: "#2563eb" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary stats */}
          {categoryData && (categoryData.total ?? 0) > 0 && formatChartData(categoryData).length > 0 && (
            <div className="flex justify-between text-sm text-gray-600 pt-2 border-t">
              <span>Total: {formatCurrency(categoryData.total ?? 0)}</span>
              <span>Average: {formatCurrency(categoryData.monthly_avg ?? 0)}/month</span>
              <span>{formatChartData(categoryData).length} months</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}