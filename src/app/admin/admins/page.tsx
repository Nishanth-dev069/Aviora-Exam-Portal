'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, UserPlus, Search, RefreshCw, Key, 
  Trash2, ShieldAlert, CheckCircle, AlertTriangle, X
} from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'deactivated';
  force_password_change: boolean;
  created_at: string;
  last_active_at: string | null;
}

export default function AdminsManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'super_admin'>('admin');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [resetModalAdmin, setResetModalAdmin] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/manage-admins');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch admin users');
      }
      setAdmins(data.admins || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword) return;

    try {
      setCreateSubmitting(true);
      const res = await fetch('/api/admin/manage-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          role: createRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create admin');
      }

      setIsCreateOpen(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('admin');
      fetchAdmins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    const confirmMsg = admin.status === 'active'
      ? `Are you sure you want to suspend admin ${admin.email}?`
      : `Are you sure you want to activate admin ${admin.email}?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/manage-admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_status',
          admin_id: admin.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle status');
      }

      fetchAdmins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalAdmin || !newPassword) return;

    try {
      setResetSubmitting(true);
      const res = await fetch('/api/admin/manage-admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          admin_id: resetModalAdmin.id,
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetModalAdmin(null);
      setNewPassword('');
      alert('Password reset successfully!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (!confirm(`CAUTION: Are you sure you want to delete admin account ${admin.email}?`)) return;

    try {
      const res = await fetch('/api/admin/manage-admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_admin',
          admin_id: admin.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete admin');
      }

      fetchAdmins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filteredAdmins = admins.filter(a => 
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Admin Account Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Super Admin Suite: Create and manage instructor & administrator credentials
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchAdmins}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Create Admin
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by email or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Admins Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Admin Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Loading admin user list...
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No admin accounts found.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-text-primary">
                      {admin.email}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border ${
                        admin.role === 'super_admin' 
                          ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' 
                          : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold border ${
                        admin.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {admin.status === 'active' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {admin.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-muted">
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-muted">
                      {admin.last_active_at ? new Date(admin.last_active_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      
                      {/* View Logs Button */}
                      <button
                        onClick={() => router.push(`/admin/audit-logs?actor_id=${admin.id}`)}
                        className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-primary transition-colors"
                        title="View Audit Logs for this admin"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>

                      {/* Reset Password Button */}
                      <button
                        onClick={() => setResetModalAdmin(admin)}
                        className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-amber-500 transition-colors"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      {/* Toggle Status Button */}
                      <button
                        onClick={() => handleToggleStatus(admin)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                          admin.status === 'active'
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20'
                        }`}
                      >
                        {admin.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>

                      {/* Delete Admin Button */}
                      <button
                        onClick={() => handleDeleteAdmin(admin)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                        title="Delete Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Admin Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-border pb-3">
              <UserPlus className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg text-text-primary">Create New Admin Account</h2>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Role Level</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'admin' | 'super_admin')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="admin">Instructor / Admin</option>
                  <option value="super_admin">Super Admin (Full Portal Access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-border text-text-secondary text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setResetModalAdmin(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Key className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-lg text-text-primary">Reset Password</h2>
            </div>

            <p className="text-xs text-text-muted">
              Set a new password for <span className="font-semibold text-text-primary">{resetModalAdmin.email}</span>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalAdmin(null)}
                  className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-border text-text-secondary text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {resetSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
