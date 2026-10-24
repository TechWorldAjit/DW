import React from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Star,
  Sun,
  Moon,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (val: boolean | ((prev: boolean) => boolean)) => void;
  totalCount: number;
  onOpenAddModal: () => void;
  onOpenAdminModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  setSearchQuery,
  favoritesOnly,
  setFavoritesOnly,
  totalCount,
  onOpenAddModal,
  onOpenAdminModal,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          
          {/* Logo & App Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Company Career Directory
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                AI-Powered Verified Career Portals
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-md mx-2 relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies or categories..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg border border-transparent focus:border-brand-500 dark:focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Total count badge */}
            <div className="hidden lg:flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="text-brand-600 dark:text-brand-400 font-bold mr-1">{totalCount}</span> companies
            </div>

            {/* Favorites Toggle */}
            <button
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={`p-2 sm:px-3 sm:py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                favoritesOnly
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
              title={favoritesOnly ? 'Showing Favorites Only' : 'Filter by Favorites'}
            >
              <Star
                className={`w-4 h-4 ${favoritesOnly ? 'fill-current' : 'text-amber-500'}`}
              />
              <span className="hidden md:inline">Favorites</span>
            </button>

            {/* Add Companies Button */}
            <button
              onClick={onOpenAddModal}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/30 flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Companies</span>
            </button>

            {/* Admin Panel button if role === 'admin' */}
            {user?.role === 'admin' && (
              <button
                onClick={onOpenAdminModal}
                className="p-2 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1 transition-all"
                title="Administrator Controls"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden lg:inline">Admin</span>
              </button>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* User profile & Logout */}
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[100px] truncate hidden sm:inline" title={user?.username}>
                {user?.username}
              </span>
              <button
                onClick={logout}
                className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
