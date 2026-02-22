function hasCapacitorNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  if (!cap) return false;

  if (typeof cap.isNativePlatform === "function") {
    return cap.isNativePlatform();
  }

  const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : cap.platform;
  return !!platform && platform !== "web";
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function normalizeApiOrigin(url: string): string {
  const cleaned = stripTrailingSlash(url.trim());
  if (cleaned.endsWith("/api")) {
    return cleaned.slice(0, -4);
  }
  return cleaned;
}

export function resolveApiOrigin(): string {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) {
    return normalizeApiOrigin(envUrl);
  }

  // Android emulator reaches host machine via 10.0.2.2
  if (hasCapacitorNativeRuntime()) {
    return "http://10.0.2.2:8000";
  }

  return "http://localhost:8000";
}

export function resolveApiBaseUrl(): string {
  const origin = resolveApiOrigin();
  if (!origin) return "/api";
  return `${origin}/api`;
}

export function rewriteApiUrlForNative(inputUrl: string): string {
  const origin = resolveApiOrigin();
  if (!origin) return inputUrl;

  try {
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const parsed = new URL(inputUrl, currentOrigin);
    if (parsed.pathname === "/api" || parsed.pathname.startsWith("/api/")) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Fall through and return original input
  }

  return inputUrl;
}

export function resolveAppKey(): string {
  return import.meta.env.VITE_APP_KEY?.trim() ?? "";
}
