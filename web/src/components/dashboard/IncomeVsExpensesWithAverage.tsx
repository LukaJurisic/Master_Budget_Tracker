import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { SummaryRange } from '@/lib/api'
import { EmptyState } from './EmptyState'

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

interface IncomeVsExpensesWithAverageProps {
  data: SummaryRange | undefined
  isLoading?: boolean
}

export function IncomeVsExpensesWithAverage({ data, isLoading }: IncomeVsExpensesWithAverageProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    )
  }

  // accept multiple shapes: series | lines | data.series | income_vs_expenses
  type Point = { month: string; income: number; expenses: number };
  const raw = (data as any)?.income_vs_expenses ?? 
              (data as any)?.series ?? 
              (data as any)?.lines ?? 
              (data as any)?.data?.series ?? 
              [];

  const series: Point[] = asArray<Point>(raw);
  
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

  // Convert the analytics data format to chart format
  const chartData = series.map((point) => {
    // Convert YYYY-MM to MMM YYYY format for display
    const [year, monthNum] = point.month.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`
    
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
        <CardDescription>
          Monthly cash flow with averages • 
          Avg Income: {formatCurrency((data as any)?.income_avg ?? 0)} • 
          Avg Expenses: {formatCurrency((data as any)?.expense_avg ?? 0)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 80, bottom: 70 }}>
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
              formatter={(value: number, name: string) => [
                formatCurrency(value), 
                name === 'income' ? 'Income' : 'Expenses'
              ]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            
            {/* Average lines */}
            <ReferenceLine 
              y={(data as any)?.income_avg ?? 0} 
              stroke="#22c55e" 
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: "Avg Income", position: "topRight" }}
            />
            <ReferenceLine 
              y={(data as any)?.expense_avg ?? 0} 
              stroke="#f87171" 
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: "Avg Expenses", position: "bottomRight" }}
            />
            
            {/* Income line */}
            <Line
              type="monotone"
              dataKey="income"
              stroke="#22c55e"
              strokeWidth={3}
              name="income"
              dot={{ r: 4, fill: "#22c55e" }}
              activeDot={{ r: 6, fill: "#16a34a" }}
            />
            
            {/* Expense line */}
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#f87171"
              strokeWidth={3}
              name="expense"
              dot={{ r: 4, fill: "#f87171" }}
              activeDot={{ r: 6, fill: "#ef4444" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}