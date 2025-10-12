import { AlertCircle } from 'lucide-react';
import { useAppMode } from '@/contexts/AppModeContext';

export function DemoModeBanner() {
  const { isDemo, demoConfig } = useAppMode();

  if (!isDemo || !demoConfig.show_banner) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 border-b border-purple-700 shadow-sm">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-white">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            {demoConfig.banner_message || '🎭 Demo Mode - Viewing sample data'}
          </span>
          <span className="text-xs opacity-90 ml-2">
            All data is fake for demonstration purposes
          </span>
        </div>
      </div>
    </div>
  );
}

