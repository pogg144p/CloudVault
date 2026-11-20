import React, { useState } from 'react';
import { X, User as UserIcon, Lock, Shield, Check, AlertCircle, Loader2, Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/admin';
import { User } from '../../types';
import api from '../../services/api';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'security' | 'admin';

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile tab state
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Security tab state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  // Admin tab state
  const [users, setUsers] = useState<User[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadUsers = async () => {
    if (users.length > 0) return;
    setAdminLoading(true);
    try {
      const list = await adminService.listUsers();
      setUsers(list);
    } catch {
      setAdminMsg({ type: 'error', text: 'Failed to load users.' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'admin') loadUsers();
  };

  const handleProfileSave = async () => {
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      await api.put('/users/me', {
        full_name: fullName.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      });
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err?.response?.data?.detail ?? 'Update failed.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    if (newPassword.length < 8) {
      setSecurityMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSecurityLoading(true);
    setSecurityMsg(null);
    try {
      await api.put('/users/me', { password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setSecurityMsg({ type: 'success', text: 'Password changed successfully!' });
    } catch (err: any) {
      setSecurityMsg({ type: 'error', text: err?.response?.data?.detail ?? 'Failed to change password.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleToggleAdmin = async (targetUser: User) => {
    setTogglingId(targetUser.id);
    setAdminMsg(null);
    try {
      const updated = await adminService.setUserRole(targetUser.id, !targetUser.is_superuser);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setAdminMsg({
        type: 'success',
        text: `${updated.full_name} is now ${updated.is_superuser ? 'an Admin' : 'a regular user'}.`,
      });
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err?.response?.data?.detail ?? 'Role update failed.' });
    } finally {
      setTogglingId(null);
    }
  };

  if (!isOpen || !user) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'security', label: 'Security', icon: Lock },
    ...(user.is_superuser ? [{ id: 'admin' as Tab, label: 'Admin', icon: Shield, adminOnly: true }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Account Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'admin' && (
                <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  ADMIN
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* Avatar preview */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200/50 overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
                  ) : (
                    (fullName || user.full_name).charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{user.full_name}</p>
                  {user.is_superuser && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full mt-1">
                      <Crown className="w-3 h-3" /> Admin
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Avatar URL <span className="text-slate-300 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              {profileMsg && <StatusBanner msg={profileMsg} />}

              <button
                onClick={handleProfileSave}
                disabled={profileLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Profile
              </button>
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 font-medium">
                Choose a strong password — at least 8 characters.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="Repeat new password"
                />
              </div>

              {securityMsg && <StatusBanner msg={securityMsg} />}

              <button
                onClick={handlePasswordSave}
                disabled={securityLoading || !newPassword}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
            </div>
          )}

          {/* ── Admin Tab ── */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grant or revoke admin access. Admins can view <strong>System Health</strong> and manage roles.
              </p>

              {adminMsg && <StatusBanner msg={adminMsg} />}

              {adminLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {users.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${u.is_superuser ? 'bg-indigo-600' : 'bg-slate-400'}`}>
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                          {u.full_name}
                          {u.id === user.id && <span className="ml-1 text-indigo-500 text-xs">(you)</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                      </div>

                      {/* Badge + toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        {u.is_superuser && (
                          <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Admin
                          </span>
                        )}
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleToggleAdmin(u)}
                            disabled={togglingId === u.id}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                              u.is_superuser
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100'
                                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                            } disabled:opacity-50`}
                          >
                            {togglingId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : u.is_superuser ? 'Revoke' : 'Make Admin'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function StatusBanner({ msg }: { msg: { type: 'success' | 'error'; text: string } }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${
      msg.type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    }`}>
      {msg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg.text}
    </div>
  );
}
