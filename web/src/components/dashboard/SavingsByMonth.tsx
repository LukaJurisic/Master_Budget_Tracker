import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CartesianGrid, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { SummaryRange } from '@/lib/api'
import { EmptyState } from './EmptyState'

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

interface SavingsByMonthProps {
  data: SummaryRange | undefined
  isLoading?: boolean
}

export function SavingsByMonth({ data, isLoading }: SavingsByMonthProps) {
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

  // Accept multiple API response shapes
  const rawSavings = (data as any)?.savings_by_month ?? [];
  const series: { month: string; net_savings: number }[] = asArray(rawSavings);
  
  if (!series.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Savings by Month</CardTitle>
          <CardDescription>Monthly net savings with average line</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No savings data"
            description="No historical savings data available for the selected range"
          />
        </CardContent>
      </Card>
    )
  }

  // Calculate savings average from the series data
  const totalSavings = series.reduce((sum, point) => sum + (point.net_savings || 0), 0);
  const savingsAvg = series.length > 0 ? totalSavings / series.length : 0;

  // Convert the analytics data format to chart format
  const chartData = series.map((point) => {
    // Convert YYYY-MM to MMM YYYY format for display
    const [year, monthNum] = point.month.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`
    
    const savings = point.net_savings || 0;
    
    return {
      month: monthLabel,
      savings: savings,
      fill: savings >= 0 ? '#22c55e' : '#ef4444' // Green for positive, red for negative
    }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`Month: ${label}`}</p>
          <p className={`text-sm ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Savings: {formatCurrency(value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings by Month</CardTitle>
        <CardDescription>
          Monthly net savings with average • 
          Avg: {formatCurrency(savingsAvg)} • 
          Total: {formatCurrency(totalSavings)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 80, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={12}
            />
            <YAxis tickFormatter={formatCurrency} width={70} />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Average line in magenta */}
            <ReferenceLine 
              y={savingsAvg} 
              stroke="#d946ef" 
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ 
                value: `Avg: ${formatCurrency(savingsAvg)}`, 
                position: savingsAvg >= 0 ? "topRight" : "bottomRight"
              }}
            />
            
            {/* Zero line for reference */}
            <ReferenceLine 
              y={0} 
              stroke="#6b7280" 
              strokeWidth={1}
            />
            
            {/* Savings bars */}
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