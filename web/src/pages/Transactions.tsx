import * as React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Custom hook for debounced values
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
import { Search, Filter, Download, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { formatAmount, formatDate } from '@/lib/utils'

type Filters = {
  txnType: "income" | "expense" | "all";
  dateFrom?: string;   // "YYYY-MM-DD"
  dateTo?: string;     // "YYYY-MM-DD"
  page: number;
  perPage: number;
  q?: string;
  accountId?: number;
  categoryId?: number;
  source?: string;
  cleanedMerchant?: string;
  unmapped?: boolean;
  amountMin?: number;
  amountMax?: number;
};

function decode(search: string): Filters {
  const sp = new URLSearchParams(search);
  return {
    txnType: (sp.get("txn_type") as Filters["txnType"]) || "expense",
    dateFrom: sp.get("date_from") || undefined,
    dateTo: sp.get("date_to") || undefined,
    page: Number(sp.get("page") || 1),
    perPage: Number(sp.get("per_page") || 25),
    q: sp.get("q") || undefined,
    accountId: sp.get("account_id") ? Number(sp.get("account_id")) : undefined,
    categoryId: sp.get("category_id") ? Number(sp.get("category_id")) : undefined,
    source: sp.get("source") || undefined,
    cleanedMerchant: sp.get("cleaned_merchant") || undefined,
    unmapped: sp.get("unmapped") === "true" || undefined,
    amountMin: sp.get("amount_min") ? Number(sp.get("amount_min")) : undefined,
    amountMax: sp.get("amount_max") ? Number(sp.get("amount_max")) : undefined,
  };
}

function encode(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.txnType && f.txnType !== "all") sp.set("txn_type", f.txnType);
  if (f.dateFrom) sp.set("date_from", f.dateFrom);
  if (f.dateTo) sp.set("date_to", f.dateTo);
  if (f.page && f.page !== 1) sp.set("page", String(f.page));
  if (f.perPage && f.perPage !== 25) sp.set("per_page", String(f.perPage));
  if (f.q) sp.set("q", f.q);
  if (f.accountId) sp.set("account_id", String(f.accountId));
  if (f.categoryId) sp.set("category_id", String(f.categoryId));
  if (f.source) sp.set("source", f.source);
  if (f.cleanedMerchant) sp.set("cleaned_merchant", f.cleanedMerchant);
  if (f.unmapped) sp.set("unmapped", "true");
  if (f.amountMin !== undefined) sp.set("amount_min", String(f.amountMin));
  if (f.amountMax !== undefined) sp.set("amount_max", String(f.amountMax));
  return sp;
}

const shallowEqual = (a: Filters, b: Filters) =>
  a.txnType === b.txnType &&
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  a.page === b.page &&
  a.perPage === b.perPage &&
  a.q === b.q &&
  a.accountId === b.accountId &&
  a.categoryId === b.categoryId &&
  a.source === b.source &&
  a.cleanedMerchant === b.cleanedMerchant &&
  a.unmapped === b.unmapped &&
  a.amountMin === b.amountMin &&
  a.amountMax === b.amountMax;

// Component to show expandable list of transactions that will be affected
function BulkUpdateTransactionList({ transactions }: { 
  transactions: Array<{
    id: number;
    posted_date: string;
    amount: string;
    description_raw: string;
    merchant_raw: string;
  }> 
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showCount, setShowCount] = React.useState(5);

  if (transactions.length === 0) {
    return null;
  }

  const visibleTransactions = isExpanded ? transactions.slice(0, showCount) : transactions.slice(0, 3);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">Transactions that will be updated:</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : `View All ${transactions.length}`}
        </Button>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {visibleTransactions.map((txn) => (
          <div key={txn.id} className="flex justify-between items-center p-2 bg-white rounded border text-sm">
            <div className="flex-1">
              <div className="font-medium text-gray-900">{formatDate(txn.posted_date)}</div>
              <div className="text-gray-600 truncate">{txn.description_raw}</div>
            </div>
            <div className="text-right ml-4">
              <div className="font-medium text-red-600">{formatAmount(parseFloat(txn.amount))}</div>
              <div className="text-xs text-gray-500">{txn.merchant_raw}</div>
            </div>
          </div>
        ))}
      </div>

      {isExpanded && transactions.length > showCount && (
        <div className="mt-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCount(prev => prev + 10)}
          >
            Load More ({transactions.length - showCount} remaining)
          </Button>
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Showing {Math.min(showCount, transactions.length)} of {transactions.length} transactions
        </div>
      )}
    </div>
  );
}

export default function Transactions() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1) Lazy init from URL (no effect, no re-render loops)
  const [filters, setFilters] = React.useState<Filters>(() => decode(location.search));
  
  // 2) Separate search state with debouncing to prevent input focus loss
  const [search, setSearch] = React.useState(filters.q || "");
  const debouncedSearch = useDebounced(search, 300); // Balanced delay for responsiveness
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cursorPosRef = React.useRef<number>(0);
  
  // 3) Filter panel state
  const [showFilters, setShowFilters] = React.useState(false);
  const [amountMin, setAmountMin] = React.useState<string>(filters.amountMin?.toString() || "");
  const [amountMax, setAmountMax] = React.useState<string>(filters.amountMax?.toString() || "");
  const [cleanedMerchant, setCleanedMerchant] = React.useState<string>(filters.cleanedMerchant || "");
  
  // Apply filters with debouncing
  const debouncedAmountMin = useDebounced(amountMin, 500);
  const debouncedAmountMax = useDebounced(amountMax, 500);
  const debouncedCleanedMerchant = useDebounced(cleanedMerchant, 500);

  // 3) URL → state (runs when the address bar actually changes)
  React.useEffect(() => {
    const next = decode(location.search);
    setFilters((prev) => (shallowEqual(prev, next) ? prev : next));
    setSearch(next.q || ""); // Sync search input with URL
    setCleanedMerchant(next.cleanedMerchant || ""); // Sync cleaned merchant input with URL
  }, [location.search]);

  // 4) Update filters when debounced search changes
  React.useEffect(() => {
    setFilters(prev => ({ ...prev, q: debouncedSearch || undefined, page: 1 }));
  }, [debouncedSearch]);
  
  // 5) Update filters when debounced amount filters change
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      amountMin: debouncedAmountMin ? Number(debouncedAmountMin) : undefined,
      amountMax: debouncedAmountMax ? Number(debouncedAmountMax) : undefined,
      page: 1
    }));
  }, [debouncedAmountMin, debouncedAmountMax]);

  // 6) Update filters when debounced cleaned merchant changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      cleanedMerchant: debouncedCleanedMerchant || undefined,
      page: 1
    }));
  }, [debouncedCleanedMerchant]);

  // 7) state → URL (only push if different, excluding immediate changes)
  React.useEffect(() => {
    const filtersWithDebouncedValues = { 
      ...filters, 
      q: debouncedSearch || undefined,
      cleanedMerchant: debouncedCleanedMerchant || undefined
    };
    const next = `?${encode(filtersWithDebouncedValues).toString()}`;
    if (next !== `?${searchParams.toString()}`) {
      setSearchParams(encode(filtersWithDebouncedValues), { replace: true });
    }
  }, [filters, debouncedSearch, debouncedCleanedMerchant, searchParams, setSearchParams]);

  // 6) Data fetching keyed by stable filters with debounced search
  const txnsQuery = useQuery({
    queryKey: [
      "transactions",
      filters.txnType,
      filters.dateFrom || "",
      filters.dateTo || "",
      filters.page,
      filters.perPage,
      debouncedSearch || "",
      filters.accountId || "",
      filters.categoryId || "",
      filters.source || "",
      debouncedCleanedMerchant || "",
      filters.unmapped || "",
      filters.amountMin || "",
      filters.amountMax || "",
    ],
    queryFn: async () => {
      const filtersWithDebouncedValues = { 
        ...filters, 
        q: debouncedSearch || undefined,
        cleanedMerchant: debouncedCleanedMerchant || undefined
      };
      
      // Use search endpoint when there's a search query
      if (debouncedSearch && debouncedSearch.trim()) {
        const searchParams = new URLSearchParams();
        searchParams.set("q", debouncedSearch);
        if (filters.dateFrom) searchParams.set("date_from", filters.dateFrom);
        if (filters.dateTo) searchParams.set("date_to", filters.dateTo);
        if (filters.categoryId) searchParams.set("category_id", String(filters.categoryId));
        if (debouncedCleanedMerchant) searchParams.set("cleaned_merchant", debouncedCleanedMerchant);
        if (filters.amountMin !== undefined) searchParams.set("amount_min", String(filters.amountMin));
        if (filters.amountMax !== undefined) searchParams.set("amount_max", String(filters.amountMax));
        searchParams.set("limit", String(filters.perPage));
        searchParams.set("offset", String((filters.page - 1) * filters.perPage));
        
        const res = await fetch(`/api/transactions/search?${searchParams.toString()}`);
        if (!res.ok) throw new Error(`search ${res.status}: ${res.statusText}`);
        const searchResults = await res.json();
        
        // The search endpoint now returns properly formatted response
        return searchResults;
      }
      
      // Use regular transactions endpoint when no search
      const sp = encode(filtersWithDebouncedValues).toString();
      const res = await fetch(`/api/transactions?${sp}`);
      if (!res.ok) throw new Error(`transactions ${res.status}: ${res.statusText}`);
      return res.json();
    },
    keepPreviousData: true,
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch(`/api/transactions/accounts`);
      if (!res.ok) throw new Error(`accounts ${res.status}: ${res.statusText}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const catsQuery = useQuery({
    queryKey: ["categories", false],
    queryFn: async () => {
      const res = await fetch(`/api/transactions/categories?only_with_transactions=false`);
      if (!res.ok) throw new Error(`categories ${res.status}: ${res.statusText}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const catsWithTransactionsQuery = useQuery({
    queryKey: ["categories-with-transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/transactions/categories?only_with_transactions=true`);
      if (!res.ok) throw new Error(`categories ${res.status}: ${res.statusText}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutation for updating transactions
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update transaction: ${res.statusText}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories-with-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast({ title: "Success", description: "Transaction updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for bulk updating transactions by merchant
  const bulkUpdateByMerchantMutation = useMutation({
    mutationFn: async ({ transaction_id, category_id }: { transaction_id: number; category_id: number }) => {
      const res = await fetch(`/api/transactions/bulk-update-by-merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id, category_id }),
      });
      if (!res.ok) throw new Error(`Failed to bulk update transactions: ${res.statusText}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories-with-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast({ 
        title: "Success", 
        description: `Updated ${data.updated} transactions for this merchant` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Helper functions for updating filters
  const updateFilters = (updates: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...updates, page: 1 })); // Reset to page 1 when filtering
  };

  const handleSearch = (q: string) => {
    setSearch(q); // Update local search state immediately (no debouncing for input display)
    // Save cursor position
    if (inputRef.current) {
      cursorPosRef.current = inputRef.current.selectionStart || 0;
    }
  };
  
  // Track if we're actively searching
  const wasSearchingRef = React.useRef(false);
  
  // Restore cursor position and focus after renders
  React.useLayoutEffect(() => {
    // If we have a search term and the input exists, ensure it stays focused
    if (search && inputRef.current) {
      // Check if we lost focus but should have it
      if (document.activeElement !== inputRef.current && wasSearchingRef.current) {
        inputRef.current.focus();
      }
      
      // Restore cursor position
      if (document.activeElement === inputRef.current) {
        const pos = Math.min(cursorPosRef.current, search.length);
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(pos, pos);
        });
      }
    }
    
    // Track that we're searching
    wasSearchingRef.current = !!search;
  });

  const handleTxnTypeChange = (txnType: Filters["txnType"]) => {
    updateFilters({ txnType });
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // State for bulk update confirmation dialog
  const [bulkUpdateDialog, setBulkUpdateDialog] = React.useState<{
    show: boolean;
    transactionId: number;
    categoryId: number;
    similarCount: number;
    merchantName: string;
    allTransactions: Array<{
      id: number;
      posted_date: string;
      amount: string;
      description_raw: string;
      merchant_raw: string;
    }>;
  }>({ show: false, transactionId: 0, categoryId: 0, similarCount: 0, merchantName: "", allTransactions: [] });

  const handleCategoryChange = async (transactionId: number, categoryId: number) => {
    // First, check if there are similar transactions
    try {
      const response = await fetch(`/api/transactions/similar-count/${transactionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.similar_count > 0) {
          // Show confirmation dialog
          setBulkUpdateDialog({
            show: true,
            transactionId,
            categoryId,
            similarCount: data.similar_count,
            merchantName: data.merchant_raw || data.merchant_norm,
            allTransactions: data.all_transactions || []
          });
          return;
        }
      }
    } catch (error) {
      console.error("Failed to check similar transactions:", error);
    }
    
    // No similar transactions or error occurred, just update this one
    updateTransactionMutation.mutate({
      id: transactionId,
      data: { category_id: categoryId }
    });
  };

  const handleBulkUpdateConfirm = (updateAll: boolean) => {
    if (updateAll) {
      // Update all similar transactions
      bulkUpdateByMerchantMutation.mutate({
        transaction_id: bulkUpdateDialog.transactionId,
        category_id: bulkUpdateDialog.categoryId
      });
    } else {
      // Just update the single transaction
      updateTransactionMutation.mutate({
        id: bulkUpdateDialog.transactionId,
        data: { category_id: bulkUpdateDialog.categoryId }
      });
    }
    setBulkUpdateDialog(prev => ({ ...prev, show: false }));
  };

  // Loading and error states
  if (txnsQuery.isLoading || accountsQuery.isLoading || catsQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (txnsQuery.isError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <h3 className="text-lg font-semibold mb-2">Error Loading Transactions</h3>
              <p>{txnsQuery.error?.message || 'Unknown error occurred'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const transactions = txnsQuery.data?.transactions || [];
  const total = txnsQuery.data?.total || 0;
  const pages = txnsQuery.data?.pages || 0;
  const accounts = accountsQuery.data || [];
  const categories = catsQuery.data || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Transactions</h1>
          <p className="text-gray-600 mt-1">
            {total.toLocaleString()} transactions found
          </p>
        </div>
        <Button
          onClick={async () => {
            try {
              const response = await fetch('/api/transactions/export/excel');
              if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
              
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `transactions_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              toast({ title: "Success", description: "Transactions exported to Excel" });
            } catch (error: any) {
              toast({ title: "Error", description: error.message, variant: "destructive" });
            }
          }}
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Transaction Type Toggle */}
            <div className="flex rounded-md border w-full sm:w-fit overflow-hidden">
              {(["expense", "income", "all"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTxnTypeChange(type)}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium capitalize ${
                    filters.txnType === type
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={inputRef}
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-20"
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {/* Show loading spinner when search is pending */}
                {search && search !== debouncedSearch && (
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                )}
                {/* Clear button */}
                {search && (
                  <button
                    onClick={() => handleSearch("")}
                    className="hover:bg-gray-100 rounded p-1"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => updateFilters({ dateFrom: e.target.value || undefined })}
                className="w-full sm:w-44"
              />
              <span className="hidden sm:flex items-center text-gray-500">to</span>
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => updateFilters({ dateTo: e.target.value || undefined })}
                className="w-full sm:w-44"
              />
              
              {/* Filter Button */}
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Filter className="h-4 w-4" />
                Filters
                {(filters.categoryId || filters.accountId || filters.source || filters.cleanedMerchant ||
                  filters.unmapped || filters.amountMin || filters.amountMax) && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                    Active
                  </span>
                )}
              </Button>
            </div>
          </div>
          
          {/* Collapsible Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.categoryId || ""}
                  onChange={(e) => updateFilters({ categoryId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full p-2 border rounded-md text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="unmapped">Unmapped Only</option>
                  {catsWithTransactionsQuery.data?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Account Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account
                </label>
                <select
                  value={filters.accountId || ""}
                  onChange={(e) => updateFilters({ accountId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full p-2 border rounded-md text-sm"
                >
                  <option value="">All Accounts</option>
                  {accounts.map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <select
                  value={filters.source || ""}
                  onChange={(e) => updateFilters({ source: e.target.value || undefined })}
                  className="w-full p-2 border rounded-md text-sm"
                >
                  <option value="">All Sources</option>
                  <option value="Plaid">Plaid</option>
                  <option value="CSV">CSV Import</option>
                  <option value="Manual">Manual</option>
                  <option value="Amex">Amex</option>
                  <option value="RBC">RBC</option>
                  <option value="Scotia">Scotia</option>
                  <option value="TD">TD</option>
                  <option value="BMO">BMO</option>
                </select>
              </div>
              
              {/* Cleaned Merchant Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cleaned Merchant
                </label>
                <Input
                  type="text"
                  placeholder="Filter by cleaned merchant..."
                  value={cleanedMerchant}
                  onChange={(e) => setCleanedMerchant(e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
              
              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Range
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="w-24"
                  />
                  <span className="flex items-center">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="w-24"
                  />
                </div>
              </div>
              
              {/* Unmapped Only Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="unmapped-only"
                  checked={filters.unmapped || false}
                  onChange={(e) => updateFilters({ unmapped: e.target.checked || undefined })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="unmapped-only" className="text-sm font-medium text-gray-700">
                  Show Unmapped Only
                </label>
              </div>
              
              {/* Clear Filters Button */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateFilters({ 
                      categoryId: undefined, 
                      accountId: undefined, 
                      source: undefined,
                      cleanedMerchant: undefined,
                      unmapped: undefined,
                      amountMin: undefined,
                      amountMax: undefined
                    });
                    setAmountMin("");
                    setAmountMax("");
                    setCleanedMerchant("");
                  }}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Cleaned Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn: any) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      {formatDate(txn.posted_date)}
                    </TableCell>
                    <TableCell>
                      {txn.merchant_raw}
                    </TableCell>
                    <TableCell>
                      {txn.description_raw}
                    </TableCell>
                    <TableCell>
                      {txn.cleaned_final_merchant || '-'}
                    </TableCell>
                    <TableCell>
                      <select
                        value={txn.category_id || ""}
                        onChange={(e) => handleCategoryChange(txn.id, Number(e.target.value))}
                        className="w-full p-1 border rounded text-sm"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          txn.txn_type === "income"
                            ? "text-green-600 font-medium"
                            : "text-red-600"
                        }
                      >
                        {formatAmount(txn.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{txn.source}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                Page {filters.page} of {pages} ({total.toLocaleString()} total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Update Confirmation Dialog */}
      {bulkUpdateDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full mx-3 sm:mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Update Similar Transactions?</h3>
            <p className="text-gray-600 mb-4">
              Found <span className="font-bold">{bulkUpdateDialog.similarCount}</span> other transactions 
              for merchant "<span className="font-medium">{bulkUpdateDialog.merchantName}</span>".
            </p>
            
            {/* Expandable Transaction List */}
            <BulkUpdateTransactionList transactions={bulkUpdateDialog.allTransactions} />
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-4">
                Do you want to update the category for all {bulkUpdateDialog.similarCount + 1} transactions?
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleBulkUpdateConfirm(false)}
                >
                  Just This One
                </Button>
                <Button
                  onClick={() => handleBulkUpdateConfirm(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Update All ({bulkUpdateDialog.similarCount + 1})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






