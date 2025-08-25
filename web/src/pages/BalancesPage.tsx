import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import BalanceSummary from '@/components/balances/BalanceSummary'
import AccountsTable from '@/components/balances/AccountsTable'
import NetWorthCard from '@/components/dashboard/NetWorthCard'

interface BalancesData {
  accounts: Array<{
    id: number
    name: string
    official_name?: string
    mask?: string
    institution?: string
    type: 'asset' | 'liability'
    subtype?: string
    currency?: string
    available?: number | null
    current: number
    limit?: number | null
    last_updated: string
  }>
  totals: {
    assets: number
    liabilities: number
    net_worth: number
  }
  timestamp: string
}

export default function BalancesPage() {
  const [data, setData] = useState<BalancesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadBalances = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/balances')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load balances'
      setError(errorMessage)
      console.error('Failed to load balances:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshBalances = async () => {
    try {
      setRefreshing(true)
      setError(null)
      
      const response = await fetch('/api/balances/refresh', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      toast({
        title: 'Balances Updated',
        description: `Refreshed ${result.accounts_updated} accounts successfully.`,
      })
      
      // Reload the balances to get the latest data
      await loadBalances()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh balances'
      setError(errorMessage)
      
      toast({
        title: 'Refresh Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      
      console.error('Failed to refresh balances:', err)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadBalances()
  }, [])

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Account Balances</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Loading balances...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Account Balances</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Failed to load balances</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <Button 
              onClick={loadBalances} 
              className="mt-4"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Account Balances</h1>
        <Button
          onClick={refreshBalances}
          disabled={refreshing}
          size="sm"
        >
          {refreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Balances
            </>
          )}
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Summary */}
      {data && (
        <>
          <BalanceSummary totals={data.totals} lastUpdated={data.timestamp} />

          {/* Additional Cards Row */}
          <div className="grid gap-6 md:grid-cols-4">
            <div className="md:col-span-3">
              {/* This space can be used for additional metrics later */}
            </div>
            <div className="md:col-span-1">
              <NetWorthCard />
            </div>
          </div>

          {/* Accounts Table */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountsTable accounts={data.accounts} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}