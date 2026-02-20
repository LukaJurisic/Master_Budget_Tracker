import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CreditCard, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { EmptyState } from './EmptyState'
import { apiClient } from '@/lib/api'
import { useIsMobile } from '@/hooks/useIsMobile'

interface RecurringSubscriptionsProps {
  dateFrom?: string
  dateTo?: string
}

export function RecurringSubscriptions({ dateFrom, dateTo }: RecurringSubscriptionsProps) {
  const isMobile = useIsMobile()

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-recurring-subscriptions', dateFrom, dateTo],
    queryFn: () => apiClient.getRecurringSubscriptions(dateFrom, dateTo),
    staleTime: 5 * 60 * 1000,
  })

  const recurringSubscriptions = data?.subscriptions || []
  const summary = data?.summary || { count: 0, total_monthly: 0, total_all_time: 0 }

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
          <div className="space-y-2 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-gray-200" />
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
        <CardDescription>Monthly services, memberships, and recurring charges (3+ consecutive months)</CardDescription>
      </CardHeader>
      <CardContent>
        {recurringSubscriptions.length === 0 ? (
          <EmptyState
            title="No recurring subscriptions detected"
            description="No regular monthly charges were found in your transaction history"
          />
        ) : (
          <>
            {isMobile ? (
              <div className="space-y-3">
                {recurringSubscriptions.map((sub, index) => {
                  const isFirstOldSubscription =
                    index > 0 &&
                    sub.is_current === false &&
                    recurringSubscriptions[index - 1]?.is_current === true

                  return (
                    <div key={`${sub.merchant}-${sub.monthly_amount}-${index}`} className="space-y-2">
                      {isFirstOldSubscription && (
                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                          Previous Subscriptions (No Longer Active)
                        </div>
                      )}
                      <div className={`rounded-lg border p-3 ${sub.is_current === false ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{sub.merchant}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(sub.first_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              {' - '}
                              {new Date(sub.last_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          {sub.category ? (
                            <Badge variant="secondary" className="text-xs">
                              {sub.category}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md bg-gray-50 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Monthly</p>
                            <p className="font-semibold">{formatCurrency(sub.monthly_amount)}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Total Charged</p>
                            <p className="font-semibold">{formatCurrency(sub.total_charged)}</p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{sub.months_count} months</span>
                          {sub.price_changes && sub.price_changes.length > 1 ? (
                            <span className="truncate">
                              Price evolution: {sub.price_changes.map((price) => formatCurrency(price)).join(' -> ')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
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
                      const isFirstOldSubscription =
                        index > 0 &&
                        sub.is_current === false &&
                        recurringSubscriptions[index - 1]?.is_current === true

                      return (
                        <React.Fragment key={`subscription-group-${index}`}>
                          {isFirstOldSubscription && (
                            <tr>
                              <td colSpan={6} className="h-8 bg-muted/30">
                                <div className="flex items-center justify-center border-t border-border text-sm font-medium text-muted-foreground">
                                  <div className="rounded-md border bg-background px-4 py-2">
                                    Previous Subscriptions (No Longer Active)
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          <TableRow className={sub.is_current === false ? 'opacity-60' : ''}>
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
                                <span className="font-semibold">{formatCurrency(sub.monthly_amount)}</span>
                                {sub.price_changes && sub.price_changes.length > 1 ? (
                                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <TrendingUp className="h-3 w-3" />
                                    <span>Price evolution: {sub.price_changes.map((price) => formatCurrency(price)).join(' -> ')}</span>
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{sub.months_count} months</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">{formatCurrency(sub.total_charged)}</TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {new Date(sub.first_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              {' - '}
                              {new Date(sub.last_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-4 text-sm sm:flex sm:justify-between">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{summary.count} recurring subscriptions</span>
                <span className="text-muted-foreground">Active monthly services</span>
              </div>
              <div className="flex flex-col text-left sm:text-right">
                <span className="font-medium text-foreground">{formatCurrency(summary.total_monthly)}/month</span>
                <span className="text-muted-foreground">Current monthly cost</span>
              </div>
              <div className="flex flex-col text-left sm:text-right">
                <span className="font-medium text-foreground">{formatCurrency(summary.total_all_time)}</span>
                <span className="text-muted-foreground">Total all-time spent</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
