import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Check, X, AlertCircle, ArrowUpRight, Filter, 
  CheckCircle2, XCircle, Clock, Copy, Eye, Trash2, Plus 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { formatISODate, sortByDateDesc } from '@/utils/date';

interface StagingTransaction {
  id: number;
  plaid_transaction_id: string;
  date: string;
  authorized_date?: string;
  name: string;
  merchant_name: string;
  amount: number;
  currency: string;
  account_id: number;
  account_name: string;
  status: string;
  exclude_reason?: string;
  suggested_category_id?: number;
  suggested_subcategory_id?: number;
  suggested_category_name?: string;
  suggested_subcategory_name?: string;
  pf_category_primary?: string;
  pf_category_detailed?: string;
}

interface StagingResponse {
  transactions: StagingTransaction[];
  aggregates: {
    total: number;
    by_status: Record<string, number>;
  };
}

const statusConfig = {
  needs_category: { label: 'Needs Category', color: 'yellow', icon: AlertCircle },
  ready: { label: 'Ready', color: 'green', icon: CheckCircle2 },
  approved: { label: 'Approved', color: 'blue', icon: Check },
  excluded: { label: 'Excluded', color: 'gray', icon: XCircle },
  duplicate: { label: 'Duplicate', color: 'orange', icon: Copy },
  superseded: { label: 'Superseded', color: 'purple', icon: Clock }
};

export default function StagingTab() {
  const [searchParams] = useSearchParams();
  const { importId: urlImportId } = useParams();
  const importId = urlImportId || searchParams.get('import');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [mappedFilter, setMappedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<StagingTransaction | null>(null);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState<Record<number, string>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<Record<number, boolean>>({});
  
  // Ref for scroll container
  const scrollRef = useRef<HTMLDivElement | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Clear any stale staging cache on mount to prevent cross-import data issues
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['staging'] });
  }, [queryClient]);

  // Fetch imports list
  const { data: imports } = useQuery({
    queryKey: ['plaid-imports'],
    queryFn: async () => {
      const response = await fetch('/api/plaid/imports');
      return response.json();
    }
  });

  // Fetch staging transactions with proper caching and date sorting
  const { data: stagingData, isLoading } = useQuery<StagingResponse>({
    queryKey: ['staging', String(importId), statusFilter, mappedFilter, searchQuery],
    queryFn: async () => {
      if (!importId) return { transactions: [], aggregates: { total: 0, by_status: {} } };
      
      const params = new URLSearchParams();
      if (statusFilter.length > 0) {
        statusFilter.forEach(s => params.append('status', s));
      }
      if (mappedFilter !== 'all') {
        params.append('mapped_state', mappedFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      // Add cache-busting timestamp and ensure no caching
      params.append('t', Date.now().toString());
      
      const response = await fetch(`/api/plaid/imports/${importId}/staging?${params}`);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      
      // Sort transactions by date descending (newest first) using lexicographic sort
      if (data.transactions) {
        data.transactions = sortByDateDesc(data.transactions, 'date');
      }
      
      return data;
    },
    enabled: !!importId,
    staleTime: 0,
    gcTime: 0, // Prevent caching stale data
    refetchOnWindowFocus: true
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories()
  });

  // Sort categories alphabetically and separate parent/child
  const sortedCategories = categories?.sort((a, b) => a.name.localeCompare(b.name)) || [];
  
  // Get parent categories for hierarchical display
  const parentCategories = sortedCategories.filter(cat => !cat.parent_id);
  
  // Helper to get display name with hierarchy
  const getCategoryDisplayName = (category: any) => {
    if (category.parent_id) {
      const parent = sortedCategories.find(p => p.id === category.parent_id);
      return `${parent?.name || ''} > ${category.name}`;
    }
    return category.name;
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (rowIds: number[]) => {
      const response = await fetch(`/api/plaid/imports/${importId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_ids: rowIds })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] });
      setSelectedRows(new Set());
      toast({ title: 'Transactions approved' });
    }
  });

  // Bulk categorize mutation
  const bulkCategorizeMutation = useMutation({
    mutationFn: async ({ ids, categoryId, subcategoryId }: any) => {
      const response = await fetch('/api/plaid/staging/bulk-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staging_ids: ids,
          category_id: categoryId,
          subcategory_id: subcategoryId
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] });
      setSelectedRows(new Set());
      toast({ title: 'Categories updated' });
    }
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: async (params?: { rowIds?: number[], statuses?: string[] }) => {
      const payload: any = {};
      if (params?.rowIds) {
        payload.row_ids = params.rowIds;
      }
      if (params?.statuses) {
        payload.statuses = params.statuses;
      }
      
      console.log('Sending commit payload:', payload);
      const response = await fetch(`/api/plaid/imports/${importId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log('Commit response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data?.detail || `Request failed with status ${response.status}`);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staging'] });
      
      // Show flashing success message based on result
      if (data.inserted === 0 && data.skipped_duplicates > 0) {
        toast({
          title: '⚠️ No New Transactions',
          description: `All ${data.skipped_duplicates} transactions already exist in the main table`,
          duration: 4000
        });
      } else if (data.inserted > 0) {
        toast({
          title: '✅ Transactions Committed Successfully!',
          description: `${data.inserted} transactions pushed to main table${data.skipped_duplicates > 0 ? `, ${data.skipped_duplicates} duplicates skipped` : ''}`,
          duration: 5000,
          className: 'border-green-500 bg-green-50 text-green-900'
        });
      } else {
        toast({
          title: 'ℹ️ No Transactions to Import',
          description: 'No eligible transactions found',
          duration: 3000
        });
      }
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (stagingId: number) => {
      const response = await fetch(`/api/plaid/staging/${stagingId}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] });
      toast({ title: 'Transaction deleted' });
    }
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/plaid/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      return response.json();
    },
    onSuccess: (data, name) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ 
        title: 'Category created',
        description: `Category "${data.name}" created successfully`
      });
    }
  });

  // Update category mutation - auto-save when category is selected
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ stagingId, categoryId, subcategoryId }: { 
      stagingId: number; 
      categoryId: number; 
      subcategoryId?: number 
    }) => {
      const body = {
        category_id: categoryId,
        subcategory_id: subcategoryId
      };
      
      const response = await fetch(`/api/plaid/staging/${stagingId}/category`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Failed to update category: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] });
      toast({ 
        title: 'Category saved',
        description: 'Transaction category updated'
      });
    },
    onError: (error) => {
      console.error('Failed to update category:', error);
      toast({ 
        title: 'Error',
        description: 'Failed to save category. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleSelectAll = () => {
    if (selectedRows.size === stagingData?.transactions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(stagingData?.transactions.map(t => t.id) || []));
    }
  };

  const handleSelectRow = (id: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };


  const handleCreateNewCategory = async (txId: number) => {
    const name = newCategoryName[txId]?.trim();
    if (!name) return;

    try {
      const result = await createCategoryMutation.mutateAsync(name);
      // Auto-save the newly created category to the transaction
      await updateCategoryMutation.mutateAsync({
        stagingId: txId,
        categoryId: result.id,
        subcategoryId: undefined
      });
      // Clear the input and hide it
      setNewCategoryName(prev => ({ ...prev, [txId]: '' }));
      setShowNewCategoryInput(prev => ({ ...prev, [txId]: false }));
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, color: 'gray' };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.color === 'green' ? 'default' : 'secondary'} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!importId) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Select an import to view staging transactions</p>
        {imports && imports.length > 0 && (
          <div className="mt-4">
            <Select onValueChange={(value) => window.location.href = `/mapping/${value}`}>
              <SelectTrigger className="w-96 mx-auto">
                <SelectValue placeholder="Select an import" />
              </SelectTrigger>
              <SelectContent>
                {imports.map((imp: any) => {
                  const totalTxns = imp.summary?.total || 0;
                  const needsCategory = imp.summary?.needs_category || 0;
                  const ready = imp.summary?.ready || 0;
                  const excluded = imp.summary?.excluded || 0;
                  
                  return (
                    <SelectItem key={imp.id} value={imp.id.toString()}>
                      Import #{imp.id} — {new Date(imp.created_at).toLocaleDateString()} — {totalTxns > 0 ? `${totalTxns} txns (${needsCategory} need category, ${ready} ready, ${excluded} excluded)` : 'No transactions'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Staging - New Imports</h2>
          <div className="flex gap-4 mt-2">
            {stagingData?.aggregates.by_status && Object.entries(stagingData.aggregates.by_status).map(([status, count]) => (
              <div key={status} className="text-sm">
                {getStatusBadge(status)} <span className="ml-1 font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          {selectedRows.size > 0 && (
            <Button variant="outline" onClick={() => approveMutation.mutate(Array.from(selectedRows))}>
              <Check className="mr-2 h-4 w-4" />
              Approve Selected ({selectedRows.size})
            </Button>
          )}
          <Button 
            onClick={() => {
              const selectedIds = Array.from(selectedRows);
              if (selectedIds.length > 0) {
                // Push selected rows
                commitMutation.mutate({ rowIds: selectedIds });
              } else {
                // No selection - confirm pushing all ready+approved
                const readyCount = stagingData?.aggregates.by_status?.ready || 0;
                const approvedCount = stagingData?.aggregates.by_status?.approved || 0;
                const totalPushable = readyCount + approvedCount;
                
                if (totalPushable > 0) {
                  const confirmed = confirm(`No rows selected. Push all ${totalPushable} Ready + Approved transactions?`);
                  if (confirmed) {
                    commitMutation.mutate({ statuses: ['ready', 'approved'] });
                  }
                } else {
                  alert('No transactions available to push (need Ready or Approved status)');
                }
              }
            }}
            disabled={!stagingData?.aggregates.by_status?.ready && !stagingData?.aggregates.by_status?.approved}
          >
            <ArrowUpRight className="mr-2 h-4 w-4" />
            {selectedRows.size > 0 ? `Push Selected (${selectedRows.size})` : 'Push to Transactions'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex gap-2">
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={statusFilter.includes(key) ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (statusFilter.includes(key)) {
                  setStatusFilter(statusFilter.filter(s => s !== key));
                } else {
                  setStatusFilter([...statusFilter, key]);
                }
              }}
            >
              {config.label}
            </Button>
          ))}
        </div>
        
        <Select value={mappedFilter} onValueChange={setMappedFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
          </SelectContent>
        </Select>
        
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Transactions Table */}
      <div ref={scrollRef} className="border rounded-lg overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.size === stagingData?.transactions.length && stagingData?.transactions.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : stagingData?.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              stagingData?.transactions.map((tx) => (
                <TableRow key={tx.id} className={tx.status === 'excluded' ? 'opacity-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(tx.id)}
                      onCheckedChange={() => handleSelectRow(tx.id)}
                      disabled={tx.status === 'duplicate' || tx.status === 'superseded'}
                    />
                  </TableCell>
                  <TableCell 
                    title={tx.authorized_date ? `Purchase: ${formatISODate(tx.authorized_date)}, Posted: ${formatISODate(tx.date)}` : `Posted: ${formatISODate(tx.date)}`}
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{formatISODate(tx.authorized_date || tx.date)}</div>
                      {tx.authorized_date && tx.authorized_date !== tx.date && (
                        <div className="text-xs text-muted-foreground">Posted: {formatISODate(tx.date)}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={tx.name}>
                    {tx.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={tx.merchant_name}>
                    {tx.merchant_name || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className={tx.amount < 0 ? "text-green-600" : ""}>
                      {formatCurrency(Math.abs(tx.amount))}
                      {tx.amount < 0 && " (refund)"}
                    </span>
                  </TableCell>
                  <TableCell>{tx.account_name}</TableCell>
                  <TableCell>
                    {tx.status !== 'duplicate' && tx.status !== 'superseded' ? (
                      <div className="space-y-2">
                        {showNewCategoryInput[tx.id] ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="New category name"
                              value={newCategoryName[tx.id] || ''}
                              onChange={(e) => setNewCategoryName(prev => ({ ...prev, [tx.id]: e.target.value }))}
                              className="w-32"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateNewCategory(tx.id);
                                if (e.key === 'Escape') setShowNewCategoryInput(prev => ({ ...prev, [tx.id]: false }));
                              }}
                            />
                            <Button size="sm" onClick={() => handleCreateNewCategory(tx.id)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowNewCategoryInput(prev => ({ ...prev, [tx.id]: false }))}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Select
                              value={tx.suggested_category_id?.toString() || ''}
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
                                    
                                    // Auto-save the category selection to the database
                                    updateCategoryMutation.mutate({
                                      stagingId: tx.id,
                                      categoryId: categoryId,
                                      subcategoryId: subcategoryId
                                    });
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 min-h-8 w-32">
                                <SelectValue placeholder="Select">
                                  {tx.suggested_category_name || 'Select'}
                                </SelectValue>
                              </SelectTrigger>
                              
                              <SelectContent 
                                position="popper"
                                side="bottom"
                                align="start"
                                sideOffset={6}
                                avoidCollisions
                                collisionPadding={8}
                                className="z-50 w-[300px] max-h-[min(320px,calc(100vh-8rem))] overflow-auto"
                              >
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
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setShowNewCategoryInput(prev => ({ ...prev, [tx.id]: true }))}
                              title="Create new category"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {tx.suggested_category_name || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTransaction(tx);
                          setJsonModalOpen(true);
                        }}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this transaction?')) {
                            deleteMutation.mutate(tx.id);
                          }
                        }}
                        title="Delete transaction"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* JSON Modal */}
      <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Plaid Transaction ID</p>
                  <p className="text-sm text-muted-foreground">{selectedTransaction.plaid_transaction_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm">{getStatusBadge(selectedTransaction.status)}</p>
                </div>
                {selectedTransaction.exclude_reason && (
                  <div>
                    <p className="text-sm font-medium">Exclude Reason</p>
                    <p className="text-sm text-muted-foreground">{selectedTransaction.exclude_reason}</p>
                  </div>
                )}
                {selectedTransaction.pf_category_primary && (
                  <div>
                    <p className="text-sm font-medium">Plaid Category</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTransaction.pf_category_primary}
                      {selectedTransaction.pf_category_detailed && 
                        ` - ${selectedTransaction.pf_category_detailed}`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}