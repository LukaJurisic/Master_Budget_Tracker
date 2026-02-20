import axios, { AxiosResponse } from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.data?.detail) {
      error.message = error.response.data.detail
    }
    return Promise.reject(error)
  }
)

// Types
export interface Transaction {
  id: number
  account_id: number
  plaid_transaction_id?: string
  posted_date: string
  amount: number
  currency: string
  merchant_raw?: string
  description_raw?: string
  merchant_norm?: string
  category_id?: number
  subcategory_id?: number
  source: string
  hash_dedupe: string
  created_at: string
  updated_at?: string
  category?: Category
  subcategory?: Category
}

export interface Category {
  id: number
  name: string
  parent_id?: number
  color?: string
  full_path: string
  children?: Category[]
}

export interface Account {
  id: number
  name: string
  mask?: string
  official_name?: string
  account_type?: string
}

export interface MerchantRule {
  id: number
  rule_type: 'EXACT' | 'CONTAINS' | 'REGEX'
  fields: 'MERCHANT' | 'DESCRIPTION' | 'PAIR'
  pattern: string
  desc_pattern?: string
  category_id: number
  subcategory_id?: number
  priority: number
  created_at: string
  category?: Category
  subcategory?: Category
}

export interface Budget {
  id: number
  category_id: number
  month: string
  amount: number
  created_at: string
  category?: Category
}

export interface UnmappedMerchant {
  merchant_norm: string
  count: number
  total_amount: number
  first_seen: string
  last_seen: string
}

export interface UnmappedPair {
  merchant_norm: string
  description_norm: string
  count: number
  total_amount: number
  last_seen: string
}

export interface TransactionList {
  transactions: Transaction[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface SummaryData {
  month: string
  monthly_totals: MonthlyTotal[]
  budget_vs_actual: BudgetVsActual
  top_categories: TopCategory[]
  top_merchants: TopMerchant[]
  unmapped_count: number
  account_summaries: AccountSummary[]
}

export interface MonthlyTotal {
  month: string
  total_spending: number
  total_income: number
  transaction_count: number
}

export interface BudgetVsActual {
  month: string
  budget_items: BudgetItem[]
  total_budget: number
  total_actual: number
  total_variance: number
  total_variance_percent: number
}

export interface BudgetItem {
  category: Category
  budget_amount: number
  actual_amount: number
  variance: number
  variance_percent: number
  is_over_budget: boolean
}

export interface TopCategory {
  category: Category
  total_amount: number
  transaction_count: number
}

export interface TopMerchant {
  merchant_norm: string
  total_amount: number
  transaction_count: number
}

export interface AccountSummary {
  account: Account
  total_amount: number
  transaction_count: number
}

// Analytics types
export interface AnalyticsSummary {
  asOf: string
  requestedMonth: string
  effectiveMonth: string
  totals: {
    income: number
    expense: number
    savings: number
  }
  counts: {
    unmapped: number
    txns: number
  }
}

export interface MonthlyTrends {
  asOf: string
  months: string[]
  income: number[]
  expense: number[]
  savings: number[]
  cumulativeSavings: number[]
}

export interface CategoryBreakdown {
  asOf: string
  month: string
  total: number
  categories: Array<{
    id: number
    name: string
    total: number
    pct: number
  }>
}

export interface MerchantBreakdown {
  asOf: string
  month: string
  merchants: Array<{
    merchant: string
    total: number
    count: number
    pctOfMonth: number
  }>
}

export interface AccountActivity {
  asOf: string
  month: string
  accounts: Array<{
    id: number
    name: string
    total: number
    count: number
  }>
}

export interface CurrentMonthBreakdown {
  asOf: string
  month: string
  rows: Array<{
    category: string
    description: string
    total: number
  }>
  groups: Array<{
    category: string
    total: number
    items: Array<{
      description: string
      total: number
    }>
  }>
}

// Dashboard types (Excel-style)
export interface DashboardMeta {
  first_data_month: string | null
  latest_data_month: string | null
}

export interface DashboardCards {
  income: number
  expenses: number
  net_savings: number
  total_txns: number
  unmapped: number
  active_categories: number
}

export interface DashboardLines {
  income_by_month: Array<{ month: string; amount: number }>
  expenses_by_month: Array<{ month: string; amount: number }>
  networth_cumulative: Array<{ month: string; amount: number }>
}

export interface DashboardCategories {
  breakdown: Array<{
    category: string
    amount: number
    percent: number
  }>
  top_categories: Array<{
    category: string
    amount: number
  }>
  category_details: Array<{
    category: string
    amount: number
    items: Array<{
      description: string
      amount: number
    }>
  }>
}

export interface DashboardTopMerchant {
  merchant: string
  amount: number
}

// New Analytics types
export interface AvailableMonths {
  min_month: string | null
  max_month: string | null
  latest_with_data: string | null
}

export interface SummaryRange {
  months: string[]
  income_monthly: number[]
  expense_monthly: number[]
  savings_monthly: number[]
  income_total: number
  expense_total: number
  savings_total: number
  pct_saved: number
  income_avg: number
  expense_avg: number
}

export interface CategorySeries {
  months: string[]
  values: number[]
  txn_counts: number[]
  total: number
  monthly_avg: number
}

export interface LatestMonthBreakdowns {
  latest_month: string | null
  category_details: Array<{
    category: string
    total: number
    items: Array<{
      description: string
      amount: number
    }>
  }>
  top_merchants: Array<{
    merchant: string
    amount: number
  }>
}

export interface TransactionCounts {
  total_txns: number
  unmapped: number
  categories: number
}

export interface NetworthCumulative {
  months: string[]
  networth_cumulative: number[]
}

export interface RecurringSubscription {
  merchant: string
  category?: string
  monthly_amount: number
  months_count: number
  total_charged: number
  first_date: string
  last_date: string
  price_changes?: number[]
  is_current?: boolean
}

export interface RecurringSubscriptionsResponse {
  subscriptions: RecurringSubscription[]
  summary: {
    count: number
    current_count: number
    old_count: number
    total_monthly: number
    total_all_time: number
  }
}

export interface TransactionFrequencyByCategory {
  category: string
  color?: string
  total_transactions: number
  avg_per_month: number
}

export interface TransactionFrequencyByCategoryResponse {
  data: TransactionFrequencyByCategory[]
  date_range: {
    start_date: string
    end_date: string
    months_count: number
  }
}

export interface TransactionFrequencyByMerchant {
  merchant: string
  total_transactions: number
  avg_per_month: number
  total_amount: number
}

export interface TransactionFrequencyByMerchantResponse {
  data: TransactionFrequencyByMerchant[]
  date_range: {
    start_date: string
    end_date: string
    months_count: number
  }
}

export interface SpendingAmountByCategory {
  category: string
  color?: string
  total_amount: number
  avg_per_month: number
  total_transactions: number
}

export interface SpendingAmountByCategoryResponse {
  data: SpendingAmountByCategory[]
  date_range: {
    start_date: string
    end_date: string
    months_count: number
  }
}

export interface SpendingAmountByMerchant {
  merchant: string
  total_amount: number
  avg_per_month: number
  total_transactions: number
}

export interface SpendingAmountByMerchantResponse {
  data: SpendingAmountByMerchant[]
  date_range: {
    start_date: string
    end_date: string
    months_count: number
  }
}

// API functions
export const apiClient = {
  // Plaid
  async createLinkToken(): Promise<{ link_token: string; expiration: string }> {
    const response = await api.post('/plaid/link-token')
    return response.data
  },

  async exchangePublicToken(publicToken: string): Promise<any> {
    const response = await api.post('/plaid/exchange', { public_token: publicToken })
    return response.data
  },

  // Sync
  async syncAmex(): Promise<any> {
    const response = await api.post('/sync/amex')
    return response.data
  },

  async refreshData(): Promise<any> {
    const response = await api.post('/summary/refresh')
    return response.data
  },

  // Transactions
  async getTransactions(params: {
    page?: number
    per_page?: number
    date_from?: string
    date_to?: string
    account_id?: number
    category_id?: number
    merchant?: string
    min_amount?: number
    max_amount?: number
    source?: string
    unmapped?: boolean
    txn_type?: string
  }): Promise<TransactionList> {
    const response = await api.get('/transactions', { params })
    return response.data
  },

  async updateTransaction(id: number, data: {
    posted_date?: string
    amount?: number
    merchant_raw?: string
    description_raw?: string
    category_id?: number
    subcategory_id?: number
    merchant_norm?: string
  }): Promise<Transaction> {
    const response = await api.put(`/transactions/${id}`, data)
    return response.data
  },

  async getUnmappedMerchants(): Promise<UnmappedMerchant[]> {
    const response = await api.get('/transactions/unmapped')
    return response.data
  },

  async getUnmappedPairs(): Promise<UnmappedPair[]> {
    const response = await api.get('/transactions/unmapped/pairs')
    return response.data
  },

  async getAccounts(): Promise<Account[]> {
    const response = await api.get('/transactions/accounts')
    return response.data
  },

  async getCategories(onlyWithTransactions = false): Promise<Category[]> {
    const response = await api.get('/transactions/categories', {
      params: { only_with_transactions: onlyWithTransactions }
    })
    return response.data
  },

  // Rules
  async getRules(): Promise<MerchantRule[]> {
    const response = await api.get('/rules')
    return response.data
  },

  async createRule(data: {
    rule_type: 'EXACT' | 'CONTAINS' | 'REGEX'
    fields?: 'MERCHANT' | 'DESCRIPTION' | 'PAIR'
    pattern: string
    desc_pattern?: string
    category_id: number
    subcategory_id?: number
    priority?: number
  }): Promise<{ updated_count: number; rule_id: number }> {
    const response = await api.post('/rules', data)
    return response.data
  },

  async bulkAssignRules(rules: Array<{
    merchant_pattern: string
    desc_pattern?: string
    category_id: number
    subcategory_id?: number
    rule_type?: 'EXACT' | 'CONTAINS' | 'REGEX'
    fields?: 'MERCHANT' | 'DESCRIPTION' | 'PAIR'
    priority?: number
  }>): Promise<{ created: number; affected: number; rule_ids: number[] }> {
    const response = await api.post('/rules/bulk-assign', rules)
    return response.data
  },

  async updateRule(id: number, data: {
    rule_type?: 'EXACT' | 'CONTAINS' | 'REGEX'
    fields?: 'MERCHANT' | 'DESCRIPTION' | 'PAIR'
    pattern?: string
    desc_pattern?: string
    category_id?: number
    subcategory_id?: number
    priority?: number
  }): Promise<{ updated_count: number; rule_id: number }> {
    const response = await api.put(`/rules/${id}`, data)
    return response.data
  },

  async deleteRule(id: number): Promise<{ message: string }> {
    const response = await api.delete(`/rules/${id}`)
    return response.data
  },

  // Budgets
  async getBudgets(month?: string): Promise<Budget[]> {
    const response = await api.get('/budgets', { params: { month } })
    return response.data
  },

  async createBudget(data: {
    category_id: number
    month: string
    amount: number
  }): Promise<Budget> {
    const response = await api.post('/budgets', data)
    return response.data
  },

  async updateBudget(id: number, data: { amount: number }): Promise<Budget> {
    const response = await api.put(`/budgets/${id}`, data)
    return response.data
  },

  async deleteBudget(id: number): Promise<{ message: string }> {
    const response = await api.delete(`/budgets/${id}`)
    return response.data
  },

  // Summary
  async getSummary(month?: string): Promise<SummaryData> {
    const response = await api.get('/summary', { params: { month } })
    return response.data
  },

  // Uploads
  async previewCSV(file: File, delimiter = ',', encoding = 'utf-8'): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('delimiter', delimiter)
    formData.append('encoding', encoding)
    
    const response = await api.post('/upload/csv/preview', formData)
    return response.data
  },

  async importCSV(data: {
    file: File
    account_id: number
    date_column: string
    description_column: string
    amount_column?: string
    debit_column?: string
    credit_column?: string
    delimiter?: string
    encoding?: string
  }): Promise<any> {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('account_id', data.account_id.toString())
    formData.append('date_column', data.date_column)
    formData.append('description_column', data.description_column)
    
    if (data.amount_column) formData.append('amount_column', data.amount_column)
    if (data.debit_column) formData.append('debit_column', data.debit_column)
    if (data.credit_column) formData.append('credit_column', data.credit_column)
    if (data.delimiter) formData.append('delimiter', data.delimiter)
    if (data.encoding) formData.append('encoding', data.encoding)
    
    const response = await api.post('/upload/csv', formData)
    return response.data
  },

  async createIncome(data: {
    posted_date: string
    source: string
    amount: number
    category_id?: number
    subcategory_id?: number
    notes?: string
    income_category?: string
  }): Promise<Transaction> {
    const response = await api.post('/income', data)
    return response.data
  },

  async deleteTransaction(id: number): Promise<void> {
    await api.delete(`/transactions/${id}`)
  },

  async importHistorical(path: string): Promise<any> {
    const response = await api.post('/import/historical', { path })
    return response.data
  },

  async previewHistoricalExcel(file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/import/historical/preview', formData)
    return response.data
  },

  async commitHistoricalExcel(data: {
    file: File
    expense_sheets: string[]
    income_sheets: string[]
  }): Promise<any> {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('expense_sheets', data.expense_sheets.join(','))
    formData.append('income_sheets', data.income_sheets.join(','))
    
    const response = await api.post('/import/historical/commit', formData)
    return response.data
  },

  async importBudgetsExcel(file: File, sheetName = 'Budgets'): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sheet_name', sheetName)
    
    const response = await api.post('/upload/excel/budgets', formData)
    return response.data
  },

  // Analytics
  async getAnalyticsSummary(month?: string): Promise<AnalyticsSummary> {
    const response = await api.get('/analytics/summary', { params: { month } })
    return response.data
  },

  async getMonthlyTrends(fromMonth?: string, toMonth?: string): Promise<MonthlyTrends> {
    const response = await api.get('/analytics/monthly', { 
      params: { from: fromMonth, to: toMonth } 
    })
    return response.data
  },

  async getCategoryBreakdown(month?: string): Promise<CategoryBreakdown> {
    const response = await api.get('/analytics/categories', { params: { month } })
    return response.data
  },

  async getMerchantBreakdown(month?: string, categoryId?: number): Promise<MerchantBreakdown> {
    const response = await api.get('/analytics/merchants', { 
      params: { month, categoryId } 
    })
    return response.data
  },

  async getAccountActivity(month?: string): Promise<AccountActivity> {
    const response = await api.get('/analytics/accounts', { params: { month } })
    return response.data
  },

  async getCurrentMonthBreakdown(month?: string): Promise<CurrentMonthBreakdown> {
    const response = await api.get('/analytics/month-current-breakdown', { params: { month } })
    return response.data
  },

  // Dashboard (Excel-style)
  async getDashboardMeta(): Promise<DashboardMeta> {
    const response = await api.get('/dashboard/meta')
    return response.data
  },

  async getDashboardCards(month?: string): Promise<DashboardCards> {
    const response = await api.get('/dashboard/cards', { params: { month } })
    return response.data
  },

  async getDashboardLines(): Promise<DashboardLines> {
    const response = await api.get('/dashboard/lines')
    return response.data
  },

  async getDashboardCategories(month?: string): Promise<DashboardCategories> {
    const response = await api.get('/dashboard/categories', { params: { month } })
    return response.data
  },

  async getDashboardTopMerchants(month?: string): Promise<DashboardTopMerchant[]> {
    const response = await api.get('/dashboard/top-merchants', { params: { month } })
    return response.data
  },

  // New Analytics (Range-aware)
  async getAnalyticsAvailableMonths(): Promise<AvailableMonths> {
    const response = await api.get('/analytics/available-months')
    return response.data
  },

  async getAnalyticsSummaryRange(dateFrom: string, dateTo: string): Promise<SummaryRange> {
    const response = await api.get('/analytics/summary-range', { 
      params: { date_from: dateFrom, date_to: dateTo } 
    })
    return response.data
  },

  async getAnalyticsCategorySeries(categoryId: number, dateFrom: string, dateTo: string): Promise<CategorySeries> {
    const response = await api.get('/analytics/category-series', { 
      params: { category_id: categoryId, date_from: dateFrom, date_to: dateTo } 
    })
    return response.data
  },

  async getAnalyticsAllCategoriesSeries(dateFrom: string, dateTo: string): Promise<CategorySeries> {
    const response = await api.get('/analytics/all-categories-series', { 
      params: { date_from: dateFrom, date_to: dateTo } 
    })
    return response.data
  },

  async getAnalyticsLatestMonthBreakdowns(): Promise<LatestMonthBreakdowns> {
    const response = await api.get('/analytics/latest-month-breakdowns')
    return response.data
  },

  async getAnalyticsTransactionCounts(dateFrom: string, dateTo: string): Promise<TransactionCounts> {
    const response = await api.get('/analytics/transaction-counts', { 
      params: { date_from: dateFrom, date_to: dateTo } 
    })
    return response.data
  },

  async getAnalyticsNetworthCumulative(): Promise<NetworthCumulative> {
    const response = await api.get('/analytics/networth-cumulative')
    return response.data
  },

  async getRecurringSubscriptions(dateFrom?: string, dateTo?: string): Promise<RecurringSubscriptionsResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)
    
    const response = await api.get(`/analytics/recurring-subscriptions?${params}`)
    return response.data
  },

  async getTransactionFrequencyByCategory(dateFrom?: string, dateTo?: string, limit: number = 10): Promise<TransactionFrequencyByCategoryResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)
    params.append('limit', limit.toString())
    
    const response = await api.get(`/analytics/transaction-frequency-by-category?${params}`)
    return response.data
  },

  async getTransactionFrequencyByMerchant(dateFrom?: string, dateTo?: string, limit: number = 10): Promise<TransactionFrequencyByMerchantResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)
    params.append('limit', limit.toString())
    
    const response = await api.get(`/analytics/transaction-frequency-by-merchant?${params}`)
    return response.data
  },

  async getSpendingAmountByCategory(dateFrom?: string, dateTo?: string, limit: number = 10): Promise<SpendingAmountByCategoryResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)
    params.append('limit', limit.toString())
    
    const response = await api.get(`/analytics/spending-amount-by-category?${params}`)
    return response.data
  },

  async getSpendingAmountByMerchant(dateFrom?: string, dateTo?: string, limit: number = 10): Promise<SpendingAmountByMerchantResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)
    params.append('limit', limit.toString())
    
    const response = await api.get(`/analytics/spending-amount-by-merchant?${params}`)
    return response.data
  },
}

export default api





















