import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { DashboardLines } from '@/lib/api'
import { EmptyState } from './EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'

interface IncomeVsExpensesLinesProps {
  data: DashboardLines
}

export function IncomeVsExpensesLines({ data }: IncomeVsExpensesLinesProps) {
  const isMobile = useIsMobile()

  if (!data?.income_by_month?.length || !data?.expenses_by_month?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses</CardTitle>
          <CardDescription>Monthly cash flow comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No cash flow data"
            description="No historical income and expense data available"
          />
        </CardContent>
      </Card>
    )
  }

  // Merge income and expense data by month
  const monthsMap = new Map()
  
  data.income_by_month.forEach(item => {
    monthsMap.set(item.month, { month: item.month, income: item.amount, expense: 0 })
  })
  
  data.expenses_by_month.forEach(item => {
    const existing = monthsMap.get(item.month)
    if (existing) {
      existing.expense = item.amount
    } else {
      monthsMap.set(item.month, { month: item.month, income: 0, expense: item.amount })
    }
  })

  const chartData = Array.from(monthsMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(item => ({
      month: formatMonth(item.month),
      income: item.income,
      expense: item.expense,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expenses</CardTitle>
        <CardDescription>Monthly cash flow comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <LineChart data={chartData} margin={isMobile ? { top: 12, right: 8, left: 0, bottom: 20 } : { top: 20, right: 24, left: 56, bottom: 52 }}>
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
              formatter={(value: number, name: string) => [
                formatCurrency(value), 
                name === 'income' ? 'Income' : 'Expenses'
              ]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#82ca9d"
              strokeWidth={isMobile ? 2.5 : 2}
              name="income"
              dot={{ r: isMobile ? 2 : 3 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#ff7c7c"
              strokeWidth={isMobile ? 2.5 : 2}
              name="expense"
              dot={{ r: isMobile ? 2 : 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
