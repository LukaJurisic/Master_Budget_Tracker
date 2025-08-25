import { useEffect, useState } from "react";
import { PlaidLink, usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";

type LinkTokenResp = { link_token: string };

export default function Sources() {
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<"idle"|"have-token">("idle");
  const [err, setErr] = useState<string | null>(null);

  // 1) Fetch a fresh Link token (must be NEW each session)
  const getToken = async () => {
    setErr(null);
    const r = await fetch("/api/plaid/link-token", { method: "POST" });
    if (!r.ok) {
      const t = await r.text();
      setErr(`link-token failed: ${t}`);
      return;
    }
    const { link_token } = (await r.json()) as LinkTokenResp;
    setToken(link_token);
    setStep("have-token");
  };

  // 2) After we have a token, render the PlaidLink wrapper button
  const onSuccess = async (public_token: string) => {
    const ex = await fetch("/api/plaid/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token }),
    });
    if (!ex.ok) {
      setErr(`exchange failed: ${await ex.text()}`);
      return;
    }

    const r = await fetch("/api/summary/refresh", { method: "POST" }); // pulls txns, writes next_cursor
    console.log("refresh", await r.json());

    setToken(null); // tokens are one-time
    setStep("idle");
    console.log("Plaid Link successful!");
  };

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-3xl font-bold">Data Sources</h1>
      <p className="text-muted-foreground">Connect your bank accounts and upload data files</p>
      
      {step === "idle" && (
        <Button onClick={getToken}>Connect with Plaid</Button>
      )}

      {step === "have-token" && token && (
        <PlaidLink
          token={token}
          onSuccess={onSuccess}
          onEvent={(e) => console.debug("Plaid event", e)}
          onExit={(e) => {
            console.debug("Plaid exit", e);
            // Link tokens are one-time; fetch a NEW token for next attempt
            setStep("idle");
            setToken(null);
          }}
        >
          <Button>Continue linking…</Button>
        </PlaidLink>
      )}

      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  );
}