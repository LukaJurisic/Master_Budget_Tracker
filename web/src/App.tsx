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
  Wallet,
  MoreHorizontal
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
import { Toaster } from './components/ui/toaster'
import { DemoModeBanner } from './components/DemoModeBanner'
import { AppModeProvider } from './contexts/AppModeContext'

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

const mobileNavigation = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Txns', href: '/transactions', icon: CreditCard },
  { name: 'Map', href: '/mapping', icon: Settings },
  { name: 'Budgets', href: '/budgets', icon: Target },
  { name: 'More', href: '/sources', icon: MoreHorizontal },
]

function isActiveRoute(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const currentPageName =
    navigation.find((item) => isActiveRoute(location.pathname, item.href))?.name || 'Budget Tracker'

  return (
    <AppModeProvider>
      <DemoModeBanner />
      <div className="safe-area-top flex h-[100dvh] bg-gray-50">
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
            const isActive = isActiveRoute(location.pathname, item.href)
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
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 lg:py-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1 px-2 lg:px-0 lg:flex lg:items-center lg:justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900 sm:text-base lg:text-lg">
                {currentPageName}
              </h2>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="py-3 lg:py-6">
            <div className="mx-auto max-w-7xl px-3 sm:px-6">
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

        {/* Mobile bottom navigation */}
        <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {mobileNavigation.map((item) => {
              const isActive = isActiveRoute(location.pathname, item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "mx-1 my-1 flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                    isActive ? "bg-blue-50 text-primary" : "text-gray-500 hover:bg-gray-100"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mb-0.5 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
      <Toaster />
    </div>
    </AppModeProvider>
  )
}

export default App
