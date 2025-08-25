import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CreditCard, TrendingUp, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { EmptyState } from './EmptyState'
import { apiClient } from '@/lib/api'

interface RecurringSubscription {
  merchant: string
  monthly_amount: number
  months_count: number
  total_charged: number
  first_date: string
  last_date: string
  category?: string
  price_changes?: number[]
  is_current?: boolean
}

interface RecurringSubscriptionsProps {
  dateFrom?: string
  dateTo?: string
}

export function RecurringSubscriptions({ dateFrom, dateTo }: RecurringSubscriptionsProps) {
  // Fetch recurring subscriptions from the smart backend endpoint
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-recurring-subscriptions', dateFrom, dateTo],
    queryFn: () => apiClient.getRecurringSubscriptions(dateFrom, dateTo),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const recurringSubscriptions = data?.subscriptions || []
  const summary = data?.summary || { 
    count: 0, 
    total_monthly: 0, 
    total_all_time: 0 
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Recurring Subscriptions
          </CardTitle>
          <CardDescription>Analyzing your transactions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Recurring Subscriptions
          </CardTitle>
          <CardDescription>Failed to load subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Error: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Recurring Subscriptions
        </CardTitle>
        <CardDescription>
          Monthly services, memberships, and recurring charges (3+ consecutive months)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recurringSubscriptions.length === 0 ? (
          <EmptyState 
            title="No recurring subscriptions detected"
            description="No regular monthly charges were found in your transaction history"
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Monthly Fee</TableHead>
                    <TableHead className="text-center">Months</TableHead>
                    <TableHead className="text-right">Total Charged</TableHead>
                    <TableHead className="text-center">Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringSubscriptions.map((sub, index) => {
                    const isFirstOldSubscription = index > 0 && 
                      sub.is_current === false && 
                      recurringSubscriptions[index - 1]?.is_current === true;
                    
                    return (
                      <React.Fragment key={`subscription-group-${index}`}>
                        {isFirstOldSubscription && (
                          <tr key={`separator-${index}`}>
                            <td colSpan={6} className="h-8 bg-muted/30">
                              <div className="flex items-center justify-center text-sm font-medium text-muted-foreground border-t border-border">
                                <div className="px-4 py-2 bg-background rounded-md border">
                                  Previous Subscriptions (No Longer Active)
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        <TableRow 
                          key={`${sub.merchant}-${sub.monthly_amount}-${index}`}
                          className={sub.is_current === false ? "opacity-60" : ""}
                        >
                          <TableCell className="font-medium">{sub.merchant}</TableCell>
                          <TableCell>
                            {sub.category ? (
                              <Badge variant="secondary" className="text-xs">
                                {sub.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <div className="flex flex-col items-end">
                              <span className="font-semibold">
                                {formatCurrency(sub.monthly_amount)}
                              </span>
                              {sub.price_changes && sub.price_changes.length > 1 && (
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  <span>Price evolution: {sub.price_changes.map(price => formatCurrency(price)).join(' → ')}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {sub.months_count} months
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono">
                            {formatCurrency(sub.total_charged)}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {new Date(sub.first_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            {' - '}
                            {new Date(sub.last_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Summary stats */}
            <div className="mt-4 flex justify-between text-sm border-t pt-4">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{summary.count} recurring subscriptions</span>
                <span className="text-muted-foreground">Active monthly services</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-medium text-foreground">
                  {formatCurrency(summary.total_monthly)}/month
                </span>
                <span className="text-muted-foreground">Current monthly cost</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-medium text-foreground">
                  {formatCurrency(summary.total_all_time)}
                </span>
                <span className="text-muted-foreground">Total all-time spent</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}