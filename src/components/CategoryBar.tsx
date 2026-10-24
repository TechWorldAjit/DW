import React from 'react';
import { CategoryFacet } from '../types';
import { Layers } from 'lucide-react';

interface CategoryBarProps {
  categories: CategoryFacet[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  totalCompanies: number;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  totalCompanies,
}) => {
  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center text-xs font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0">
          <Layers className="w-3.5 h-3.5 mr-1" />
          <span>Filter:</span>
        </div>

        {/* All Pill */}
        <button
          onClick={() => onSelectCategory('All')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full shrink-0 transition-all flex items-center gap-1.5 ${
            selectedCategory === 'All'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <span>All</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedCategory === 'All'
                ? 'bg-slate-700 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {totalCompanies}
          </span>
        </button>

        {/* Dynamic Category Pills */}
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full shrink-0 transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? 'bg-brand-700 text-brand-100'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
