import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { SummaryRange } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

interface IncomeVsExpensesWithAverageProps {
  data: SummaryRange | undefined
  isLoading?: boolean
}

export function IncomeVsExpensesWithAverage({ data, isLoading }: IncomeVsExpensesWithAverageProps) {
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

  type Point = { month: string; income: number; expenses: number }
  const raw =
    (data as any)?.income_vs_expenses ??
    (data as any)?.series ??
    (data as any)?.lines ??
    (data as any)?.data?.series ??
    []

  const series: Point[] = asArray<Point>(raw)

  if (!series.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses</CardTitle>
          <CardDescription>Monthly cash flow with averages</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No cash flow data"
            description="No historical income and expense data available for the selected range"
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = series.map((point) => {
    const [year, monthNum] = point.month.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthLabel = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`

    return {
      month: monthLabel,
      income: point.income,
      expense: point.expenses,
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expenses</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Monthly cash flow with averages
          <span className="block sm:inline"> Avg Income: {formatCurrency((data as any)?.income_avg ?? 0)}</span>
          <span className="block sm:inline"> Avg Expenses: {formatCurrency((data as any)?.expense_avg ?? 0)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <LineChart
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
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? 'Income' : 'Expenses']}
              labelFormatter={(label) => `Month: ${label}`}
            />

            <ReferenceLine
              y={(data as any)?.income_avg ?? 0}
              stroke="#22c55e"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={isMobile ? undefined : { value: 'Avg Income', position: 'topRight' }}
            />
            <ReferenceLine
              y={(data as any)?.expense_avg ?? 0}
              stroke="#f87171"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={isMobile ? undefined : { value: 'Avg Expenses', position: 'bottomRight' }}
            />

            <Line
              type="monotone"
              dataKey="income"
              stroke="#22c55e"
              strokeWidth={isMobile ? 2.5 : 3}
              name="income"
              dot={{ r: isMobile ? 2.5 : 4, fill: '#22c55e' }}
              activeDot={{ r: isMobile ? 4 : 6, fill: '#16a34a' }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#f87171"
              strokeWidth={isMobile ? 2.5 : 3}
              name="expense"
              dot={{ r: isMobile ? 2.5 : 4, fill: '#f87171' }}
              activeDot={{ r: isMobile ? 4 : 6, fill: '#ef4444' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
