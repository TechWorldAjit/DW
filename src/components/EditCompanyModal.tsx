import React, { useState, useEffect } from 'react';
import { X, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { Company } from '../types';

interface EditCompanyModalProps {
  isOpen: boolean;
  company: Company | null;
  onClose: () => void;
  onSuccess: (updated: Company) => void;
}

export const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  isOpen,
  company,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (company) {
      setName(company.name);
      setCareersUrl(company.careersUrl || '');
      setCategoriesInput(company.categories?.join(', ') || '');
      setErrorMessage('');
    }
  }, [company]);

  if (!isOpen || !company) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Company name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const categories = categoriesInput
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    try {
      const res = await fetch(`/api/companies/${company._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          careersUrl: careersUrl.trim(),
          categories,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update company');
      }

      onSuccess(data.company);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating company');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Edit Company Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Official Careers Page URL
            </label>
            <input
              type="url"
              value={careersUrl}
              onChange={(e) => setCareersUrl(e.target.value)}
              placeholder="https://careers.company.com"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Provide the direct official careers page for job seekers.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Categories (comma separated)
            </label>
            <input
              type="text"
              value={categoriesInput}
              onChange={(e) => setCategoriesInput(e.target.value)}
              placeholder="Technology, Software, Product-Based"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              e.g. Technology, Hardware, Automobile, Food, Finance
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
