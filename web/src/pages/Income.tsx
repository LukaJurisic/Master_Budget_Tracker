import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload, Save, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiClient } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

interface EditableIncomeRow {
  id?: number
  tempId?: string  // For tracking new rows before they get real IDs
  posted_date: string
  source: string
  amount: string
  income_category: string
  notes: string
  account_id?: number
  account_name?: string
  isNew?: boolean
  isEdited?: boolean
}

export default function Income() {
  const [incomeRows, setIncomeRows] = useState<EditableIncomeRow[]>([])
  const [dateFrom, setDateFrom] = useState('2020-01-01')
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [incomeCategories, setIncomeCategories] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showSheetPicker, setShowSheetPicker] = useState(false)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [expenseSheets, setExpenseSheets] = useState<string[]>([])
  const [incomeSheets, setIncomeSheets] = useState<string[]>([])
  const [sourceToCategoryMap, setSourceToCategoryMap] = useState<Map<string, string>>(new Map())
  const [saveMessage, setSaveMessage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Track which rows have already spawned a new row to prevent multiple spawns
  const spawnedOnceRef = useRef<Set<string | number>>(new Set())
  const dirtyRef = useRef<Set<string | number>>(new Set())
  const rowIdCounterRef = useRef(0)

  const queryClient = useQueryClient()

  const { data: incomeData, isLoading } = useQuery({
    queryKey: ['income', dateFrom, dateTo, searchQuery],
    queryFn: () => apiClient.getTransactions({
      txn_type: 'income',
      date_from: dateFrom,
      date_to: dateTo,
      merchant: searchQuery || undefined,
      per_page: 500  // Request all income transactions (max allowed)
    }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  })

  // Convert API data to editable rows
  useEffect(() => {
    if (incomeData?.transactions) {
      // Sort transactions by date in descending order (newest first)
      const sortedTransactions = [...incomeData.transactions].sort((a, b) => 
        new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime()
      )
      
      const rows = sortedTransactions.map(t => {
        const account = accounts?.find(a => a.id === t.account_id)
        return {
          id: t.id,
          posted_date: t.posted_date,
          source: t.merchant_raw || '',
          amount: t.amount.toString(),
          income_category: t.subcategory?.name || t.category?.name || '',
          notes: t.description_raw || '',
          account_id: t.account_id,
          account_name: account ? `${account.name}${account.mask ? ` ••••${account.mask}` : ''}` : ''
        }
      })
      
      // Add empty row at the top for new entries
      rows.unshift({
        tempId: `temp-${++rowIdCounterRef.current}`,
        posted_date: new Date().toISOString().split('T')[0],
        source: '',
        amount: '',
        income_category: '',
        notes: '',
        account_id: accounts?.[0]?.id,
        account_name: accounts?.[0] ? `${accounts[0].name}${accounts[0].mask ? ` ••••${accounts[0].mask}` : ''}` : '',
        isNew: true
      })
      
      setIncomeRows(rows)
      
      // Extract income categories and build source->category map
      const cats = new Set<string>()
      const sourceMap = new Map<string, string>()
      
      incomeData.transactions.forEach(t => {
        // Add to categories set
        if (t.subcategory?.name) {
          cats.add(t.subcategory.name)
          // Build source->category map for auto-lookup
          if (t.merchant_raw) {
            sourceMap.set(t.merchant_raw.toLowerCase(), t.subcategory.name)
          }
        } else if (t.category?.name) {
          cats.add(t.category.name)
        }
      })
      
      setIncomeCategories(cats)
      setSourceToCategoryMap(sourceMap)
    }
  }, [incomeData, accounts])

  const createIncomeMutation = useMutation({
    mutationFn: (data: any) => apiClient.createIncome(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  const updateIncomeMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateTransaction(data.id, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  const deleteIncomeMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  const previewMutation = useMutation({
    mutationFn: (file: File) => apiClient.previewHistoricalExcel(file),
    onSuccess: (data) => {
      setSheetNames(data.sheet_names)
      // Auto-select expense and income sheets based on names
      const autoExpenseSheets = data.sheet_names.filter((name: string) => 
        /expense|transaction/i.test(name)
      )
      const autoIncomeSheets = data.sheet_names.filter((name: string) => 
        /income/i.test(name)
      )
      setExpenseSheets(autoExpenseSheets)
      setIncomeSheets(autoIncomeSheets)
      setShowSheetPicker(true)
    },
    onError: (error: any) => {
      console.error('Preview error:', error)
      alert(`Failed to preview file: ${error.message || 'Unknown error occurred'}`)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
  })

  const commitMutation = useMutation({
    mutationFn: (data: { file: File; expense_sheets: string[]; income_sheets: string[] }) => 
      apiClient.commitHistoricalExcel(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setShowSheetPicker(false)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      alert(`Import successful! Imported ${data.import_results.inserted} transactions (${data.import_results.income} income, ${data.import_results.expenses} expenses), skipped ${data.import_results.skipped} duplicates.`)
    },
    onError: (error: any) => {
      console.error('Import error:', error)
      alert(`Import failed: ${error.message || 'Unknown error occurred'}`)
    },
  })

  // Check if a row has meaningful content (only count manually entered core fields)
  const isRowNonEmpty = (row: EditableIncomeRow) => {
    return Boolean(
      (row.source && row.source.trim()) &&
      (row.amount && row.amount.trim())
    )
  }

  // Ensure there's always exactly one blank row at the top
  const ensureSingleBlankRowAtTop = () => {
    setIncomeRows(prev => {
      // Check if there's already a blank row at index 0
      const hasBlankTop = prev.length > 0 && !isRowNonEmpty(prev[0]) && prev[0].isNew
      
      if (hasBlankTop) {
        return prev // Already have blank row at top
      }
      
      // Add new blank row at top
      const newBlankRow: EditableIncomeRow = {
        tempId: `temp-${++rowIdCounterRef.current}`,
        posted_date: new Date().toISOString().split('T')[0],
        source: '',
        amount: '',
        income_category: '',
        notes: '',
        isNew: true
      }
      
      return [newBlankRow, ...prev]
    })
  }

  const handleCellChange = (index: number, field: keyof EditableIncomeRow, value: string) => {
    setIncomeRows(prev => {
      const newRows = [...prev]
      newRows[index] = { ...newRows[index], [field]: value, isEdited: true }
      
      // Auto-fill income category based on source (VLOOKUP functionality)
      if (field === 'source') {
        if (value.trim()) {
          const categoryMatch = sourceToCategoryMap.get(value.toLowerCase())
          if (categoryMatch) {
            newRows[index].income_category = categoryMatch
          }
        } else {
          // Clear category if source is cleared
          newRows[index].income_category = ''
        }
      }
      
      // Mark as dirty but don't spawn new row here - will happen on commit
      const rowKey = newRows[index].id || newRows[index].tempId || `fallback-${index}`
      dirtyRef.current.add(rowKey)
      
      return newRows
    })
  }

  // Commit row when user finishes editing (blur or Enter)
  const handleCommitRow = (index: number) => {
    const row = incomeRows[index]
    if (!row) return
    
    const rowKey = row.id || row.tempId || `fallback-${index}`
    
    // If this is a new row that now has content, spawn a blank row and mark as no longer new
    if (row.isNew && isRowNonEmpty(row) && !spawnedOnceRef.current.has(rowKey)) {
      // Mark this row as no longer new
      setIncomeRows(prev => {
        const newRows = [...prev]
        newRows[index] = { ...newRows[index], isNew: false }
        return newRows
      })
      
      // Ensure there's a blank row at the top
      ensureSingleBlankRowAtTop()
      
      // Mark that we've spawned for this row
      spawnedOnceRef.current.add(rowKey)
    }
    
    // Clear dirty flag
    dirtyRef.current.delete(rowKey)
  }

  const handleSaveChanges = async () => {
    const changedRows = incomeRows.filter(row => row.isEdited && !row.isNew && row.source && row.amount)
    
    if (changedRows.length === 0) {
      setSaveMessage('No valid entries to save')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }
    
    let savedCount = 0
    
    for (const row of changedRows) {
      try {
        if (row.id) {
          // Update existing
          // Find category and subcategory IDs from category name
          let category_id = null
          let subcategory_id = null
          
          if (row.income_category && categories) {
            const findCategoryInfo = (cats: any[], name: string): { category_id: number | null, subcategory_id: number | null } => {
              for (const cat of cats) {
                if (cat.name === name) {
                  // Direct match - if it has parent_id, it's a subcategory
                  if (cat.parent_id) {
                    return { category_id: cat.parent_id, subcategory_id: cat.id }
                  } else {
                    return { category_id: cat.id, subcategory_id: null }
                  }
                }
                if (cat.children && cat.children.length > 0) {
                  const childResult = findCategoryInfo(cat.children, name)
                  if (childResult.category_id || childResult.subcategory_id) return childResult
                }
              }
              return { category_id: null, subcategory_id: null }
            }
            
            const categoryInfo = findCategoryInfo(categories, row.income_category)
            category_id = categoryInfo.category_id
            subcategory_id = categoryInfo.subcategory_id
          }
          
          await updateIncomeMutation.mutateAsync({
            id: row.id,
            updates: {
              posted_date: row.posted_date,
              merchant_raw: row.source,
              amount: parseFloat(row.amount) || 0,
              description_raw: row.notes,
              category_id: category_id,
              subcategory_id: subcategory_id,
              account_id: row.account_id
            }
          })
        } else {
          // Create new - find category and subcategory IDs from category name
          let category_id = null
          let subcategory_id = null
          
          if (row.income_category && categories) {
            const findCategoryInfo = (cats: any[], name: string): { category_id: number | null, subcategory_id: number | null } => {
              for (const cat of cats) {
                if (cat.name === name) {
                  // Direct match - if it has parent_id, it's a subcategory
                  if (cat.parent_id) {
                    return { category_id: cat.parent_id, subcategory_id: cat.id }
                  } else {
                    return { category_id: cat.id, subcategory_id: null }
                  }
                }
                if (cat.children && cat.children.length > 0) {
                  const childResult = findCategoryInfo(cat.children, name)
                  if (childResult.category_id || childResult.subcategory_id) return childResult
                }
              }
              return { category_id: null, subcategory_id: null }
            }
            
            const categoryInfo = findCategoryInfo(categories, row.income_category)
            category_id = categoryInfo.category_id
            subcategory_id = categoryInfo.subcategory_id
          }
          
          await createIncomeMutation.mutateAsync({
            posted_date: row.posted_date,
            source: row.source,
            amount: parseFloat(row.amount),
            notes: row.notes,
            category_id: category_id,
            subcategory_id: subcategory_id,
            income_category: row.income_category,
            account_id: row.account_id
          })
        }
        savedCount++
      } catch (error) {
        console.error('Error saving row:', error)
      }
    }
    
    // Show success message
    setSaveMessage(`✅ Saved ${savedCount} entries successfully!`)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  const handleDeleteRow = (index: number, id?: number) => {
    if (id) {
      if (confirm('Delete this income entry?')) {
        deleteIncomeMutation.mutate(id)
      }
    } else {
      // Remove unsaved row
      setIncomeRows(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      previewMutation.mutate(file)
    }
  }

  const handleSheetToggle = (sheetName: string, type: 'expense' | 'income') => {
    if (type === 'expense') {
      setExpenseSheets(prev => 
        prev.includes(sheetName) 
          ? prev.filter(s => s !== sheetName)
          : [...prev, sheetName]
      )
    } else {
      setIncomeSheets(prev => 
        prev.includes(sheetName) 
          ? prev.filter(s => s !== sheetName)
          : [...prev, sheetName]
      )
    }
  }

  const handleConfirmImport = () => {
    if (selectedFile) {
      commitMutation.mutate({
        file: selectedFile,
        expense_sheets: expenseSheets,
        income_sheets: incomeSheets
      })
    }
  }

  // Calculate total
  const total = incomeRows.reduce((sum, row) => {
    const amount = parseFloat(row.amount) || 0
    return sum + amount
  }, 0)

  const hasChanges = incomeRows.some(row => row.isEdited && !row.isNew && row.source && row.amount)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income</h1>
          <p className="text-muted-foreground">
            Excel-style editable income tracker - new entries auto-create at top
          </p>
          {saveMessage && (
            <p className="text-sm font-medium text-green-600 animate-pulse bg-green-50 px-2 py-1 rounded mt-1">
              {saveMessage}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={handleSaveChanges}
            disabled={!hasChanges || createIncomeMutation.isPending || updateIncomeMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createIncomeMutation.isPending || updateIncomeMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 flex items-center space-x-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
              <span>to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Input
              placeholder="Search source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={previewMutation.isPending || commitMutation.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {previewMutation.isPending ? 'Loading...' : 'Import Excel'}
              </Button>
              {selectedFile && (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Excel-style Income Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Income Transactions - Excel Style</span>
            <span className="text-sm font-normal text-muted-foreground">
              Click any cell to edit • Auto-saves when you navigate away
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead className="w-48">Source</TableHead>
                      <TableHead className="w-32">Amount</TableHead>
                      <TableHead className="w-40">Income Category</TableHead>
                      <TableHead className="w-48">Account</TableHead>
                      <TableHead className="flex-1">Notes</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeRows.map((row, index) => (
                      <TableRow 
                        key={row.id || index} 
                        className={`
                          ${row.isNew ? 'bg-green-50' : ''}
                          ${row.isEdited ? 'bg-yellow-50' : ''}
                          hover:bg-gray-50
                        `}
                      >
                        <TableCell>
                          <Input
                            type="date"
                            value={row.posted_date}
                            onChange={(e) => handleCellChange(index, 'posted_date', e.target.value)}
                            onBlur={() => handleCommitRow(index)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommitRow(index)}
                            className="border-0 bg-transparent text-sm w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.source}
                            onChange={(e) => handleCellChange(index, 'source', e.target.value)}
                            onBlur={() => handleCommitRow(index)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommitRow(index)}
                            placeholder="Employer, Client..."
                            className="border-0 bg-transparent text-sm w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => handleCellChange(index, 'amount', e.target.value)}
                            onBlur={() => handleCommitRow(index)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommitRow(index)}
                            placeholder="0.00"
                            className="border-0 bg-transparent text-sm w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="text"
                            list={`income-categories-${index}`}
                            value={row.income_category}
                            onChange={(e) => handleCellChange(index, 'income_category', e.target.value)}
                            onBlur={() => handleCommitRow(index)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommitRow(index)}
                            placeholder="Primary Job, Bonus..."
                            className="border-0 bg-transparent text-sm w-full outline-none"
                          />
                          <datalist id={`income-categories-${index}`}>
                            {Array.from(incomeCategories).map(cat => (
                              <option key={cat} value={cat} />
                            ))}
                            <option value="Primary Job" />
                            <option value="Primary Job - Bonus" />
                            <option value="Family Income" />
                            <option value="Government" />
                            <option value="Tax Refund" />
                            <option value="Interest" />
                            <option value="Insurance" />
                            <option value="Investment Income" />
                            <option value="Other Income" />
                          </datalist>
                        </TableCell>
                        <TableCell>
                          <select
                            value={row.account_id || ''}
                            onChange={(e) => {
                              const selectedAccount = accounts?.find(a => a.id === parseInt(e.target.value))
                              handleCellChange(index, 'account_id', e.target.value)
                              handleCellChange(index, 'account_name', selectedAccount ? `${selectedAccount.name}${selectedAccount.mask ? ` ••••${selectedAccount.mask}` : ''}` : '')
                            }}
                            onBlur={() => handleCommitRow(index)}
                            className="border-0 bg-transparent text-sm w-full outline-none"
                          >
                            <option value="">Select account...</option>
                            {accounts?.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.name} {account.mask && `••••${account.mask}`}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.notes}
                            onChange={(e) => handleCellChange(index, 'notes', e.target.value)}
                            onBlur={() => handleCommitRow(index)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommitRow(index)}
                            placeholder="Optional notes..."
                            className="border-0 bg-transparent text-sm w-full"
                          />
                        </TableCell>
                        <TableCell>
                          {!row.isNew && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRow(index, row.id)}
                              disabled={deleteIncomeMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Total Row */}
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <div className="text-lg font-semibold">
                  Total Income ({incomeRows.filter(r => !r.isNew && r.amount).length} entries)
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(total)}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sheet Picker Dialog */}
      {showSheetPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select sheets to import</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSheetPicker(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3 text-blue-700">Expense Sheets</h4>
                <div className="space-y-2">
                  {sheetNames.map(sheetName => (
                    <label key={`expense-${sheetName}`} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={expenseSheets.includes(sheetName)}
                        onChange={() => handleSheetToggle(sheetName, 'expense')}
                        className="rounded"
                      />
                      <span className="text-sm">{sheetName}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3 text-green-700">Income Sheets</h4>
                <div className="space-y-2">
                  {sheetNames.map(sheetName => (
                    <label key={`income-${sheetName}`} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={incomeSheets.includes(sheetName)}
                        onChange={() => handleSheetToggle(sheetName, 'income')}
                        className="rounded"
                      />
                      <span className="text-sm">{sheetName}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowSheetPicker(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={commitMutation.isPending || (expenseSheets.length === 0 && incomeSheets.length === 0)}
              >
                {commitMutation.isPending ? 'Importing...' : `Import ${expenseSheets.length + incomeSheets.length} sheets`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}