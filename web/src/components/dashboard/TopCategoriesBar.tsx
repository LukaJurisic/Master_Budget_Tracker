import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { DashboardCategories } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface TopCategoriesBarProps {
  data: DashboardCategories
}

export function TopCategoriesBar({ data }: TopCategoriesBarProps) {
  const isMobile = useIsMobile()

  if (!data.top_categories.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
          <CardDescription>Highest spending categories</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No category data"
            description="No expense categories found"
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.top_categories.map((item) => ({
    category: item.category,
    amount: item.amount,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Categories</CardTitle>
        <CardDescription>Highest spending categories</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <BarChart data={chartData} margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 24, left: 40, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="category" 
              angle={isMobile ? 0 : -35}
              textAnchor={isMobile ? "middle" : "end"}
              interval={isMobile ? "preserveStartEnd" : 0}
              minTickGap={isMobile ? 16 : 8}
              height={isMobile ? 30 : 80}
              fontSize={isMobile ? 10 : 12}
            />
            <YAxis tickFormatter={formatCurrency} width={isMobile ? 36 : 60} tick={{ fontSize: isMobile ? 10 : 12 }} />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Amount']}
              labelFormatter={(label) => `Category: ${label}`}
            />
            <Bar dataKey="amount" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
