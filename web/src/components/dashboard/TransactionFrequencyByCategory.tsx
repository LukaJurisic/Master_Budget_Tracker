import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TransactionFrequencyByCategoryResponse } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface TransactionFrequencyByCategoryProps {
  data: TransactionFrequencyByCategoryResponse | undefined
  isLoading: boolean
  dateRange?: string
}

export function TransactionFrequencyByCategory({ data, isLoading, dateRange }: TransactionFrequencyByCategoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Frequency by Category</CardTitle>
          <CardDescription>Average transactions per month by category</CardDescription>
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
          <CardTitle>Transaction Frequency by Category</CardTitle>
          <CardDescription>Average transactions per month by category</CardDescription>
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
    total_transactions: item.total_transactions,
    color: item.color || '#8884d8'
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Frequency by Category</CardTitle>
        <CardDescription>
          Average transactions per month by category
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
              label={{ value: 'Avg/Month', angle: -90, position: 'insideLeft' }}
              width={50}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'avg_per_month') {
                  return [`${value} avg/month`, 'Frequency']
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
                        {`${data.avg_per_month} transactions/month`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {`${data.total_transactions} total transactions`}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar 
              dataKey="avg_per_month" 
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}