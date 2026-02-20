import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, Calendar, AlertTriangle, PieChart as PieChartIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { DashboardCards } from '@/lib/api'

interface CardsRowProps {
  cards: DashboardCards
}

export function CardsRow({ cards }: CardsRowProps) {
  const netSavingsColor = cards.net_savings >= 0 ? 'text-green-600' : 'text-red-600'
  
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {/* Income */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Income</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(cards.income)}
          </div>
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expenses</CardTitle>
          <DollarSign className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(cards.expenses)}
          </div>
        </CardContent>
      </Card>

      {/* Net Savings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
          <TrendingUp className={`h-4 w-4 ${netSavingsColor}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${netSavingsColor}`}>
            {formatCurrency(cards.net_savings)}
          </div>
        </CardContent>
      </Card>

      {/* Total Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {cards.total_txns.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Unmapped */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unmapped</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {cards.unmapped}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categories</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {cards.active_categories}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
