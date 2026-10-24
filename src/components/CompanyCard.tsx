import React from 'react';
import {
  Star,
  Pin,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Company } from '../types';

interface CompanyCardProps {
  company: Company;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onEdit: (company: Company) => void;
  onDelete: (id: string, name: string) => void;
  onCategoryClick?: (category: string) => void;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  onToggleFavorite,
  onTogglePin,
  onEdit,
  onDelete,
  onCategoryClick,
}) => {
  const isVerified = company.isVerified && company.verificationStatus === 'verified';
  const hasUrl = Boolean(company.careersUrl && company.careersUrl.startsWith('http'));

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked an action button (favorite, pin, edit, delete, category), don't open link
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    if (hasUrl) {
      window.open(company.careersUrl, '_blank', 'noopener,noreferrer');
    } else {
      onEdit(company);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between border ${
        company.isPinned
          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-700/60 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm'
      } hover:border-brand-500/80 dark:hover:border-brand-400 hover:bg-slate-50/90 dark:hover:bg-slate-800/70 hover:shadow-md hover:-translate-y-0.5`}
    >
      {/* Top Header: Company Name + Favorite & Pin Buttons */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2
                className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate"
                title={company.name}
              >
                {company.name}
              </h2>
              {company.isPinned && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded"
                  title="Pinned to top"
                >
                  <Pin className="w-2.5 h-2.5 fill-current" />
                  Pinned
                </span>
              )}
            </div>
          </div>

          {/* Pin & Favorite Action Icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(company._id);
              }}
              className={`p-1.5 rounded-md transition-all ${
                company.isPinned
                  ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100'
              }`}
              title={company.isPinned ? 'Unpin Company' : 'Pin to Top'}
              aria-label={company.isPinned ? 'Unpin Company' : 'Pin to Top'}
            >
              <Pin className={`w-3.5 h-3.5 ${company.isPinned ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(company._id);
              }}
              className={`p-1.5 rounded-md transition-all ${
                company.isFavorite
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100'
              }`}
              title={company.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              aria-label={company.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Star className={`w-3.5 h-3.5 ${company.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {company.categories && company.categories.length > 0 ? (
            company.categories.map((cat, idx) => (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick?.(cat);
                }}
                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/50 dark:hover:text-brand-300 transition-colors"
              >
                {cat}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-400">Technology</span>
          )}
        </div>
      </div>

      {/* Card Footer: Career Page Status, Visit Button, Edit & Delete */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
        {/* Verification Status & Link */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Verified Career Link</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 truncate"
              title="Career page link needs verification"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Needs Verification</span>
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {hasUrl && (
            <a
              href={company.careersUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Open Official Careers Page in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(company);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title="Edit Company Link / Categories"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(company._id, company.name);
            }}
            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
            title="Delete Company"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
