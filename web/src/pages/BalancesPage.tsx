import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, Plus, Bitcoin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import BalanceSummary from '@/components/balances/BalanceSummary'
import AccountsTable from '@/components/balances/AccountsTable'
import NetWorthCard from '@/components/dashboard/NetWorthCard'
import NDAXConnectModal from '@/components/integrations/NDAXConnectModal'
import AccountRefreshModal from '@/components/balances/AccountRefreshModal'

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
  const [ndaxModalOpen, setNdaxModalOpen] = useState(false)
  const [ndaxData, setNdaxData] = useState<any | null>(null)
  const [ndaxRefreshing, setNdaxRefreshing] = useState(false)
  const [refreshModalOpen, setRefreshModalOpen] = useState(false)
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

  const loadNdaxBalances = async () => {
    try {
      const response = await fetch('/api/integrations/ndax/balances')
      
      if (response.ok) {
        const result = await response.json()
        setNdaxData(result)
      }
    } catch (err) {
      console.error('Failed to load NDAX balances:', err)
    }
  }

  const refreshNdaxBalances = async () => {
    try {
      setNdaxRefreshing(true)
      
      const response = await fetch('/api/integrations/ndax/refresh', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      toast({
        title: 'NDAX Balances Updated',
        description: `Refreshed ${result.totals?.assets_count || 0} crypto assets.`,
      })
      
      await loadNdaxBalances()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh NDAX balances'
      
      toast({
        title: 'Refresh Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setNdaxRefreshing(false)
    }
  }

  useEffect(() => {
    loadBalances()
    loadNdaxBalances()
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
        <div className="flex gap-2">
          <Button
            onClick={() => setNdaxModalOpen(true)}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Connect Exchange
          </Button>
          <Button
            onClick={() => setRefreshModalOpen(true)}
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

          {/* NDAX Balances Section */}
          {ndaxData && ndaxData.balances && ndaxData.balances.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bitcoin className="h-5 w-5" />
                    NDAX Exchange
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {ndaxData.timestamp ? new Date(ndaxData.timestamp).toLocaleString() : 'Never'}
                  </p>
                </div>
                <Button
                  onClick={refreshNdaxBalances}
                  disabled={ndaxRefreshing}
                  size="sm"
                  variant="outline"
                >
                  {ndaxRefreshing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* NDAX Summary */}
                  <div className="rounded-lg border p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Value (CAD)</span>
                      <span className="text-lg font-bold">
                        ${ndaxData.totals?.total_value_cad?.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </div>
                  </div>

                  {/* NDAX Assets Table */}
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Asset</th>
                          <th className="text-right p-3">Available</th>
                          <th className="text-right p-3">Total</th>
                          <th className="text-right p-3">Value (CAD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ndaxData.balances.map((balance: any, index: number) => (
                          <tr key={index} className="border-b">
                            <td className="p-3 font-medium">{balance.currency || balance.name}</td>
                            <td className="text-right p-3">{balance.available?.toFixed(8) || '0'}</td>
                            <td className="text-right p-3">{balance.total?.toFixed(8) || '0'}</td>
                            <td className="text-right p-3">
                              {balance.value_cad ? 
                                `$${balance.value_cad.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                : '-'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* NDAX Connect Modal */}
      <NDAXConnectModal
        open={ndaxModalOpen}
        onClose={() => setNdaxModalOpen(false)}
        onSuccess={() => {
          loadNdaxBalances()
          loadBalances()
        }}
      />
      
      {/* Account Refresh Modal */}
      <AccountRefreshModal
        open={refreshModalOpen}
        onClose={() => setRefreshModalOpen(false)}
        onSuccess={() => {
          loadBalances()
        }}
      />
    </div>
  )
}