import { DollarSign, TrendingUp, PiggyBank } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SummaryRange } from '@/lib/api'

interface TotalsTripletProps {
  data: SummaryRange | undefined
  isLoading?: boolean
}

export function TotalsTriplet({ data, isLoading }: TotalsTripletProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-16 rounded bg-gray-200"></div>
              <div className="h-4 w-4 rounded bg-gray-200"></div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 h-8 w-24 rounded bg-gray-200"></div>
              <div className="h-3 w-20 rounded bg-gray-200"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No data available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const toNum = (v: unknown, d = 0) => {
    const n = typeof v === 'string' ? Number(v) : (v as number)
    return Number.isFinite(n) ? n : d
  }

  const formatCurrency = (v: unknown) => {
    const amount = toNum(v, 0)
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount))
  }

  const formatPercent = (v?: number | null) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return '-'
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  }

  const getSavingsColor = (pctSaved: number) => {
    const pct = toNum(pctSaved, 0)
    if (pct >= 20) return 'text-green-600'
    if (pct >= 10) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPctSavedBgColor = (pctSaved: number) => {
    const pct = toNum(pctSaved, 0)
    if (pct >= 20) return 'bg-green-50 border-green-200'
    if (pct >= 10) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const income = toNum(data?.income_total, 0)
  const expenses = toNum(data?.expense_total, 0)
  const savings = toNum(data?.savings_total, 0)
  const pctSaved = toNum(data?.pct_saved, 0)
  const incomeAvg = toNum(data?.income_avg, 0)
  const expenseAvg = toNum(data?.expense_avg, 0)

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-800">Total Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-green-700 sm:text-2xl">{formatCurrency(income)}</div>
          <p className="mt-1 text-xs text-green-600">Avg: {formatCurrency(incomeAvg)}/month</p>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-800">Total Expenses</CardTitle>
          <DollarSign className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-red-700 sm:text-2xl">{formatCurrency(expenses)}</div>
          <p className="mt-1 text-xs text-red-600">Avg: {formatCurrency(expenseAvg)}/month</p>
        </CardContent>
      </Card>

      <Card className={getPctSavedBgColor(pctSaved)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${getSavingsColor(pctSaved).replace('-600', '-800')}`}>
            Net Savings
          </CardTitle>
          <PiggyBank className={`h-4 w-4 ${getSavingsColor(pctSaved)}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-xl font-bold ${getSavingsColor(pctSaved).replace('-600', '-700')} sm:text-2xl`}>
            {formatCurrency(savings)}
          </div>
          <p className={`mt-1 text-xs font-medium ${getSavingsColor(pctSaved)}`}>{formatPercent(pctSaved)} saved</p>
        </CardContent>
      </Card>
    </div>
  )
}
