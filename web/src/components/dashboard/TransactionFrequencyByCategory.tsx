import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TransactionFrequencyByCategoryResponse } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface TransactionFrequencyByCategoryProps {
  data: TransactionFrequencyByCategoryResponse | undefined
  isLoading: boolean
  dateRange?: string
}

export function TransactionFrequencyByCategory({ data, isLoading, dateRange }: TransactionFrequencyByCategoryProps) {
  const isMobile = useIsMobile()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Frequency by Category</CardTitle>
          <CardDescription>Average transactions per month by category</CardDescription>
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
          <CardTitle>Transaction Frequency by Category</CardTitle>
          <CardDescription>Average transactions per month by category</CardDescription>
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
    total_transactions: item.total_transactions,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Frequency by Category</CardTitle>
        <CardDescription>
          Average transactions per month by category
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
              label={isMobile ? undefined : { value: 'Avg/Month', angle: -90, position: 'insideLeft' }}
              width={isMobile ? 36 : 50}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length > 0) {
                  const row = payload[0].payload
                  return (
                    <div className="max-w-[260px] rounded-lg border border-border bg-background p-3 shadow-lg sm:max-w-none">
                      <p className="font-medium">{`Category: ${label}`}</p>
                      <p className="text-sm text-muted-foreground">{`${row.avg_per_month} transactions/month`}</p>
                      <p className="text-xs text-muted-foreground">{`${row.total_transactions} total transactions`}</p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="avg_per_month" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
