import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

  // Sort by amount descending for better visualization
  const chartData = data.breakdown
    .map((item, index) => ({
      name: item.category,
      value: item.amount,
      percent: item.percent,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Breakdown</CardTitle>
        <CardDescription>Spending by category for {effectiveMonth}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              tickFormatter={(value) => formatCurrency(value)}
            />
            <YAxis 
              type="category"
              dataKey="name" 
              width={110}
              fontSize={12}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Amount']}
              labelFormatter={(label) => `${label}`}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-2 border rounded shadow-sm">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-sm">{formatCurrency(data.value)}</p>
                      <p className="text-sm text-muted-foreground">
                        {(data.percent * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}