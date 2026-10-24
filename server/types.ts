import { ObjectId } from 'mongodb';

export type UserRole = 'admin' | 'student' | 'user';

export interface UserDoc {
  _id?: ObjectId;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  isTempPassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type VerificationStatus = 'verified' | 'needs_verification' | 'manual';

export interface CompanyDoc {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  normalizedName: string;
  careersUrl: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  categories: string[];
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanonicalCompanyDoc {
  _id?: ObjectId;
  name: string;
  normalizedName: string;
  careersUrl: string;
  isVerified: boolean;
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingDoc {
  _id?: ObjectId;
  key: string;
  value: any;
  updatedAt: Date;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: UserRole;
}
