import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Users,
  KeyRound,
  Check,
  Power,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { AdminUser } from '../types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'create' | 'settings'>('users');
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Form states for creating student account
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdStudentInfo, setCreatedStudentInfo] = useState<{
    username: string;
    tempPassword: string;
  } | null>(null);

  // Reset password states
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const fetchAdminData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [settingsRes, usersRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/users'),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setRegistrationEnabled(sData.registrationEnabled);
      }

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users);
      }
    } catch (err: any) {
      setErrorMsg('Failed to load administrator data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle public registration setting
  const handleToggleRegistration = async () => {
    try {
      const nextState = !registrationEnabled;
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationEnabled: nextState }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRegistrationEnabled(nextState);
      setSuccessMsg(`Public self-registration is now ${nextState ? 'ENABLED' : 'DISABLED'}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update registration setting');
    }
  };

  // Toggle account active/disabled
  const handleToggleUserStatus = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !user.isActive } : u))
      );
      setSuccessMsg(data.message);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to toggle account status');
    }
  };

  // Create student account
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    setIsCreating(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCreatedStudentInfo({
        username: newUsername.trim(),
        tempPassword: newPassword.trim(),
      });
      setNewUsername('');
      setNewPassword('');
      fetchAdminData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create student account');
    } finally {
      setIsCreating(false);
    }
  };

  // Reset temporary password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordVal.trim()) return;

    try {
      const res = await fetch(`/api/admin/users/${resetTargetUser.id}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPasswordVal.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(`Password for ${resetTargetUser.username} updated to: ${resetPasswordVal}`);
      setResetTargetUser(null);
      setResetPasswordVal('');
      fetchAdminData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMsg('Copied credentials to clipboard!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Administrator Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage student accounts, registration permissions, and directory access
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 bg-slate-50/30 dark:bg-slate-900/30 shrink-0">
          <button
            onClick={() => {
              setActiveTab('users');
              setErrorMsg('');
            }}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Accounts ({users.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('create');
              setErrorMsg('');
              setCreatedStudentInfo(null);
            }}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Student Account</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              setErrorMsg('');
            }}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>Registration Settings</span>
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading administrator records...</span>
            </div>
          ) : activeTab === 'users' ? (
            /* Users List Tab */
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                List of registered accounts and students. You can disable access or set temporary passwords.
              </div>

              {users.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No accounts found.</div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-3.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {u.username}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              u.role === 'admin'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                : u.role === 'student'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                          {!u.isActive && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {u.companyCount} companies in directory • Joined{' '}
                          {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setResetTargetUser(u);
                            setResetPasswordVal('');
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
                          title="Set Temporary Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Temp Pass</span>
                        </button>

                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors ${
                              u.isActive
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                            title={u.isActive ? 'Disable Student Account' : 'Enable Student Account'}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{u.isActive ? 'Disable' : 'Enable'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reset Password Prompt Modal Overlay */}
              {resetTargetUser && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Set Temporary Password for: {resetTargetUser.username}
                  </h4>
                  <form onSubmit={handleResetPassword} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new temporary password"
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none"
                      required
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetTargetUser(null)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : activeTab === 'create' ? (
            /* Create Student Account Tab */
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Create Student Account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Generate credentials to sell or provide direct access to students.
                </p>
              </div>

              {createdStudentInfo && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Student Account Created!</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-emerald-200 dark:border-emerald-800 text-xs font-mono space-y-1">
                    <div>Username: <strong>{createdStudentInfo.username}</strong></div>
                    <div>Temporary Password: <strong>{createdStudentInfo.tempPassword}</strong></div>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Company Career Directory Credentials:\nUsername: ${createdStudentInfo.username}\nPassword: ${createdStudentInfo.tempPassword}`
                      )
                    }
                    className="w-full py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Credentials</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleCreateStudent} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. rahul_student"
                    required
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Temporary Password
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="e.g. Student2026!#"
                    required
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account & Provide Credentials</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Settings Tab */
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Public Self-Registration
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    When disabled, only administrators can create student accounts. Public visitors cannot sign up.
                  </p>
                </div>

                <button
                  onClick={handleToggleRegistration}
                  className={`text-2xl transition-colors ${
                    registrationEnabled ? 'text-emerald-500' : 'text-slate-400'
                  }`}
                  title={registrationEnabled ? 'Disable Public Registration' : 'Enable Public Registration'}
                >
                  {registrationEnabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              <div className="text-xs text-slate-400">
                Current status:{' '}
                <strong className={registrationEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {registrationEnabled ? 'ENABLED (Anyone can register)' : 'DISABLED (Admin creation only)'}
                </strong>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
