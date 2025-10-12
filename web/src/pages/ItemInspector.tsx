import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import { formatDate } from '@/lib/utils'

export default function ItemInspector() {
  const { data: items, isLoading } = useQuery({
    queryKey: ['plaid-items'],
    queryFn: () => fetch('/api/plaid/items').then(res => res.json()),
  })

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Item Inspector</h1>
        <p className="text-muted-foreground">Debug Plaid connections and sync status</p>
      </div>

      {items && items.length > 0 ? (
        <div className="grid gap-6">
          {items.map((item: any) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{item.institution_name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ID: {item.id}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Connection Info</h4>
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium">Plaid Item ID:</span> {item.plaid_item_id}</div>
                      <div><span className="font-medium">Connected:</span> {formatDate(item.created_at)}</div>
                      <div><span className="font-medium">Cursor:</span> {item.next_cursor || 'None'}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Data Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium">Accounts:</span> {item.account_count}</div>
                      <div><span className="font-medium">Transactions:</span> {item.transaction_count}</div>
                      {item.date_range && (
                        <div>
                          <span className="font-medium">Date Range:</span>{' '}
                          {formatDate(item.date_range.min)} → {formatDate(item.date_range.max)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No Plaid items connected yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Go to Sources and connect a bank account to see debug info here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}



















