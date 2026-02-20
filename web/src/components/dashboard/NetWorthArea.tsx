import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { DashboardLines } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface NetWorthAreaProps {
  data: DashboardLines
}

export function NetWorthArea({ data }: NetWorthAreaProps) {
  const isMobile = useIsMobile()

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
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <AreaChart data={chartData} margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 24, left: 64, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              angle={isMobile ? 0 : -35}
              textAnchor={isMobile ? "middle" : "end"}
              interval={isMobile ? "preserveStartEnd" : 0}
              minTickGap={isMobile ? 16 : 8}
              height={isMobile ? 30 : 60}
              fontSize={isMobile ? 10 : 12}
            />
            <YAxis tickFormatter={formatCurrency} width={isMobile ? 44 : 70} tick={{ fontSize: isMobile ? 10 : 12 }} />
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
