import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { DashboardLines } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface IncomeVsExpensesLinesProps {
  data: DashboardLines
}

export function IncomeVsExpensesLines({ data }: IncomeVsExpensesLinesProps) {
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

  console.log('Chart data first 5:', chartData.slice(0, 5))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expenses</CardTitle>
        <CardDescription>Monthly cash flow comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={12}
            />
            <YAxis tickFormatter={formatCurrency} />
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
              strokeWidth={2}
              name="income"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#ff7c7c"
              strokeWidth={2}
              name="expense"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}