import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'
import { SummaryRange } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

interface SavingsByMonthProps {
  data: SummaryRange | undefined
  isLoading?: boolean
}

export function SavingsByMonth({ data, isLoading }: SavingsByMonthProps) {
  const isMobile = useIsMobile()

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 rounded bg-gray-200"></div>
          <div className="h-4 w-64 rounded bg-gray-200"></div>
        </CardHeader>
        <CardContent>
          <div className="h-72 rounded bg-gray-200 sm:h-80"></div>
        </CardContent>
      </Card>
    )
  }

  const rawSavings = (data as any)?.savings_by_month ?? []
  const series: { month: string; net_savings: number }[] = asArray(rawSavings)

  if (!series.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Savings by Month</CardTitle>
          <CardDescription>Monthly net savings with average line</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState title="No savings data" description="No historical savings data available for the selected range" />
        </CardContent>
      </Card>
    )
  }

  const totalSavings = series.reduce((sum, point) => sum + (point.net_savings || 0), 0)
  const savingsAvg = series.length > 0 ? totalSavings / series.length : 0

  const chartData = series.map((point) => {
    const [year, monthNum] = point.month.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthLabel = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`
    const savings = point.net_savings || 0

    return {
      month: monthLabel,
      savings,
      fill: savings >= 0 ? '#22c55e' : '#ef4444',
    }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      return (
        <div className="rounded border bg-white p-3 shadow-lg">
          <p className="font-medium">{`Month: ${label}`}</p>
          <p className={`text-sm ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>Savings: {formatCurrency(value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings by Month</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Monthly net savings
          <span className="block sm:inline"> Avg: {formatCurrency(savingsAvg)}</span>
          <span className="block sm:inline"> Total: {formatCurrency(totalSavings)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <BarChart
            data={chartData}
            margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 24, left: 64, bottom: 52 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              angle={isMobile ? 0 : -35}
              textAnchor={isMobile ? 'middle' : 'end'}
              interval={isMobile ? 'preserveStartEnd' : 0}
              minTickGap={isMobile ? 16 : 8}
              height={isMobile ? 30 : 60}
              fontSize={isMobile ? 10 : 12}
            />
            <YAxis tickFormatter={formatCurrency} width={isMobile ? 44 : 70} tick={{ fontSize: isMobile ? 10 : 12 }} />
            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={savingsAvg}
              stroke="#d946ef"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={isMobile ? undefined : { value: `Avg: ${formatCurrency(savingsAvg)}`, position: savingsAvg >= 0 ? 'topRight' : 'bottomRight' }}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />

            <Bar dataKey="savings" name="savings">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
