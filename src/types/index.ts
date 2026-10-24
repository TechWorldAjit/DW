export type UserRole = 'admin' | 'student' | 'user';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isTempPassword?: boolean;
}

export type VerificationStatus = 'verified' | 'needs_verification' | 'manual';

export interface Company {
  _id: string;
  userId: string;
  name: string;
  normalizedName: string;
  careersUrl: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  categories: string[];
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFacet {
  name: string;
  count: number;
}

export interface BatchAddResult {
  message: string;
  submittedCount: number;
  addedCount: number;
  skippedDuplicatesCount: number;
  needsReviewCount: number;
  addedCompanies: Company[];
}

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  isTempPassword?: boolean;
  companyCount: number;
  createdAt: string;
}
