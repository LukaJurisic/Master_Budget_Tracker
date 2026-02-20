import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Eye, Check, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient, UnmappedPair } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import StagingTab from '@/components/mapping/StagingTab'
import { useIsMobile } from '@/hooks/useIsMobile'

interface RuleModalProps {
  isOpen: boolean
  onClose: () => void
  merchant?: {
    merchant_norm: string
    count: number
    total_amount: number
  }
  rule?: any
}

function RuleModal({ isOpen, onClose, merchant, rule }: RuleModalProps) {
  const [formData, setFormData] = useState({
    rule_type: rule?.rule_type || 'EXACT',
    pattern: rule?.pattern || merchant?.merchant_norm || '',
    merchant_norm: rule?.merchant_norm || merchant?.merchant_norm || '',
    category_id: rule?.category_id || '',
    subcategory_id: rule?.subcategory_id || '',
    priority: rule?.priority || 0,
  })

  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  })

  const createRuleMutation = useMutation({
    mutationFn: (data: any) => apiClient.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmapped-merchants'] })
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      onClose()
    },
  })

  const updateRuleMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateRule(rule.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rule) {
      updateRuleMutation.mutate(formData)
    } else {
      createRuleMutation.mutate(formData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">
          {rule ? 'Edit Rule' : 'Create Mapping Rule'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!rule && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Rule Type</label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, rule_type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="EXACT">Exact Match</option>
                  <option value="CONTAINS">Contains</option>
                  <option value="REGEX">Regular Expression</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Pattern</label>
                <Input
                  value={formData.pattern}
                  onChange={(e) => setFormData(prev => ({ ...prev, pattern: e.target.value }))}
                  placeholder="Pattern to match"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Merchant Name</label>
                <Input
                  value={formData.merchant_norm}
                  onChange={(e) => setFormData(prev => ({ ...prev, merchant_norm: e.target.value }))}
                  placeholder="Normalized merchant name"
                  required
                />
              </div>
            </>
          )}

          {rule && (
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600 mb-1">Editing rule for:</p>
              <p className="font-medium">{rule.pattern}</p>
              {rule.desc_pattern && (
                <p className="text-sm text-gray-500">+ {rule.desc_pattern}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: parseInt(e.target.value), subcategory_id: '' }))}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">Select a category</option>
              {categories?.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subcategory</label>
            <select
              value={formData.subcategory_id}
              onChange={(e) => setFormData(prev => ({ ...prev, subcategory_id: e.target.value ? parseInt(e.target.value) : '' }))}
              className="w-full px-3 py-2 border rounded-md"
              disabled={!formData.category_id}
            >
              <option value="">Select a subcategory</option>
              {categories?.find(c => c.id === formData.category_id)?.children?.map(child => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>

          {!rule && (
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                placeholder="Priority (higher = first)"
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
            >
              {rule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MappingStudio() {
  const [searchParams] = useSearchParams()
  const { importId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'quick-assign' | 'unmapped' | 'rules' | 'staging'>(
    importId || searchParams.get('tab') === 'staging' ? 'staging' : 'quick-assign'
  )
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null)
  const [editingRule, setEditingRule] = useState<any>(null)
  const [quickAssignData, setQuickAssignData] = useState<Record<string, { category_id: string; subcategory_id: string }>>({})
  const isMobile = useIsMobile()

  // Ref for scroll container to enable proper collision boundary
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const queryClient = useQueryClient()

  // Handle URL params for import selection
  useEffect(() => {
    if (importId) {
      setActiveTab('staging')
    }
  }, [importId])

  const { data: unmappedMerchants, isLoading: unmappedLoading } = useQuery({
    queryKey: ['unmapped-merchants'],
    queryFn: () => apiClient.getUnmappedMerchants(),
  })

  const { data: unmappedPairs, isLoading: pairsLoading } = useQuery({
    queryKey: ['unmapped-pairs'],
    queryFn: () => apiClient.getUnmappedPairs(),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  })

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: () => apiClient.getRules(),
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    },
  })

  const bulkAssignMutation = useMutation({
    mutationFn: (rules: any[]) => apiClient.bulkAssignRules(rules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmapped-pairs'] })
      queryClient.invalidateQueries({ queryKey: ['unmapped-merchants'] })
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      setQuickAssignData({})
    },
  })

  const handleCreateRule = (merchant?: any) => {
    setSelectedMerchant(merchant)
    setEditingRule(null)
    setRuleModalOpen(true)
  }

  const handleEditRule = (rule: any) => {
    setEditingRule(rule)
    setSelectedMerchant(null)
    setRuleModalOpen(true)
  }

  const handleDeleteRule = (rule: any) => {
    if (confirm(`Are you sure you want to delete the rule for "${rule.pattern}"?`)) {
      deleteRuleMutation.mutate(rule.id)
    }
  }

  const handleQuickAssignChange = (pairKey: string, field: 'category_id' | 'subcategory_id', value: string) => {
    setQuickAssignData(prev => {
      const currentPairData = prev[pairKey] || {}
      
      let newPairData = {
        ...currentPairData,
        [field]: value
      }
      
      // If changing category, clear subcategory to force reselection
      if (field === 'category_id') {
        newPairData.subcategory_id = ''
      }
      
      const newData = {
        ...prev,
        [pairKey]: newPairData
      }
      return newData
    })
  }

  const handleBulkAssign = () => {
    const rules = Object.entries(quickAssignData)
      .filter(([_, data]) => data.category_id) // Only require category_id, subcategory_id is optional
      .map(([pairKey, data]) => {
        const [merchant, description] = pairKey.split('|')
        return {
          merchant_pattern: merchant,
          desc_pattern: description,
          category_id: parseInt(data.category_id),
          subcategory_id: parseInt(data.subcategory_id),
          fields: 'PAIR' as const,
          rule_type: 'EXACT' as const,
          priority: 100
        }
      })
    
    if (rules.length === 0) {
      alert('Please select categories for at least one transaction pair.')
      return
    }
    
    if (confirm(`Create ${rules.length} mapping rules?`)) {
      bulkAssignMutation.mutate(rules)
    }
  }

  const getSubcategories = (categoryId: string) => {
    const category = categories?.find(c => c.id.toString() === categoryId)
    return category?.children || []
  }

  // Helper functions for hierarchical category display (similar to StagingTab)
  const sortedCategories = categories?.sort((a, b) => a.name.localeCompare(b.name)) || [];
  const parentCategories = sortedCategories.filter(cat => !cat.parent_id);
  
  const getCategoryDisplayName = (category: any) => {
    if (category.parent_id) {
      const parent = sortedCategories.find(p => p.id === category.parent_id);
      return `${parent?.name || ''} > ${category.name}`;
    }
    return category.name;
  };

  return (
    <div className={isMobile ? 'space-y-4' : 'space-y-6'}>
      {/* Header */}
      <div className={isMobile ? 'flex flex-col gap-3' : 'flex items-center justify-between'}>
        <div>
          <h1 className={isMobile ? 'text-2xl font-bold' : 'text-3xl font-bold'}>Mapping Studio</h1>
          <p className="text-muted-foreground">
            Manage merchant categorization rules and review unmapped transactions
          </p>
        </div>
        <Button onClick={() => handleCreateRule()} className={isMobile ? 'w-full' : ''}>
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('staging')}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === 'staging'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              Staging (New Imports)
            </div>
          </button>
          <button
            onClick={() => setActiveTab('quick-assign')}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === 'quick-assign'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Quick Assign
            {unmappedPairs && (
              <span className="ml-2 bg-green-100 text-green-800 py-0.5 px-2 rounded-full text-xs">
                {unmappedPairs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('unmapped')}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === 'unmapped'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Unmapped Merchants
            {unmappedMerchants && (
              <span className="ml-2 bg-yellow-100 text-yellow-800 py-0.5 px-2 rounded-full text-xs">
                {unmappedMerchants.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === 'rules'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Mapping Rules
            {rules && (
              <span className="ml-2 bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full text-xs">
                {rules.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Quick Assign Tab */}
      {activeTab === 'quick-assign' && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Assign - Excel Style Mapping</CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign categories to unmapped transaction pairs. Use dropdowns to select category and subcategory, then confirm all assignments.
            </p>
          </CardHeader>
          <CardContent>
            {pairsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {isMobile ? (
                  <div className="space-y-3">
                    {unmappedPairs?.map((pair) => {
                      const pairKey = `${pair.merchant_norm}|${pair.description_norm}`
                      const selectedCategoryId = quickAssignData[pairKey]?.category_id || ''
                      const selectedSubcategoryId = quickAssignData[pairKey]?.subcategory_id || ''

                      return (
                        <div key={pairKey} className="rounded-lg border p-3">
                          <p className="truncate text-sm font-semibold" title={pair.description_norm}>{pair.description_norm}</p>
                          <p className="truncate text-sm text-muted-foreground" title={pair.merchant_norm}>{pair.merchant_norm}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-md bg-muted/40 p-2">
                              <p className="text-[11px] text-muted-foreground">Count</p>
                              <p className="font-semibold">{pair.count}</p>
                            </div>
                            <div className="rounded-md bg-muted/40 p-2">
                              <p className="text-[11px] text-muted-foreground">Total</p>
                              <p className="font-semibold">{formatCurrency(pair.total_amount)}</p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Select
                              value={selectedCategoryId}
                              onValueChange={(value) => {
                                if (value && value !== '') {
                                  const selectedCategory = sortedCategories.find(cat => cat.id.toString() === value);
                                  if (selectedCategory) {
                                    let categoryId: number;
                                    let subcategoryId: number | undefined;

                                    if (selectedCategory.parent_id) {
                                      categoryId = selectedCategory.parent_id;
                                      subcategoryId = selectedCategory.id;
                                    } else {
                                      categoryId = selectedCategory.id;
                                      subcategoryId = undefined;
                                    }

                                    handleQuickAssignChange(pairKey, 'category_id', categoryId.toString());
                                    if (subcategoryId) {
                                      handleQuickAssignChange(pairKey, 'subcategory_id', subcategoryId.toString());
                                    } else {
                                      handleQuickAssignChange(pairKey, 'subcategory_id', '');
                                    }
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="h-9 min-h-9 w-full">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                              <SelectContent position="popper" side="bottom" align="start" sideOffset={6} avoidCollisions className="z-50 w-[300px] max-h-[min(320px,calc(100vh-8rem))] overflow-auto">
                                {sortedCategories?.length > 0 ? (
                                  <>
                                    {parentCategories.map(parent => (
                                      <SelectItem key={parent.id} value={parent.id.toString()} className="font-medium">
                                        {parent.name}
                                      </SelectItem>
                                    ))}
                                    {sortedCategories.filter(cat => cat.parent_id).map(child => (
                                      <SelectItem key={child.id} value={child.id.toString()} className="pl-4 text-sm text-muted-foreground">
                                        {getCategoryDisplayName(child)}
                                      </SelectItem>
                                    ))}
                                  </>
                                ) : (
                                  <SelectItem value="" disabled>No categories available</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {selectedSubcategoryId
                              ? sortedCategories.find(cat => cat.id.toString() === selectedSubcategoryId)?.name || 'Auto-selected'
                              : selectedCategoryId ? 'Parent category' : 'No category selected'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Subcategory</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedPairs?.map((pair) => {
                        const pairKey = `${pair.merchant_norm}|${pair.description_norm}`
                        const selectedCategoryId = quickAssignData[pairKey]?.category_id || ''
                        const selectedSubcategoryId = quickAssignData[pairKey]?.subcategory_id || ''


                        return (
                          <TableRow key={pairKey}>
                            <TableCell>
                              <div className="font-medium text-sm max-w-xs truncate" title={pair.description_norm}>
                                {pair.description_norm}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm max-w-xs truncate" title={pair.merchant_norm}>
                                {pair.merchant_norm}
                              </div>
                            </TableCell>
                            <TableCell>{pair.count}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(pair.total_amount)}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={selectedCategoryId}
                                onValueChange={(value) => {
                                  if (value && value !== '') {
                                    // Find the selected category and determine if it's parent or child
                                    const selectedCategory = sortedCategories.find(cat => cat.id.toString() === value);
                                    if (selectedCategory) {
                                      let categoryId: number;
                                      let subcategoryId: number | undefined;

                                      if (selectedCategory.parent_id) {
                                        // This is a subcategory
                                        categoryId = selectedCategory.parent_id;
                                        subcategoryId = selectedCategory.id;
                                      } else {
                                        // This is a parent category
                                        categoryId = selectedCategory.id;
                                        subcategoryId = undefined;
                                      }

                                      // Update the state properly
                                      handleQuickAssignChange(pairKey, 'category_id', categoryId.toString());
                                      if (subcategoryId) {
                                        handleQuickAssignChange(pairKey, 'subcategory_id', subcategoryId.toString());
                                      } else {
                                        handleQuickAssignChange(pairKey, 'subcategory_id', '');
                                      }
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 min-h-8 w-full">
                                  <SelectValue placeholder="Select Category" />
                                </SelectTrigger>

                                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} avoidCollisions className="z-50 w-[300px] max-h-[min(320px,calc(100vh-8rem))] overflow-auto">
                                  {sortedCategories?.length > 0 ? (
                                    <>
                                      {/* Parent categories first */}
                                      {parentCategories.map(parent => (
                                        <SelectItem key={parent.id} value={parent.id.toString()} className="font-medium">
                                          {parent.name}
                                        </SelectItem>
                                      ))}

                                      {/* Then subcategories with hierarchy */}
                                      {sortedCategories.filter(cat => cat.parent_id).map(child => (
                                        <SelectItem key={child.id} value={child.id.toString()} className="pl-4 text-sm text-muted-foreground">
                                          {getCategoryDisplayName(child)}
                                        </SelectItem>
                                      ))}
                                    </>
                                  ) : (
                                    <SelectItem value="" disabled>No categories available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {/* Show selected subcategory name for clarity */}
                              <div className="text-sm text-muted-foreground">
                                {selectedSubcategoryId ? (
                                  sortedCategories.find(cat => cat.id.toString() === selectedSubcategoryId)?.name || 'Auto-selected'
                                ) : (
                                  selectedCategoryId ? 'Parent category' : '-'
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
                
                {unmappedPairs && unmappedPairs.length > 0 && (
                  <div className="mt-6 flex justify-end">
                    <Button 
                      onClick={handleBulkAssign}
                      disabled={bulkAssignMutation.isPending || Object.keys(quickAssignData).length === 0}
                      className={isMobile ? 'flex w-full items-center justify-center space-x-2' : 'flex items-center space-x-2'}
                    >
                      <Check className="h-4 w-4" />
                      <span>Confirm Assignments ({Object.entries(quickAssignData).filter(([_, data]) => data.category_id).length})</span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unmapped Merchants Tab */}
      {activeTab === 'unmapped' && (
        <Card>
          <CardHeader>
            <CardTitle>Unmapped Merchants</CardTitle>
            <p className="text-sm text-muted-foreground">
              Merchants that need categorization rules. Click "Create Rule" to set up automatic mapping.
            </p>
          </CardHeader>
          <CardContent>
            {unmappedLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : (
              isMobile ? (
                <div className="space-y-3">
                  {unmappedMerchants?.map((merchant) => (
                    <div key={merchant.merchant_norm} className="rounded-lg border p-3">
                      <p className="font-medium">{merchant.merchant_norm}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-[11px] text-muted-foreground">Count</p>
                          <p className="font-semibold">{merchant.count}</p>
                        </div>
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-[11px] text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatCurrency(merchant.total_amount)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(merchant.first_seen)} - {formatDate(merchant.last_seen)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleCreateRule(merchant)}
                          className="w-full"
                        >
                          Create Rule
                        </Button>
                        <Button size="sm" variant="outline" className="w-full">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmappedMerchants?.map((merchant) => (
                      <TableRow key={merchant.merchant_norm}>
                        <TableCell>
                          <div className="font-medium">{merchant.merchant_norm}</div>
                        </TableCell>
                        <TableCell>{merchant.count}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(merchant.total_amount)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(merchant.first_seen)} - {formatDate(merchant.last_seen)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleCreateRule(merchant)}
                            >
                              Create Rule
                            </Button>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Mapping Rules Tab */}
      {activeTab === 'rules' && (
        <Card>
          <CardHeader>
            <CardTitle>Mapping Rules</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rules are applied in order of priority and type (EXACT &gt; CONTAINS &gt; REGEX).
            </p>
          </CardHeader>
          <CardContent>
            {rulesLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </div>
                ))}
              </div>
            ) : (
              isMobile ? (
                <div className="space-y-3">
                  {rules?.map((rule) => (
                    <div key={rule.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          rule.rule_type === 'EXACT' ? 'bg-green-100 text-green-800' :
                          rule.rule_type === 'CONTAINS' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {rule.rule_type}
                        </span>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          rule.fields === 'MERCHANT' ? 'bg-gray-100 text-gray-800' :
                          rule.fields === 'DESCRIPTION' ? 'bg-orange-100 text-orange-800' :
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {rule.fields}
                        </span>
                        <span className="text-xs text-muted-foreground">Priority {rule.priority}</span>
                      </div>

                      <div className="mt-2">
                        <code className="rounded bg-gray-100 px-2 py-1 text-sm">{rule.pattern}</code>
                        {rule.desc_pattern && (
                          <p className="mt-1 text-xs text-muted-foreground">Desc: {rule.desc_pattern}</p>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2">
                          {rule.category?.color && (
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: rule.category.color }} />
                          )}
                          <span className="text-sm font-medium">{rule.category?.name}</span>
                        </div>
                        {rule.subcategory && (
                          <div className="flex items-center gap-2">
                            {rule.subcategory?.color && (
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.subcategory.color }} />
                            )}
                            <span className="text-sm text-muted-foreground">{rule.subcategory?.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRule(rule)}
                          className="w-full"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteRule(rule)}
                          disabled={deleteRuleMutation.isPending}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules?.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rule.rule_type === 'EXACT' ? 'bg-green-100 text-green-800' :
                              rule.rule_type === 'CONTAINS' ? 'bg-blue-100 text-blue-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {rule.rule_type}
                            </span>
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                rule.fields === 'MERCHANT' ? 'bg-gray-100 text-gray-800' :
                                rule.fields === 'DESCRIPTION' ? 'bg-orange-100 text-orange-800' :
                                'bg-indigo-100 text-indigo-800'
                              }`}>
                                {rule.fields}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                {rule.pattern}
                              </code>
                            </div>
                            {rule.desc_pattern && (
                              <div>
                                <span className="text-xs text-muted-foreground">Desc:</span>
                                <code className="text-sm bg-orange-50 px-2 py-1 rounded ml-1">
                                  {rule.desc_pattern}
                                </code>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{rule.pattern}</div>
                            {rule.desc_pattern && (
                              <div className="text-sm text-muted-foreground">
                                + {rule.desc_pattern}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              {rule.category?.color && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: rule.category.color }}
                                />
                              )}
                              <span className="font-medium">{rule.category?.name}</span>
                            </div>
                            {rule.subcategory && (
                              <div className="flex items-center space-x-2 ml-5">
                                {rule.subcategory?.color && (
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: rule.subcategory.color }}
                                  />
                                )}
                                <span className="text-sm text-muted-foreground">{rule.subcategory?.name}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditRule(rule)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteRule(rule)}
                              disabled={deleteRuleMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Staging Tab */}
      {activeTab === 'staging' && (
        <StagingTab />
      )}

      {/* Rule Modal */}
      <RuleModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        merchant={selectedMerchant}
        rule={editingRule}
      />
    </div>
  )
}
