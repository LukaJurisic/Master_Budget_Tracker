import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SpendingAmountByMerchantResponse } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { EmptyState } from './EmptyState'

interface SpendingAmountByMerchantProps {
  data: SpendingAmountByMerchantResponse | undefined
  isLoading: boolean
  dateRange?: string
}

export function SpendingAmountByMerchant({ data, isLoading, dateRange }: SpendingAmountByMerchantProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Amount by Merchant</CardTitle>
          <CardDescription>Average spending amount per month by merchant</CardDescription>
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
          <CardTitle>Spending Amount by Merchant</CardTitle>
          <CardDescription>Average spending amount per month by merchant</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No merchant data"
            description="No merchant transactions found"
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.data.map((item) => ({
    merchant: item.merchant.length > 15 ? `${item.merchant.slice(0, 15)}...` : item.merchant,
    full_merchant: item.merchant, // Keep full name for tooltip
    avg_per_month: item.avg_per_month,
    total_amount: item.total_amount,
    total_transactions: item.total_transactions
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Amount by Merchant</CardTitle>
        <CardDescription>
          Average spending amount per month by merchant
          {dateRange && ` • ${dateRange}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="merchant" 
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
              content={({ active, payload, label }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{`Merchant: ${data.full_merchant}`}</p>
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
              fill="#f59e0b"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}