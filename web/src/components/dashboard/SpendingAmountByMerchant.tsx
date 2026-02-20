import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SpendingAmountByMerchantResponse } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface SpendingAmountByMerchantProps {
  data: SpendingAmountByMerchantResponse | undefined
  isLoading: boolean
  dateRange?: string
}

export function SpendingAmountByMerchant({ data, isLoading, dateRange }: SpendingAmountByMerchantProps) {
  const isMobile = useIsMobile()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Amount by Merchant</CardTitle>
          <CardDescription>Average spending amount per month by merchant</CardDescription>
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
          <CardTitle>Spending Amount by Merchant</CardTitle>
          <CardDescription>Average spending amount per month by merchant</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState title="No merchant data" description="No merchant transactions found" />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.data.map((item) => ({
    merchant: item.merchant.length > 15 ? `${item.merchant.slice(0, 15)}...` : item.merchant,
    full_merchant: item.merchant,
    avg_per_month: item.avg_per_month,
    total_amount: item.total_amount,
    total_transactions: item.total_transactions,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Amount by Merchant</CardTitle>
        <CardDescription>
          Average spending amount per month by merchant
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
              dataKey="merchant"
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
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const row = payload[0].payload
                  return (
                    <div className="max-w-[260px] rounded-lg border border-border bg-background p-3 shadow-lg sm:max-w-none">
                      <p className="font-medium">{`Merchant: ${row.full_merchant}`}</p>
                      <p className="text-sm text-muted-foreground">{`${formatCurrency(row.avg_per_month)} per month`}</p>
                      <p className="text-xs text-muted-foreground">{`${formatCurrency(row.total_amount)} total · ${row.total_transactions} transactions`}</p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="avg_per_month" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
