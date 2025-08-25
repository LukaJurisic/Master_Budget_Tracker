import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'

interface NetWorthData {
  totals: {
    assets: number
    liabilities: number
    net_worth: number
  }
  timestamp: string
}

export default function NetWorthCard() {
  const [data, setData] = useState<NetWorthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateStr))
  }

  useEffect(() => {
    const fetchNetWorth = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/balances')
        
        if (!response.ok) {
          throw new Error('Failed to fetch balances')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('Failed to load net worth:', err)
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    fetchNetWorth()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error || 'No data available'}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/balances">
              View Balances
              <ArrowRight className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const netWorth = data.totals.net_worth
  const isPositive = netWorth >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(netWorth)}
        </div>
        
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
            {formatCurrency(data.totals.assets)}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
            {formatCurrency(data.totals.liabilities)}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            Updated {formatDate(data.timestamp)}
          </p>
          <Button asChild variant="ghost" size="sm" className="h-auto p-0 text-xs">
            <Link to="/balances">
              View Details
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}