import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, Calendar, AlertTriangle, PieChart as PieChartIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { DashboardCards } from '@/lib/api'

interface CardsRowProps {
  cards: DashboardCards
}

export function CardsRow({ cards }: CardsRowProps) {
  const income = Number.isFinite(cards.income) ? cards.income : 0
  const expenses = Number.isFinite(cards.expenses) ? cards.expenses : 0
  const netSavings = Number.isFinite(cards.net_savings) ? cards.net_savings : 0
  const totalTxns = Number.isFinite(cards.total_txns) ? cards.total_txns : 0
  const unmapped = Number.isFinite(cards.unmapped) ? cards.unmapped : 0
  const activeCategories = Number.isFinite(cards.active_categories) ? cards.active_categories : 0

  const netSavingsColor = netSavings >= 0 ? 'text-green-600' : 'text-red-600'
  
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
            {formatCurrency(income)}
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
            {formatCurrency(expenses)}
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
            {formatCurrency(netSavings)}
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
            {totalTxns.toLocaleString()}
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
            {unmapped}
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
            {activeCategories}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
