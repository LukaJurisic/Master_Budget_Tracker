import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { DashboardCategories } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface TopCategoriesBarProps {
  data: DashboardCategories
}

export function TopCategoriesBar({ data }: TopCategoriesBarProps) {
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="category" 
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={12}
              width={60}
            />
            <YAxis tickFormatter={formatCurrency} />
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