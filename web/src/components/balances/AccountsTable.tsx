import { useState } from 'react'
import { ArrowUpDown, Building2, CreditCard } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'

interface Account {
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
}

interface AccountsTableProps {
  accounts: Account[]
}

export default function AccountsTable({ accounts }: AccountsTableProps) {
  const [sortField, setSortField] = useState<keyof Account>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const formatCurrency = (amount: number | null, currency = 'CAD') => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency || 'CAD'
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateStr))
  }

  const handleSort = (field: keyof Account) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedAccounts = [...accounts].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    
    let comparison = 0
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal)
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    }
    
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const getAccountIcon = (type: string, subtype?: string) => {
    if (type === 'liability' || subtype?.includes('credit')) {
      return <CreditCard className="h-4 w-4" />
    }
    return <Building2 className="h-4 w-4" />
  }

  const getTypeColor = (type: string) => {
    return type === 'asset' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Connect your bank accounts to see balances here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('name')}
                className="h-auto p-0 font-semibold"
              >
                Account
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('institution')}
                className="h-auto p-0 font-semibold"
              >
                Institution
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('type')}
                className="h-auto p-0 font-semibold"
              >
                Type
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                onClick={() => handleSort('available')}
                className="h-auto p-0 font-semibold"
              >
                Available
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                onClick={() => handleSort('current')}
                className="h-auto p-0 font-semibold"
              >
                Current
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">Limit</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('last_updated')}
                className="h-auto p-0 font-semibold"
              >
                Updated
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAccounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  {getAccountIcon(account.type, account.subtype)}
                  <div>
                    <div className="font-semibold">{account.name}</div>
                    {account.official_name && account.official_name !== account.name && (
                      <div className="text-sm text-gray-500">{account.official_name}</div>
                    )}
                    {account.mask && (
                      <div className="text-sm text-gray-500">•••• {account.mask}</div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>{account.institution || 'Unknown'}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge className={getTypeColor(account.type)}>
                    {account.type}
                  </Badge>
                  {account.subtype && (
                    <div className="text-sm text-gray-500 capitalize">
                      {account.subtype.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(account.available, account.currency)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(account.current, account.currency)}
              </TableCell>
              <TableCell className="text-right">
                {account.limit ? formatCurrency(account.limit, account.currency) : '-'}
              </TableCell>
              <TableCell>
                <div className="text-sm">{formatDate(account.last_updated)}</div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}