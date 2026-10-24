import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { CategoryBar } from '../components/CategoryBar';
import { CompanyCard } from '../components/CompanyCard';
import { AddCompaniesModal } from '../components/AddCompaniesModal';
import { EditCompanyModal } from '../components/EditCompanyModal';
import { AdminModal } from '../components/AdminModal';
import { Company, CategoryFacet, CountryFacet, BatchAddResult, SortOption } from '../types';
import {
  Briefcase,
  Plus,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FilterX,
  ArrowUpDown,
  Download,
  Globe,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<CategoryFacet[]>([]);
  const [countries, setCountries] = useState<CountryFacet[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [userTotalCount, setUserTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Fetch companies based on filters
  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedCategory !== 'All') params.set('category', selectedCategory);
      if (selectedCountry !== 'All') params.set('country', selectedCountry);
      if (favoritesOnly) params.set('favoritesOnly', 'true');
      if (sortBy !== 'default') params.set('sortBy', sortBy);
      params.set('page', String(page));
      params.set('limit', '60');

      const res = await fetch(`/api/companies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
        setTotalCount(data.totalCount || 0);
        setUserTotalCount(data.userTotalCount || 0);
        setCategories(data.categories || []);
        setCountries(data.countries || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedCountry, favoritesOnly, sortBy, page]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Reset to page 1 when filter or sort changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, selectedCountry, favoritesOnly, sortBy]);

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    // Optimistic update
    setCompanies((prev) =>
      prev.map((c) => (c._id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    );

    try {
      const res = await fetch(`/api/companies/${id}/favorite`, { method: 'PATCH' });
      if (!res.ok) {
        // Revert on failure
        fetchCompanies();
      }
    } catch {
      fetchCompanies();
    }
  };

  // Toggle pin
  const handleTogglePin = async (id: string) => {
    // Optimistic update
    setCompanies((prev) => {
      const updated = prev.map((c) => (c._id === id ? { ...c, isPinned: !c.isPinned } : c));
      // Re-sort: pinned first
      return [...updated].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    });

    try {
      const res = await fetch(`/api/companies/${id}/pin`, { method: 'PATCH' });
      if (!res.ok) {
        fetchCompanies();
      }
    } catch {
      fetchCompanies();
    }
  };

  // Delete company
  const handleDeleteCompany = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from your directory?`)) {
      return;
    }

    setCompanies((prev) => prev.filter((c) => c._id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    setUserTotalCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      fetchCompanies();
    } catch {
      fetchCompanies();
    }
  };

  // Callback when batch add completes
  const handleBatchSuccess = (_result: BatchAddResult) => {
    fetchCompanies();
  };

  // Callback when company edit succeeds
  const handleEditSuccess = (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    fetchCompanies();
  };

  // Download CSV of all companies with tags
  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/companies/export');
      if (!res.ok) {
        throw new Error('Failed to export companies from server');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'companies.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export download error, falling back to loaded records:', err);
      if (companies.length > 0) {
        const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
        const headers = [
          'Company Name',
          'Careers URL',
          'Tags',
          'Country',
          'Country Code',
          'Package',
          'Hiring Difficulty',
          'Verified',
        ];
        const rows = companies.map((c) => [
          escapeCsv(c.name),
          escapeCsv(c.careersUrl),
          escapeCsv((c.categories || []).join(', ')),
          escapeCsv(c.country || ''),
          escapeCsv(c.countryCode || ''),
          escapeCsv(c.packageText || ''),
          escapeCsv(c.hiringDifficulty || ''),
          escapeCsv(c.isVerified ? 'Yes' : 'No'),
        ]);
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'companies.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      
      {/* Top Navbar */}
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        favoritesOnly={favoritesOnly}
        setFavoritesOnly={setFavoritesOnly}
        totalCount={userTotalCount}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
      />

      {/* Category Filter Pills Bar */}
      {categories.length > 0 && (
        <CategoryBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          totalCompanies={userTotalCount}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Loading State */}
        {isLoading && companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
            <p className="text-sm font-medium">Loading your company career directory...</p>
          </div>
        ) : userTotalCount === 0 ? (
          /* Empty Directory Onboarding State */
          <div className="max-w-md mx-auto my-12 text-center p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Your Company Directory is Empty
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Paste comma-separated company names (like Google, Apple, Microsoft) and Gemini AI will automatically discover official careers pages and categories.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Companies</span>
            </button>
          </div>
        ) : (
          /* Directory Content Area */
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Showing{' '}
                <strong className="text-slate-700 dark:text-slate-200 font-semibold">
                  {companies.length}
                </strong>{' '}
                of {totalCount} {totalCount === 1 ? 'company' : 'companies'}
                {selectedCategory !== 'All' && ` in "${selectedCategory}"`}
                {selectedCountry !== 'All' && ` from "${selectedCountry}"`}
                {favoritesOnly && ' (Favorites only)'}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {favoritesOnly && (
                  <button
                    onClick={() => setFavoritesOnly(false)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium mr-1"
                  >
                    Show all
                  </button>
                )}

                {/* Country Filter Selector */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-xs">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <label htmlFor="country-select" className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                    Country:
                  </label>
                  <select
                    id="country-select"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="All" className="dark:bg-slate-900">All Countries</option>
                    {countries.map((c) => (
                      <option key={c.name} value={c.name} className="dark:bg-slate-900">
                        {c.name} ({c.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Dropdown Selector */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <label htmlFor="sort-select" className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                    Sort:
                  </label>
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="default" className="dark:bg-slate-900">Default (Pinned & Recent)</option>
                    <option value="high-package" className="dark:bg-slate-900">💰 Highest Packages</option>
                    <option value="popular" className="dark:bg-slate-900">🔥 Most Popular</option>
                    <option value="least-popular" className="dark:bg-slate-900">🧭 Least Popular / Hidden Gems</option>
                    <option value="easy-offer" className="dark:bg-slate-900">🎯 Easy to Get an Offer</option>
                  </select>
                </div>

                {/* Download CSV Button */}
                <button
                  id="download-csv-btn"
                  onClick={handleDownloadCSV}
                  disabled={isDownloading || userTotalCount === 0}
                  className="flex items-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-xs text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
                  title="Download CSV of all companies with tags"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>Download CSV</span>
                </button>
              </div>
            </div>

            {companies.length === 0 ? (
              /* Filtered No Results State */
              <div className="max-w-sm mx-auto my-16 text-center p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <FilterX className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  No matching companies found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Try adjusting your search query, category filter, country filter, or favorites toggle.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedCountry('All');
                    setFavoritesOnly(false);
                    setSortBy('default');
                  }}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {companies.map((company) => (
                    <CompanyCard
                      key={company._id}
                      company={company}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      onEdit={(comp) => setEditingCompany(comp)}
                      onDelete={handleDeleteCompany}
                      onCategoryClick={(cat) => setSelectedCategory(cat)}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8 py-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-2">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Add Companies Modal */}
      <AddCompaniesModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleBatchSuccess}
      />

      {/* Edit Company Modal */}
      <EditCompanyModal
        isOpen={Boolean(editingCompany)}
        company={editingCompany}
        onClose={() => setEditingCompany(null)}
        onSuccess={handleEditSuccess}
      />

      {/* Administrator Controls Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

    </div>
  );
};
