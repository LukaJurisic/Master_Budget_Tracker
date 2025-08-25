import { AlertCircle } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
}

export function EmptyState({ 
  title = "No data available", 
  description = "There's no data to display for this period." 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}