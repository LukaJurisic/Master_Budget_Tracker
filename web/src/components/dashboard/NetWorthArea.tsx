import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { DashboardLines } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface NetWorthAreaProps {
  data: DashboardLines
}

export function NetWorthArea({ data }: NetWorthAreaProps) {
  if (!data?.networth_cumulative?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Worth Over Time</CardTitle>
          <CardDescription>Cumulative savings progression</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No net worth data"
            description="No historical data available to show net worth progression"
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.networth_cumulative.map((item) => ({
    month: formatMonth(item.month),
    networth: item.amount,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Over Time</CardTitle>
        <CardDescription>Cumulative savings progression</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 80, bottom: 70 }}>
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
              formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="networth"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}