import React from 'react';
import { useAuth } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { AuthModal } from './components/AuthModal';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Company Career Directory
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return <Dashboard />;
};

export default App;
