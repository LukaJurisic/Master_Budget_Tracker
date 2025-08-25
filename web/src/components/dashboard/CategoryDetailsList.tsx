import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { DashboardCategories } from '@/lib/api'
import { EmptyState } from './EmptyState'

interface CategoryDetailsListProps {
  data: DashboardCategories
}

export function CategoryDetailsList({ data }: CategoryDetailsListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  if (!data.category_details.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
          <CardDescription>Detailed breakdown by category</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState 
            title="No category details"
            description="No category breakdown available"
          />
        </CardContent>
      </Card>
    )
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Details</CardTitle>
        <CardDescription>Detailed breakdown by category → description</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {data.category_details.map((categoryGroup) => {
            const isExpanded = expandedCategories.has(categoryGroup.category)
            const topItems = categoryGroup.items.slice(0, 3)
            const remainingItems = categoryGroup.items.slice(3)
            const hasMore = remainingItems.length > 0

            return (
              <div key={categoryGroup.category} className="border-b pb-3 last:border-b-0">
                {/* Category Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-semibold">{categoryGroup.category}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(categoryGroup.amount)}</span>
                </div>

                {/* Top 3 Items */}
                <div className="space-y-1 ml-5">
                  {topItems.map((item, index) => (
                    <div key={`${categoryGroup.category}-${index}`} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[250px]">
                        {item.description}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}

                  {/* Expanded Items */}
                  {isExpanded && remainingItems.map((item, index) => (
                    <div key={`${categoryGroup.category}-expanded-${index}`} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[250px]">
                        {item.description}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}

                  {/* Show More/Less Button */}
                  {hasMore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategory(categoryGroup.category)}
                      className="text-xs h-6 px-2"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          +{remainingItems.length} more items
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}