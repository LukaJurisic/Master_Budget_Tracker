import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface BalanceSummaryProps {
  totals: {
    assets: number
    liabilities: number
    net_worth: number
  }
  lastUpdated?: string
}

export default function BalanceSummary({ totals, lastUpdated }: BalanceSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never'
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateStr))
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Assets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totals.assets)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Checking, Savings, Investments
          </p>
        </CardContent>
      </Card>

      {/* Liabilities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totals.liabilities)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Credit Cards, Loans
          </p>
        </CardContent>
      </Card>

      {/* Net Worth */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            totals.net_worth >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(totals.net_worth)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {formatDate(lastUpdated)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}