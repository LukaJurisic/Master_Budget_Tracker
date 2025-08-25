import { useState, useEffect } from "react";
import { PlaidLink, usePlaidLink } from "react-plaid-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, RefreshCw, Download, Building2, CreditCard, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

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

function PlaidLinkComponent({ token, onSuccess, onExit }: { 
  token: string; 
  onSuccess: (public_token: string) => void; 
  onExit: () => void;
}) {
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
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    fetchImports();
  }, []);

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
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: ["transactions"] })
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
    try {
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
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to exchange token",
        variant: "destructive"
      });
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

  const API = (p: string) => `${import.meta.env.VITE_API_URL ?? ""}${p}`;

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Sources</h1>
          <p className="text-muted-foreground">
            Connect your bank accounts and manage data imports
          </p>
        </div>
        <Button onClick={getLinkToken} disabled={isGettingToken || !!linkToken}>
          <Building2 className="mr-2 h-4 w-4" />
          {isGettingToken ? "Getting Token..." : linkToken ? "Token Ready" : "Connect New Bank"}
        </Button>
      </div>

      {linkToken && <PlaidLinkComponent token={linkToken} onSuccess={handleSuccess} onExit={() => setLinkToken(null)} />}

      {/* Debug info */}
      <div className="text-xs text-muted-foreground">
        Debug: linkToken = {linkToken ? 'SET' : 'NULL'}, isGettingToken = {isGettingToken.toString()}
      </div>

      {/* Connected Accounts */}
      <div className="space-y-4">
        {Object.entries(accountsByInstitution).map(([itemId, institution]) => (
          <Card key={itemId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {institution.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedInstitution(Number(itemId));
                      setImportMode("sync");
                      setIsImportModalOpen(true);
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync New
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedInstitution(Number(itemId));
                      setImportMode("date-range");
                      setIsImportModalOpen(true);
                    }}
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
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ****{account.mask} • {account.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Include in imports
                      </span>
                      <Switch
                        checked={account.is_enabled_for_import}
                        onCheckedChange={() => toggleAccountImport(account.id)}
                      />
                    </div>
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
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                  onClick={() => window.location.href = `/mapping-studio?import=${imp.id}&tab=staging`}
                >
                  <div>
                    <p className="font-medium">
                      {imp.institution_name} - {imp.mode === "sync" ? "Sync" : "Manual Import"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(imp.created_at).toLocaleDateString()}
                      {imp.start_date && imp.end_date && 
                        ` • ${imp.start_date} to ${imp.end_date}`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {importMode === "sync" ? "Sync New Transactions" : "Import by Date Range"}
            </DialogTitle>
            <DialogDescription>
              {importMode === "sync" 
                ? "Fetch new transactions since the last sync"
                : "Import transactions for a specific date range"
              }
            </DialogDescription>
          </DialogHeader>

          {importMode === "date-range" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal flex-1",
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
                        "justify-start text-left font-normal flex-1",
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
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Account Filter (optional)</label>
            <div className="space-y-2">
              {selectedInstitution && accountsByInstitution[selectedInstitution]?.accounts
                .filter(acc => acc.is_enabled_for_import)
                .map((account) => (
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
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {account.name} (****{account.mask})
                    </label>
                  </div>
                ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {importMode === "sync" ? "Sync Transactions" : "Import Transactions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}