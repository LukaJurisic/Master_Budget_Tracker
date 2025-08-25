import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'
import { DashboardTopMerchant } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface TopMerchantsProps {
  data: DashboardTopMerchant[]
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', 
  '#d084d0', '#ffb347', '#87ceeb', '#dda0dd', '#98fb98'
]

export function TopMerchants({ data }: TopMerchantsProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Merchants</CardTitle>
          <CardDescription>Highest spending merchants this month</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No merchant data"
            description="No merchant spending found for this month"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
        <CardDescription>Highest spending merchants this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((merchant, index) => (
            <div key={merchant.merchant} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium truncate max-w-[200px]" title={merchant.merchant}>
                  {merchant.merchant}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatCurrency(merchant.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}