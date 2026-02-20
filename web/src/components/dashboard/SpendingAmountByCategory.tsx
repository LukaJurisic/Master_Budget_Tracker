import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SpendingAmountByCategoryResponse } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface SpendingAmountByCategoryProps {
  data: SpendingAmountByCategoryResponse | undefined
  isLoading: boolean
  dateRange?: string
}

export function SpendingAmountByCategory({ data, isLoading, dateRange }: SpendingAmountByCategoryProps) {
  const isMobile = useIsMobile()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Amount by Category</CardTitle>
          <CardDescription>Total spending amount per month by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[240px] items-center justify-center sm:h-[300px]">
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
          <EmptyState title="No category data" description="No categorized transactions found" />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.data.map((item) => ({
    category: item.category,
    avg_per_month: item.avg_per_month,
    total_amount: item.total_amount,
    total_transactions: item.total_transactions,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Amount by Category</CardTitle>
        <CardDescription>
          Average spending amount per month by category
          {dateRange && ` - ${dateRange}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <BarChart
            data={chartData}
            margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 24, left: 48, bottom: 64 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="category"
              angle={isMobile ? 0 : -35}
              textAnchor={isMobile ? 'middle' : 'end'}
              interval={isMobile ? 'preserveStartEnd' : 0}
              minTickGap={isMobile ? 16 : 8}
              height={isMobile ? 30 : 80}
              fontSize={isMobile ? 10 : 12}
            />
            <YAxis
              label={isMobile ? undefined : { value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
              width={isMobile ? 36 : 50}
              tickFormatter={(value) => `$${value}`}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length > 0) {
                  const row = payload[0].payload
                  return (
                    <div className="max-w-[260px] rounded-lg border border-border bg-background p-3 shadow-lg sm:max-w-none">
                      <p className="font-medium">{`Category: ${label}`}</p>
                      <p className="text-sm text-muted-foreground">{`${formatCurrency(row.avg_per_month)} per month`}</p>
                      <p className="text-xs text-muted-foreground">{`${formatCurrency(row.total_amount)} total · ${row.total_transactions} transactions`}</p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="avg_per_month" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
