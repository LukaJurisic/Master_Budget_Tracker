import { useState, useEffect, useRef } from "react";
import { PlaidLink, usePlaidLink } from "react-plaid-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, RefreshCw, Download, Building2, CreditCard, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { resolveApiOrigin } from "@/lib/runtime";
import { useToast } from "@/components/ui/use-toast";
import { useAppMode } from "@/contexts/AppModeContext";
import { useIsMobile } from "@/hooks/useIsMobile";

interface PlaidAccount {
  id: number;
  plaid_account_id: string;
  name: string;
  mask: string;
  type: string;
  currency: string;
  is_enabled_for_import: boolean;
  institution_name: string;
  institution_item_id: number;
}

interface ImportSession {
  id: number;
  mode: string;
  start_date: string;
  end_date: string;
  created_at: string;
  summary: {
    total: number;
    ready: number;
    needs_category: number;
    excluded: number;
    duplicate: number;
  };
  institution_name: string;
}

function PlaidLinkComponent({ token, onSuccess, onExit, autoOpen }: { 
  token: string; 
  onSuccess: (public_token: string) => void; 
  onExit: () => void;
  autoOpen?: boolean;
}) {
  const hasAutoOpenedRef = useRef(false);
  const config = {
    token,
    onSuccess: (public_token: string, metadata: any) => {
      console.log('Plaid success:', { public_token, metadata });
      onSuccess(public_token);
    },
    onExit: (err: any, metadata: any) => {
      console.log('Plaid exit:', { err, metadata });
      onExit();
    },
    onEvent: (eventName: string, metadata: any) => {
      console.log('Plaid event:', { eventName, metadata });
    },
  };

  const { open, ready, error } = usePlaidLink(config);

  console.log('PlaidLink state:', { ready, error, token: token?.substring(0, 20) });

  useEffect(() => {
    if (!autoOpen || !ready || hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    open();
  }, [autoOpen, ready, open]);

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50">
        <p className="text-red-600">Error loading Plaid: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-blue-50">
      <h3 className="font-medium mb-2">Complete Your Bank Connection</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Click the button below to connect your bank account through Plaid
      </p>
      <Button 
        onClick={open} 
        disabled={!ready}
        className="w-full"
      >
        {ready ? "Complete Bank Connection" : "Loading Plaid..."}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        Token: {token.substring(0, 20)}... | Ready: {ready.toString()}
      </p>
    </div>
  );
}

export default function SourcesEnhanced() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isGettingToken, setIsGettingToken] = useState(false);
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [imports, setImports] = useState<ImportSession[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<"date-range" | "sync">("sync");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [updateLinkToken, setUpdateLinkToken] = useState<string | null>(null);
  const [updateItemId, setUpdateItemId] = useState<number | null>(null);
  const [autoOpenPlaid, setAutoOpenPlaid] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { isDemo, features } = useAppMode();

  const getPlatform = () => {
    const capacitorPlatform = (window as any)?.Capacitor?.getPlatform?.();
    return capacitorPlatform === "ios" || capacitorPlatform === "android"
      ? capacitorPlatform
      : "web";
  };

  useEffect(() => {
    fetchAccounts();
    fetchImports();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isOAuthReturnPath = window.location.pathname === "/plaid/oauth-return";
    const hasOAuthState = params.has("oauth_state_id");

    if (!isOAuthReturnPath || !hasOAuthState) return;
    if (isGettingToken || linkToken) return;

    const resumePlaidOAuth = async () => {
      try {
        setIsGettingToken(true);
        setAutoOpenPlaid(true);

        const response = await fetch("/api/plaid/link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: ["transactions"],
            platform: getPlatform(),
            received_redirect_uri: window.location.href
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to resume Plaid OAuth: ${response.status}`);
        }

        const { link_token } = await response.json();
        setLinkToken(link_token);
      } catch (error) {
        console.error("Plaid OAuth resume error:", error);
        toast({
          title: "OAuth resume failed",
          description: "Could not resume bank connection. Try Connect New Bank again.",
          variant: "destructive"
        });
      } finally {
        setIsGettingToken(false);
      }
    };

    void resumePlaidOAuth();
  }, [isGettingToken, linkToken, toast]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/plaid/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  };

  const fetchImports = async () => {
    try {
      const response = await fetch("/api/plaid/imports");
      if (response.ok) {
        const data = await response.json();
        setImports(data);
      }
    } catch (error) {
      console.error("Failed to fetch imports:", error);
    }
  };

  const getLinkToken = async () => {
    // Prevent multiple simultaneous token requests
    if (isGettingToken || linkToken) {
      return;
    }

    try {
      setIsGettingToken(true);
      console.log('Fetching link token...');
      setAutoOpenPlaid(false);
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: ["transactions"], platform: getPlatform() })
      });
      
      if (response.ok) {
        const { link_token } = await response.json();
        console.log('Got link token');
        setLinkToken(link_token);
      } else {
        throw new Error(`Failed to fetch link token: ${response.status}`);
      }
    } catch (error) {
      console.error('Link token error:', error);
      toast({
        title: "Error",
        description: "Failed to create link token",
        variant: "destructive"
      });
    } finally {
      setIsGettingToken(false);
    }
  };

  const handleSuccess = async (public_token: string) => {
    // Check if we're in update mode (re-authentication)
    const isUpdateMode = updateLinkToken !== null;
    
    if (isUpdateMode) {
      // Update mode: DO NOT call /exchange
      // Plaid internally refreshes the access token; we just need to mark success
      console.log('[UPDATE MODE] Re-authentication successful, skipping /exchange');
      toast({
        title: "Re-authenticated",
        description: "Connection refreshed successfully"
      });
      fetchAccounts();
      setUpdateLinkToken(null);
      setUpdateItemId(null);
      if (window.location.pathname === "/plaid/oauth-return") {
        window.history.replaceState({}, "", "/sources");
      }
      return;
    }
    
    // New connection mode: call /exchange
    try {
      console.log('[CONNECT MODE] Exchanging public token for new connection');
      const response = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: `Connected ${result.accounts.length} accounts successfully`
        });
        fetchAccounts();
        setLinkToken(null);
        if (window.location.pathname === "/plaid/oauth-return") {
          window.history.replaceState({}, "", "/sources");
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to exchange token",
        variant: "destructive"
      });
    }
  };

  const getUpdateLinkToken = async (itemId: number) => {
    try {
      setIsGettingToken(true);
      // Clear any existing link tokens to prevent conflicts
      setLinkToken(null);
      
      console.log(`Fetching update link token for item ${itemId}...`);
      const response = await fetch(`/api/plaid/link-token/update/${itemId}`, {
        method: "POST"
      });
      
      if (response.ok) {
        const { link_token } = await response.json();
        console.log('Got update link token');
        setUpdateLinkToken(link_token);
        setUpdateItemId(itemId);
      } else {
        throw new Error(`Failed to fetch update link token: ${response.status}`);
      }
    } catch (error) {
      console.error('Update link token error:', error);
      toast({
        title: "Error",
        description: "Failed to create update link token",
        variant: "destructive"
      });
    } finally {
      setIsGettingToken(false);
    }
  };

  const toggleAccountImport = async (accountId: number) => {
    try {
      const response = await fetch(`/api/plaid/accounts/${accountId}/toggle-import`, {
        method: "PUT"
      });
      
      if (response.ok) {
        fetchAccounts();
      }
    } catch (error) {
      console.error("Failed to toggle account:", error);
    }
  };

  const API = (p: string) => `${resolveApiOrigin()}${p}`;

  const handleImport = async () => {
    try {
      if (!selectedInstitution) {
        toast({ 
          title: "Select a bank", 
          description: "Choose a connected item first",
          variant: "destructive" 
        });
        return;
      }
      
      setIsLoading(true);
      
      const payload = {
        mode: "sync" as const,
        item_id: String(selectedInstitution),              // MUST be the item_id
        account_ids: selectedAccounts || [],                // optional
        start_date: dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : null,  // optional
        end_date: dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : null
      };
      
      console.log("[IMPORT] payload", payload);

      const r = await fetch(API("/api/plaid/import-transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await r.text();
      console.log("[IMPORT] raw response:", raw);
      let j: any = {};
      try { 
        j = raw ? JSON.parse(raw) : {}; 
      } catch (e) {
        console.error("[IMPORT] Failed to parse JSON:", e);
      }

      if (!r.ok) {
        const msg = j?.detail?.message || j?.detail?.error_message || j?.error_message || raw || "Import failed";
        throw new Error(msg);
      }

      const c = j.counts || {};
      toast({ 
        title: "Import completed", 
        description: `Staged ${c.total ?? 0} • ready ${c.ready ?? 0} • map ${c.needs_category ?? 0} • excluded ${c.excluded ?? 0}` 
      });

      if (!j.import_id) throw new Error("Import succeeded but no import_id in response");
      
      setIsImportModalOpen(false);
      window.location.assign(`/mapping?tab=staging&importId=${encodeURIComponent(j.import_id)}`);
      
    } catch (err: any) {
      console.error("[IMPORT] Error:", err);
      toast({ 
        title: "Import failed", 
        description: err?.message ?? String(err),
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Group accounts by institution
  const accountsByInstitution = accounts.reduce((acc, account) => {
    const key = account.institution_item_id;
    if (!acc[key]) {
      acc[key] = {
        name: account.institution_name,
        accounts: []
      };
    }
    acc[key].accounts.push(account);
    return acc;
  }, {} as Record<number, { name: string; accounts: PlaidAccount[] }>);

  return (
    <div className={isMobile ? "space-y-4" : "space-y-6"}>
      <div className={isMobile ? "flex flex-col gap-3" : "flex items-center justify-between"}>
        <div>
          <h1 className={isMobile ? "text-2xl font-bold" : "text-3xl font-bold"}>Data Sources</h1>
          <p className="text-muted-foreground">
            Connect your bank accounts and manage data imports
          </p>
        </div>
        <div className={isMobile ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
          {accounts.length > 0 && (
            <Button 
              onClick={() => {
                // Pre-select all enabled accounts across all institutions
                const allEnabledAccounts = accounts
                  .filter(acc => acc.is_enabled_for_import)
                  .map(acc => acc.plaid_account_id);
                setSelectedAccounts(allEnabledAccounts);
                setImportMode("sync");
                setIsImportModalOpen(true);
              }}
              variant="default"
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Import All
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    onClick={getLinkToken} 
                    disabled={isGettingToken || !!linkToken || !features.plaid_enabled}
                    className="w-full"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    {isGettingToken ? "Getting Token..." : linkToken ? "Token Ready" : "Connect New Bank"}
                  </Button>
                </span>
              </TooltipTrigger>
              {isDemo && !features.plaid_enabled && (
                <TooltipContent>
                  <p>🎭 Demo Mode: Bank connections are disabled</p>
                  <p className="text-xs text-muted-foreground">View existing demo accounts below</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Ensure only ONE PlaidLink instance renders at a time */}
      {updateLinkToken && updateItemId ? (
        <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900 mb-1">Re-authentication Required</h3>
              <p className="text-sm text-amber-800 mb-3">
                Your bank connection needs to be updated. This happens when your login credentials change or when additional verification is required.
              </p>
              <PlaidLinkComponent 
                token={updateLinkToken} 
                onSuccess={handleSuccess} 
                onExit={() => {
                  setUpdateLinkToken(null);
                  setUpdateItemId(null);
                }} 
                autoOpen={autoOpenPlaid}
              />
            </div>
          </div>
        </div>
      ) : linkToken ? (
        <PlaidLinkComponent
          token={linkToken}
          onSuccess={handleSuccess}
          onExit={() => setLinkToken(null)}
          autoOpen={autoOpenPlaid}
        />
      ) : null}

      {/* Connected Accounts */}
      <div className="space-y-4">
        {Object.entries(accountsByInstitution).map(([itemId, institution]) => (
          <Card key={itemId}>
            <CardHeader>
              <div className={isMobile ? "flex flex-col gap-3" : "flex items-center justify-between"}>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {institution.name}
                </CardTitle>
                <div className={isMobile ? "grid grid-cols-1 gap-2" : "grid grid-cols-3 gap-2"}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => getUpdateLinkToken(Number(itemId))}
                    disabled={isGettingToken}
                    title="Re-authenticate this bank connection"
                    className="w-full"
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Re-authenticate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Pre-select only this institution's enabled accounts
                      const institutionAccounts = institution.accounts
                        .filter(acc => acc.is_enabled_for_import)
                        .map(acc => acc.plaid_account_id);
                      setSelectedAccounts(institutionAccounts);
                      setImportMode("sync");
                      setIsImportModalOpen(true);
                    }}
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync New
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Pre-select only this institution's enabled accounts
                      const institutionAccounts = institution.accounts
                        .filter(acc => acc.is_enabled_for_import)
                        .map(acc => acc.plaid_account_id);
                      setSelectedAccounts(institutionAccounts);
                      setImportMode("date-range");
                      setIsImportModalOpen(true);
                    }}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Import Range
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {institution.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <CreditCard className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ****{account.mask} • {account.type}
                        </p>
                        </div>
                      </div>
                      {!isMobile && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Include in imports
                          </span>
                          <Switch
                            checked={account.is_enabled_for_import}
                            onCheckedChange={() => toggleAccountImport(account.id)}
                          />
                        </div>
                      )}
                    </div>
                    {isMobile && (
                      <div className="mt-3 flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Include in imports</span>
                        <Switch
                          checked={account.is_enabled_for_import}
                          onCheckedChange={() => toggleAccountImport(account.id)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Imports */}
      {imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {imports.slice(0, 5).map((imp) => (
                <div
                  key={imp.id}
                  className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent"
                  onClick={() => window.location.href = `/mapping?tab=staging&importId=${encodeURIComponent(imp.id)}`}
                >
                  <div className={isMobile ? "flex flex-col gap-2" : "flex items-center justify-between"}>
                    <p className="truncate font-medium">
                      {imp.institution_name} - {imp.mode === "sync" ? "Sync" : "Manual Import"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(imp.created_at).toLocaleDateString()}
                      {imp.start_date && imp.end_date && 
                        ` • ${imp.start_date} to ${imp.end_date}`
                      }
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {imp.summary.needs_category > 0 && (
                      <Badge variant="secondary">
                        {imp.summary.needs_category} need category
                      </Badge>
                    )}
                    {imp.summary.ready > 0 && (
                      <Badge variant="default">
                        {imp.summary.ready} ready
                      </Badge>
                    )}
                    {imp.summary.excluded > 0 && (
                      <Badge variant="outline">
                        {imp.summary.excluded} excluded
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
        setIsImportModalOpen(open);
        if (!open) {
          setSelectedInstitution(null);
          setSelectedAccounts([]);
          setShowAccountSelection(false);
        }
      }}>
        <DialogContent className={isMobile ? "w-[calc(100vw-1.25rem)] max-w-[600px] p-4" : "max-w-[600px] p-6"}>
          <DialogHeader>
            <DialogTitle>
              Import Transactions
            </DialogTitle>
            <DialogDescription>
              Select banks and accounts to import transactions from
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Import Mode Selection */}
            <div className={isMobile ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
              <Button
                variant={importMode === "sync" ? "default" : "outline"}
                onClick={() => setImportMode("sync")}
                className="w-full"
              >
                Sync New
              </Button>
              <Button
                variant={importMode === "date-range" ? "default" : "outline"}
                onClick={() => setImportMode("date-range")}
                className="w-full"
              >
                Date Range
              </Button>
            </div>

            {/* Date Range Selection */}
            {importMode === "date-range" && (
              <div className={isMobile ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, "PPP") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, "PPP") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Master Selection Controls */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className={isMobile ? "flex flex-col gap-2" : "flex items-center justify-between"}>
              <span className="text-sm font-medium">Select Accounts to Import</span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Select all enabled accounts across all institutions
                    const allEnabledAccounts = accounts
                      .filter(acc => acc.is_enabled_for_import)
                      .map(acc => acc.plaid_account_id);
                    setSelectedAccounts(allEnabledAccounts);
                  }}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAccounts([])}
                >
                  Clear All
                </Button>
              </div>
              </div>
            </div>

            {/* Accounts by Institution */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {Object.entries(accountsByInstitution).map(([itemId, institution]) => {
                const enabledAccounts = institution.accounts.filter(acc => acc.is_enabled_for_import);
                const institutionSelected = enabledAccounts.every(acc => 
                  selectedAccounts.includes(acc.plaid_account_id)
                );
                const institutionPartiallySelected = enabledAccounts.some(acc => 
                  selectedAccounts.includes(acc.plaid_account_id)
                ) && !institutionSelected;

                return (
                  <div key={itemId} className="space-y-2 p-3 rounded-lg border">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`institution-${itemId}`}
                        checked={institutionSelected}
                        indeterminate={institutionPartiallySelected}
                        onCheckedChange={(checked) => {
                          const institutionAccountIds = enabledAccounts.map(acc => acc.plaid_account_id);
                          if (checked) {
                            setSelectedAccounts(prev => [...new Set([...prev, ...institutionAccountIds])]);
                          } else {
                            setSelectedAccounts(prev => prev.filter(id => !institutionAccountIds.includes(id)));
                          }
                        }}
                      />
                      <label
                        htmlFor={`institution-${itemId}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {institution.name}
                      </label>
                    </div>
                    <div className="ml-6 space-y-2">
                      {enabledAccounts.map((account) => (
                        <div key={account.plaid_account_id} className="flex items-center space-x-2">
                          <Checkbox
                            id={account.plaid_account_id}
                            checked={selectedAccounts.includes(account.plaid_account_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAccounts([...selectedAccounts, account.plaid_account_id]);
                              } else {
                                setSelectedAccounts(selectedAccounts.filter(id => id !== account.plaid_account_id));
                              }
                            }}
                          />
                          <label
                            htmlFor={account.plaid_account_id}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {account.name} (****{account.mask})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Message */}
            <div className="text-sm text-muted-foreground">
              {selectedAccounts.length === 0 
                ? "No accounts selected. All enabled accounts will be imported."
                : `${selectedAccounts.length} account${selectedAccounts.length === 1 ? '' : 's'} selected for import`
              }
            </div>
          </div>

          <DialogFooter className={isMobile ? "flex-col gap-2" : "flex-row"}>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)} className={isMobile ? "w-full" : "w-auto"}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                // Handle multiple institutions in a single import session
                if (selectedAccounts.length === 0) {
                  toast({ 
                    title: "No accounts selected", 
                    description: "Please select at least one account to import",
                    variant: "destructive" 
                  });
                  return;
                }

                // Group selected accounts by institution
                const institutionGroups = new Map<number, string[]>();
                accounts
                  .filter(acc => selectedAccounts.includes(acc.plaid_account_id))
                  .forEach(acc => {
                    if (!institutionGroups.has(acc.institution_item_id)) {
                      institutionGroups.set(acc.institution_item_id, []);
                    }
                    institutionGroups.get(acc.institution_item_id)?.push(acc.plaid_account_id);
                  });

                setIsLoading(true);

                try {
                  // Build items array for multi-import
                  const items = Array.from(institutionGroups.entries()).map(([itemId, accountIds]) => ({
                    item_id: itemId,
                    account_ids: accountIds
                  }));

                  const payload = {
                    mode: importMode === "date-range" ? "get" : "sync",
                    items: items,
                    start_date: importMode === "date-range" && dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : null,
                    end_date: importMode === "date-range" && dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : null
                  };

                  console.log("[MULTI-IMPORT] payload", payload);

                  const r = await fetch(API("/api/plaid/import-multi"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  const raw = await r.text();
                  console.log("[MULTI-IMPORT] raw response:", raw);
                  let j: any = {};
                  try { 
                    j = raw ? JSON.parse(raw) : {}; 
                  } catch (e) {
                    console.error("[MULTI-IMPORT] Failed to parse JSON:", e);
                  }

                  if (!r.ok) {
                    const msg = j?.detail?.message || j?.detail?.error_message || j?.error_message || raw || "Import failed";
                    throw new Error(msg);
                  }

                  const c = j.counts || {};
                  const institutions = j.institutions || [];
                  toast({ 
                    title: "Import completed", 
                    description: `Staged ${c.total ?? 0} transactions from ${institutions.length} institution${institutions.length === 1 ? '' : 's'} • Ready: ${c.ready ?? 0} • Need mapping: ${c.needs_category ?? 0}` 
                  });

                  if (!j.import_id) throw new Error("Import succeeded but no import_id in response");
                  
                  setIsImportModalOpen(false);
                  window.location.assign(`/mapping?tab=staging&importId=${encodeURIComponent(j.import_id)}`);
                  
                } catch (err: any) {
                  console.error("[MULTI-IMPORT] Error:", err);
                  toast({ 
                    title: "Import failed", 
                    description: err?.message ?? String(err),
                    variant: "destructive" 
                  });
                } finally {
                  setIsLoading(false);
                }
              }} 
              disabled={isLoading || selectedAccounts.length === 0}
              className={isMobile ? "w-full" : "w-auto"}
            >
              {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Import Selected Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
