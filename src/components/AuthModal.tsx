import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Lock,
  User as UserIcon,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const AuthModal: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [isInitialSetup, setIsInitialSetup] = useState(false);

  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Check public registration setting
  useEffect(() => {
    fetch('/api/auth/registration-status')
      .then((res) => res.json())
      .then((data) => {
        setRegistrationEnabled(data.registrationEnabled);
        setIsInitialSetup(Boolean(data.isInitialSetup));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    if (!isLoginMode) {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isLoginMode) {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, confirmPassword);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative">
      
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 items-center justify-center text-white shadow-lg shadow-brand-500/25 mb-3">
            <Briefcase className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Company Career Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            AI-powered official job portals and verified company career links
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
          
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(true);
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isLoginMode
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(false);
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isLoginMode
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Initial Setup Notification */}
          {!isLoginMode && isInitialSetup && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>Initial Setup: The first registered account automatically becomes the Administrator.</span>
            </div>
          )}

          {/* Registration Disabled Notice */}
          {!isLoginMode && !registrationEnabled && !isInitialSetup && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Public self-registration is currently disabled by administrator. Please use the credentials provided to you.
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  required
                  autoComplete="username"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
                />
              </div>
            </div>

            {!isLoginMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (!isLoginMode && !registrationEnabled && !isInitialSetup)}
              className="w-full py-2.5 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isLoginMode ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{isLoginMode ? 'Sign In to Directory' : 'Create Free Account'}</span>
              )}
            </button>
          </form>

        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Private, secure & AI-accelerated company career directory
        </p>

      </div>
    </div>
  );
};
