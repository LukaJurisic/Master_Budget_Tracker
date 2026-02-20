import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiClient } from '@/lib/api'
import { formatCurrency, formatMonth, getCurrentMonth, getVarianceColor } from '@/lib/utils'

interface BudgetModalProps {
  isOpen: boolean
  onClose: () => void
  budget?: any
  selectedMonth: string
}

function BudgetModal({ isOpen, onClose, budget, selectedMonth }: BudgetModalProps) {
  const [formData, setFormData] = useState({
    category_id: budget?.category_id || '',
    month: budget?.month || selectedMonth,
    amount: budget?.amount || '',
  })

  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  })

  const createBudgetMutation = useMutation({
    mutationFn: (data: any) => apiClient.createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      onClose()
    },
  })

  const updateBudgetMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateBudget(budget.id, { amount: parseFloat(data.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      category_id: parseInt(formData.category_id),
      amount: parseFloat(formData.amount),
    }

    if (budget) {
      updateBudgetMutation.mutate(data)
    } else {
      createBudgetMutation.mutate(data)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">
          {budget ? 'Edit Budget' : 'Create Budget'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Month</label>
            <Input
              type="month"
              value={formData.month}
              onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              required
              disabled={!!budget} // Can't change category when editing
            >
              <option value="">Select a category</option>
              {categories?.map(category => (
                <optgroup key={category.id} label={category.name}>
                  {category.children?.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
            >
              {budget ? 'Update Budget' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Budgets() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<any>(null)

  const queryClient = useQueryClient()

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', selectedMonth],
    queryFn: () => apiClient.getBudgets(selectedMonth),
  })

  const { data: summary } = useQuery({
    queryKey: ['summary', selectedMonth],
    queryFn: () => apiClient.getSummary(selectedMonth),
  })

  const deleteBudgetMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })

  const handleCreateBudget = () => {
    setEditingBudget(null)
    setBudgetModalOpen(true)
  }

  const handleEditBudget = (budget: any) => {
    setEditingBudget(budget)
    setBudgetModalOpen(true)
  }

  const handleDeleteBudget = (budget: any) => {
    if (confirm(`Are you sure you want to delete the budget for ${budget.category?.name}?`)) {
      deleteBudgetMutation.mutate(budget.id)
    }
  }

  const budgetVsActual = summary?.budget_vs_actual
  const totalBudget = budgetVsActual?.total_budget || 0
  const totalActual = budgetVsActual?.total_actual || 0
  const totalVariance = budgetVsActual?.total_variance || 0
  const variancePercent = budgetVsActual?.total_variance_percent || 0
  const budgetItems = budgetVsActual?.budget_items || []
  const budgetsWithoutSpending =
    budgets?.filter((budget) => !budgetItems.some((item) => item.category.id === budget.category_id)) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">
            Set and track monthly spending targets by category
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg w-full sm:w-auto"
          />
          <Button onClick={handleCreateBudget} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Budget
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            <p className="text-xs text-muted-foreground">
              For {formatMonth(selectedMonth)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
            <p className="text-xs text-muted-foreground">
              Current month spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            {totalVariance > 0 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getVarianceColor(totalVariance)}`}>
              {variancePercent.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Math.abs(totalVariance))} 
              {totalVariance > 0 ? ' over' : ' under'} budget
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Import/Export */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Import budgets from Excel or export current budgets
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-4">
            <Button variant="outline" className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Import from Excel
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              Export to Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Budget vs actual spending for {formatMonth(selectedMonth)}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {budgetItems.map((item) => {
                  const linkedBudget = budgets?.find((b) => b.category_id === item.category.id)
                  const progressPct = item.budget_amount > 0 ? (item.actual_amount / item.budget_amount) * 100 : 0
                  return (
                    <Card key={item.category.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {item.category.color && (
                                <div
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: item.category.color }}
                                />
                              )}
                              <p className="truncate font-medium">{item.category.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {Math.min(progressPct, 100).toFixed(0)}% used
                            </p>
                          </div>
                          <span className={`text-sm font-semibold ${getVarianceColor(item.variance)}`}>
                            {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md bg-gray-50 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Budget</p>
                            <p className="font-medium">{formatCurrency(item.budget_amount)}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Actual</p>
                            <p className="font-medium">{formatCurrency(item.actual_amount)}</p>
                          </div>
                        </div>

                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full ${item.is_over_budget ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(progressPct, 100)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => linkedBudget && handleEditBudget(linkedBudget)}
                            disabled={!linkedBudget}
                          >
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => linkedBudget && handleDeleteBudget(linkedBudget)}
                            disabled={!linkedBudget}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {budgetsWithoutSpending.map((budget) => (
                  <Card key={budget.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {budget.category?.color && (
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: budget.category.color }}
                              />
                            )}
                            <p className="truncate font-medium">{budget.category?.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">0% used</p>
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          -{formatCurrency(budget.amount)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-gray-50 p-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">Budget</p>
                          <p className="font-medium">{formatCurrency(budget.amount)}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 p-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">Actual</p>
                          <p className="font-medium">{formatCurrency(0)}</p>
                        </div>
                      </div>

                      <div className="h-2 w-full rounded-full bg-gray-200" />

                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditBudget(budget)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteBudget(budget)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {budgetItems.length === 0 && budgetsWithoutSpending.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No budgets found for this month.
                  </div>
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {budgetItems.map((item) => {
                    const progressPct = item.budget_amount > 0 ? (item.actual_amount / item.budget_amount) * 100 : 0
                    return (
                      <TableRow key={item.category.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {item.category.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.category.color }}
                              />
                            )}
                            <span className="font-medium">{item.category.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.budget_amount)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.actual_amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className={getVarianceColor(item.variance)}>
                              {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                            </span>
                            <span className={`text-sm ${getVarianceColor(item.variance)}`}>
                              ({item.variance_percent.toFixed(1)}%)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${item.is_over_budget ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(progressPct, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {Math.min(progressPct, 100).toFixed(0)}% used
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditBudget(budgets?.find((b) => b.category_id === item.category.id))}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteBudget(budgets?.find((b) => b.category_id === item.category.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  
                  {/* Show budgets without spending */}
                  {budgetsWithoutSpending.map((budget) => (
                    <TableRow key={budget.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {budget.category?.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: budget.category.color }}
                            />
                          )}
                          <span className="font-medium">{budget.category?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(budget.amount)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(0)}
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600">
                          -{formatCurrency(budget.amount)} (-100%)
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full bg-green-500" style={{ width: '0%' }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">0% used</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditBudget(budget)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteBudget(budget)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Budget Modal */}
      <BudgetModal
        isOpen={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        budget={editingBudget}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}





















