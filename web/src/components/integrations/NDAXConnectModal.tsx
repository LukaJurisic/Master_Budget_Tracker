import { useState } from 'react'
import { X, Shield, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'

interface NDAXConnectModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NDAXConnectModal({ open, onClose, onSuccess }: NDAXConnectModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [uid, setUid] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)
  const { toast } = useToast()

  const handleTest = async () => {
    if (!apiKey || !apiSecret || !uid || !login || !password) {
      setError('Please fill in all required fields: API Key, API Secret, UID, Email, and Password')
      return
    }

    setTesting(true)
    setError(null)
    setTestSuccess(false)

    try {
      // First connect
      const connectResponse = await fetch('/api/integrations/ndax/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          uid: uid,
          login: login,
          password: password,
          label: label || 'NDAX Exchange',
        }),
      })

      const connectData = await connectResponse.json()

      if (!connectResponse.ok) {
        throw new Error(connectData.detail || 'Connection failed')
      }

      // Then test with the same credentials
      const testResponse = await fetch('/api/integrations/ndax/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          uid: uid,
          login: login,
          password: password,
        }),
      })

      const testData = await testResponse.json()

      if (!testResponse.ok || !testData.success) {
        throw new Error(testData.message || 'Test failed')
      }

      setTestSuccess(true)
      toast({
        title: 'Connection Successful',
        description: 'NDAX API credentials are valid and working.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
      setTestSuccess(false)
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    if (!apiKey || !apiSecret) {
      setError('Please enter both API Key and API Secret')
      return
    }

    if (!testSuccess) {
      setError('Please test the connection first')
      return
    }

    setConnecting(true)
    setError(null)

    try {
      // Connection already saved during test
      // Just refresh balances
      const refreshResponse = await fetch('/api/integrations/ndax/refresh', {
        method: 'POST',
      })

      const refreshData = await refreshResponse.json()

      if (!refreshResponse.ok) {
        throw new Error(refreshData.detail || 'Refresh failed')
      }

      toast({
        title: 'NDAX Connected',
        description: `Successfully connected and fetched ${refreshData.totals?.assets_count || 0} assets.`,
      })

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleClose = () => {
    setApiKey('')
    setApiSecret('')
    setUid('')
    setLogin('')
    setPassword('')
    setLabel('')
    setError(null)
    setTestSuccess(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect NDAX Exchange</DialogTitle>
          <DialogDescription>
            Connect your NDAX account to track crypto balances. Your API credentials are encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Use read-only API keys for security. Never share your API secret with anyone.
            </AlertDescription>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="text"
              placeholder="Enter your NDAX API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={testing || connecting}
            />
          </div>

          {/* API Secret Input */}
          <div className="space-y-2">
            <Label htmlFor="api-secret">API Secret</Label>
            <Input
              id="api-secret"
              type="password"
              placeholder="Enter your NDAX API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              disabled={testing || connecting}
            />
          </div>

          {/* UID Input */}
          <div className="space-y-2">
            <Label htmlFor="uid">User ID (UID)</Label>
            <Input
              id="uid"
              type="text"
              placeholder="Enter your NDAX User ID (numeric)"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              disabled={testing || connecting}
            />
          </div>

          {/* Login Input */}
          <div className="space-y-2">
            <Label htmlFor="login">Email</Label>
            <Input
              id="login"
              type="email"
              placeholder="Enter your NDAX account email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={testing || connecting}
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your NDAX account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={testing || connecting}
            />
          </div>

          {/* Optional Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              type="text"
              placeholder="e.g., Main Account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={testing || connecting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {testSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Connection test successful! You can now connect your account.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || connecting || !apiKey || !apiSecret}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <div className="space-x-2">
            <Button variant="ghost" onClick={handleClose} disabled={connecting}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={!testSuccess || connecting}
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}