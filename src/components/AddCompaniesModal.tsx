import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Layers,
} from 'lucide-react';
import { BatchAddResult } from '../types';

interface AddCompaniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: BatchAddResult) => void;
}

const SAMPLE_COMPANIES =
  'Google, Microsoft, Apple, Amazon, Adobe, NVIDIA, Samsung, Spotify, Netflix, Meta, Salesforce, Intel, Stripe, Airbnb, Uber';

export const AddCompaniesModal: React.FC<AddCompaniesModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultSummary, setResultSummary] = useState<BatchAddResult | null>(null);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setInputText(SAMPLE_COMPANIES);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      setErrorMessage('Please enter at least one company name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setResultSummary(null);

    try {
      const res = await fetch('/api/companies/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: inputText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process companies');
      }

      setResultSummary(data);
      onSuccess(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    setInputText('');
    setResultSummary(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Companies
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gemini AI will discover official careers pages & assign categories
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {resultSummary ? (
            /* Results Screen */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Import Completed Successfully</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {resultSummary.message}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {resultSummary.submittedCount}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Submitted</div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {resultSummary.addedCount}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Added New</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-xl font-bold text-slate-600 dark:text-slate-300">
                    {resultSummary.skippedDuplicatesCount}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Duplicates Skipped</div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {resultSummary.needsReviewCount}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300">Needs Review</div>
                </div>
              </div>

              {resultSummary.addedCompanies.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Newly Added Cards
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {resultSummary.addedCompanies.map((c) => (
                      <div
                        key={c._id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate mr-2">
                          {c.name}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                            {c.categories?.[0] || 'Tech'}
                          </span>
                          {c.isVerified ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Verified
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Unverified
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all"
                >
                  Done & View Directory
                </button>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Paste Company Names (comma or line-break separated)
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteSample}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Insert Example List</span>
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Google, Microsoft, Apple, Amazon, Adobe, NVIDIA, Samsung, Spotify"
                  disabled={isSubmitting}
                  className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-brand-500 dark:focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all resize-y disabled:opacity-50"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Duplicates are automatically detected and skipped. Gemini finds verified career URLs & industry categories automatically.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Progress indication during AI processing */}
              {isSubmitting && (
                <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400" />
                    <span>Processing with Gemini AI...</span>
                  </div>
                  <p className="text-[11px] text-brand-600 dark:text-brand-300">
                    Parsing names, deduplicating, discovering official careers portals, and categorizing companies. This takes just a few seconds.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !inputText.trim()}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Adding Companies...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Add & Categorize</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
