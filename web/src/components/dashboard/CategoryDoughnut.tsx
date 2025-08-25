import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { DashboardCategories } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface CategoryDoughnutProps {
  data: DashboardCategories
  effectiveMonth: string
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', 
  '#d084d0', '#ffb347', '#87ceeb', '#dda0dd', '#98fb98'
]

export function CategoryDoughnut({ data, effectiveMonth }: CategoryDoughnutProps) {
  if (!data.breakdown.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <CardDescription>Spending by category for {effectiveMonth}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No category data"
            description="No expenses found for this month"
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.breakdown.map((item, index) => ({
    name: item.category,
    value: item.amount,
    percent: item.percent,
    color: COLORS[index % COLORS.length],
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Breakdown</CardTitle>
        <CardDescription>Spending by category for {effectiveMonth}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={40}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Category: ${label}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}