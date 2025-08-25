import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SpendingAmountByCategoryResponse } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { EmptyState } from './EmptyState'

interface SpendingAmountByCategoryProps {
  data: SpendingAmountByCategoryResponse | undefined
  isLoading: boolean
  dateRange?: string
}

export function SpendingAmountByCategory({ data, isLoading, dateRange }: SpendingAmountByCategoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Amount by Category</CardTitle>
          <CardDescription>Total spending amount per month by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data?.data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Amount by Category</CardTitle>
          <CardDescription>Total spending amount per month by category</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No category data"
            description="No categorized transactions found"
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.data.map((item) => ({
    category: item.category,
    avg_per_month: item.avg_per_month,
    total_amount: item.total_amount,
    total_transactions: item.total_transactions,
    color: item.color || '#10b981'
  }))


  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Amount by Category</CardTitle>
        <CardDescription>
          Average spending amount per month by category
          {dateRange && ` • ${dateRange}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="category" 
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={12}
              width={60}
            />
            <YAxis 
              label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
              width={50}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'avg_per_month') {
                  return [`${formatCurrency(value)} avg/month`, 'Spending']
                }
                return [value, name]
              }}
              labelFormatter={(label) => `Category: ${label}`}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{`Category: ${label}`}</p>
                      <p className="text-sm text-muted-foreground">
                        {`${formatCurrency(data.avg_per_month)} per month`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {`${formatCurrency(data.total_amount)} total • ${data.total_transactions} transactions`}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar 
              dataKey="avg_per_month" 
              fill="#10b981"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}