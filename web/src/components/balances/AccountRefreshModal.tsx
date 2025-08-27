import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Account {
  id: number
  name: string
  official_name?: string
  mask?: string
  institution?: string
  type: 'asset' | 'liability'
  subtype?: string
  currency?: string
}

interface AccountRefreshModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AccountRefreshModal({ open, onClose, onSuccess }: AccountRefreshModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/balances/accounts')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      setAccounts(result.accounts)
      
      // Select all accounts by default
      setSelectedAccounts(new Set(result.accounts.map((acc: Account) => acc.id)))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (selectedAccounts.size === 0) {
      toast({
        title: 'No Accounts Selected',
        description: 'Please select at least one account to refresh.',
        variant: 'destructive',
      })
      return
    }

    try {
      setRefreshing(true)
      setError(null)
      
      const accountIds = Array.from(selectedAccounts)
      
      const response = await fetch('/api/balances/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_ids: accountIds }),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      toast({
        title: 'Balances Updated',
        description: `Refreshed ${result.accounts_updated} accounts successfully.`,
      })
      
      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh balances'
      setError(errorMessage)
      
      toast({
        title: 'Refresh Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const toggleAccount = (accountId: number) => {
    const newSelected = new Set(selectedAccounts)
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId)
    } else {
      newSelected.add(accountId)
    }
    setSelectedAccounts(newSelected)
  }

  const toggleAll = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set())
    } else {
      setSelectedAccounts(new Set(accounts.map(acc => acc.id)))
    }
  }

  useEffect(() => {
    if (open) {
      loadAccounts()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Accounts to Refresh</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Loading accounts...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                <Checkbox
                  id="select-all"
                  checked={selectedAccounts.size === accounts.length && accounts.length > 0}
                  onCheckedChange={toggleAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Select All ({accounts.length} accounts)
                </label>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      id={`account-${account.id}`}
                      checked={selectedAccounts.has(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{account.name}</p>
                          {account.official_name && account.official_name !== account.name && (
                            <p className="text-sm text-gray-500">{account.official_name}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{account.institution}</p>
                          <p className="text-xs text-gray-500">
                            {account.mask && `••••${account.mask}`} • {account.currency}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-sm text-gray-600">
                Selected: {selectedAccounts.size} of {accounts.length} accounts
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={refreshing}>
            Cancel
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={loading || refreshing || selectedAccounts.size === 0}
          >
            {refreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Selected ({selectedAccounts.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}