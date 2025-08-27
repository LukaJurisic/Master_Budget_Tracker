import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  CreditCard, 
  Target, 
  Upload, 
  Settings,
  Menu,
  X,
  TrendingUp,
  BarChart3,
  Wallet
} from 'lucide-react'

// Pages
import Dashboard from './pages/Dashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import Transactions from './pages/Transactions'
import MappingStudio from './pages/MappingStudio'
import SourcesEnhanced from './pages/SourcesEnhanced'
import Budgets from './pages/Budgets'
import ItemInspector from './pages/ItemInspector'
import Income from './pages/Income'
import BalancesPage from './pages/BalancesPage'

// Components
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Toaster } from './components/ui/toaster'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Balances', href: '/balances', icon: Wallet },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Income', href: '/income', icon: TrendingUp },
  { name: 'Mapping Studio', href: '/mapping', icon: Settings },
  { name: 'Sources', href: '/sources', icon: Upload },
  { name: 'Budgets', href: '/budgets', icon: Target },
  { name: 'Debug', href: '/debug', icon: Settings },
]

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h1 className="text-xl font-bold text-gray-900">Budget Tracker</h1>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <nav className="mt-6 px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg mb-1 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5",
                    isActive ? "text-primary-foreground" : "text-gray-500"
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="flex-1 lg:flex lg:items-center lg:justify-between">
              <div className="hidden lg:block">
                <h2 className="text-lg font-semibold text-gray-900">
                  {navigation.find(item => item.href === location.pathname)?.name || 'Budget Tracker'}
                </h2>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/balances" element={<BalancesPage />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/income" element={<Income />} />
                <Route path="/mapping" element={<MappingStudio />} />
                <Route path="/mapping/:importId" element={<MappingStudio />} />
                <Route path="/sources" element={<SourcesEnhanced />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/debug" element={<ItemInspector />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  )
}

export default App
