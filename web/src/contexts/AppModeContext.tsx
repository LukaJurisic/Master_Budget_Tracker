import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AppModeFeatures {
  plaid_enabled: boolean;
  excel_import_enabled: boolean;
  excel_export_enabled: boolean;
  manual_entry_enabled: boolean;
  mapping_studio_enabled: boolean;
  category_management_enabled: boolean;
}

interface DemoConfig {
  show_banner: boolean;
  banner_message: string | null;
}

interface AppModeContextType {
  mode: 'production' | 'demo';
  isDemo: boolean;
  isProduction: boolean;
  features: AppModeFeatures;
  demoConfig: DemoConfig;
  isLoading: boolean;
  error: string | null;
}

const defaultFeatures: AppModeFeatures = {
  plaid_enabled: true,
  excel_import_enabled: true,
  excel_export_enabled: true,
  manual_entry_enabled: true,
  mapping_studio_enabled: true,
  category_management_enabled: true,
};

const defaultDemoConfig: DemoConfig = {
  show_banner: false,
  banner_message: null,
};

const AppModeContext = createContext<AppModeContextType>({
  mode: 'production',
  isDemo: false,
  isProduction: true,
  features: defaultFeatures,
  demoConfig: defaultDemoConfig,
  isLoading: true,
  error: null,
});

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'production' | 'demo'>('production');
  const [features, setFeatures] = useState<AppModeFeatures>(defaultFeatures);
  const [demoConfig, setDemoConfig] = useState<DemoConfig>(defaultDemoConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch app mode from backend
    const fetchAppMode = async () => {
      try {
        const response = await fetch('/api/system/mode');
        if (response.ok) {
          const data = await response.json();
          setMode(data.mode);
          setFeatures(data.features);
          setDemoConfig(data.demo_config);
        } else {
          console.error('Failed to fetch app mode');
          setError('Failed to load app configuration');
        }
      } catch (err) {
        console.error('Error fetching app mode:', err);
        setError('Failed to connect to backend');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppMode();
  }, []);

  const value: AppModeContextType = {
    mode,
    isDemo: mode === 'demo',
    isProduction: mode === 'production',
    features,
    demoConfig,
    isLoading,
    error,
  };

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }
  return context;
}

