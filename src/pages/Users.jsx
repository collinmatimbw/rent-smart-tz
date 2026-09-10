import React, { useState, useEffect, useCallback } from "react";
import { mysql } from "@/api/mysqlClient";
import { useAuth } from "@/lib/AuthContext";
import { ROLES } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Shield, UserPlus, Loader2, Mail, ChevronDown, Check, RefreshCw, AlertCircle, Pencil, KeyRound, Ban, Unlock, Trash2, X, Save } from "lucide-react";

const blankUser = { id: "", full_name: "", email: "", role: "user", status: "active" };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await mysql.entities.User.list("-created_date", 500);
      setUsers(list.map((u) => ({ ...u, status: u.status || "active" })));
    } catch (e) {
      setError(e.message || "Imeshindikana kupakia watumiaji");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function showSuccess(message) {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function changeRole(userId, newRole) {
    setUpdatingId(userId);
    setError(null);
    try {
      const updated = await mysql.users.updateUser({ id: userId, role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      showSuccess("Jukumu limebadilishwa");
    } catch (e) {
      setError(e.message || "Imeshindikana kubadilisha jukumu");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setSuccess(null);
    setError(null);
    try {
      const result = await mysql.users.inviteUser(inviteEmail.trim(), inviteRole);
      setSuccess(result.temporary_password ? `Mwaliko umetumwa. Password ya muda: ${result.temporary_password}` : `Mwaliko umetumwa kwa ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteOpen(false);
      await loadUsers();
    } catch (e) {
      setError(e.message || "Imeshindikana kutuma mwaliko");
    } finally {
      setInviting(false);
    }
  }

  async function saveEdit() {
    if (!editUser?.id) return;
    setUpdatingId(editUser.id);
    setError(null);
    try {
      const updated = await mysql.users.updateUser({
        id: editUser.id,
        full_name: editUser.full_name,
        email: editUser.email,
        role: editUser.role,
        status: editUser.status,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
      showSuccess("Mtumiaji amehaririwa");
    } catch (e) {
      setError(e.message || "Imeshindikana kuhifadhi mabadiliko");
    } finally {
      setUpdatingId(null);
    }
  }

  async function savePassword() {
    if (!passwordUser?.id || !newPassword) return;
    setUpdatingId(passwordUser.id);
    setError(null);
    try {
      await mysql.users.setPassword(passwordUser.id, newPassword);
      setPasswordUser(null);
      setNewPassword("");
      showSuccess("Password imebadilishwa");
    } catch (e) {
      setError(e.message || "Imeshindikana kubadilisha password");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleBlock(target) {
    const blocked = (target.status || "active") !== "blocked";
    if (!window.confirm(blocked ? `Umzuie ${target.email}?` : `Umruhusu ${target.email} kuingia tena?`)) return;
    setUpdatingId(target.id);
    setError(null);
    try {
      const updated = await mysql.users.blockUser(target.id, blocked);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showSuccess(blocked ? "Mtumiaji amezuiwa" : "Mtumiaji ameruhusiwa");
    } catch (e) {
      setError(e.message || "Action imeshindikana");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteUser(target) {
    if (!window.confirm(`Umfute kabisa ${target.email}?`)) return;
    setUpdatingId(target.id);
    setError(null);
    try {
      await mysql.users.deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      showSuccess("Mtumiaji amefutwa");
    } catch (e) {
      setError(e.message || "Imeshindikana kumfuta mtumiaji");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-slate-700" /> System Users & Roles
          </h1>
          <p className="text-sm text-slate-500 mt-1">Dhibiti watumiaji, roles, password, na access zao</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadUsers} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setInviteOpen(!inviteOpen)} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
            <UserPlus className="w-4 h-4" /> Alika Mtumiaji
          </button>
        </div>
      </div>

      {inviteOpen && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-heading font-semibold text-slate-900 mb-4">Alika Mtumiaji Mpya</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3">
            <input type="email" placeholder="mfano@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10">
              {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
            </select>
            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Tuma Mwaliko
            </button>
          </div>
        </div>
      )}

      {success && <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /><p className="text-sm text-emerald-700">{success}</p></div>}
      {error && <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-lg"><AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" /><p className="text-sm text-rose-700">{error}</p></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(ROLES).map(([key, r]) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${r.dot}`} />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
            </div>
            <p className="text-xs text-slate-500">{r.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-heading font-semibold text-slate-900">Watumiaji Waliosajiliwa ({users.length})</h3>
        </div>
        {users.length === 0 ? (
          <p className="p-8 text-center text-slate-400">Hakuna watumiaji waliosajiliwa</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Jina</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Email</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Jukumu</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                  <th className="text-left font-medium text-slate-600 px-4 py-3">Tarehe</th>
                  <th className="text-right font-medium text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const roleInfo = ROLES[u.role] || ROLES.user;
                  const isBlocked = (u.status || "active") === "blocked";
                  const busy = updatingId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">{(u.full_name || u.email || "?").charAt(0).toUpperCase()}</div>
                          <div><p className="font-medium text-slate-900">{u.full_name || "-"}</p>{isSelf && <span className="text-xs text-blue-600">Wewe</span>}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email || "-"}</td>
                      <td className="px-4 py-3">
                        {isSelf ? <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleInfo.color}`}>{roleInfo.label}</span> : (
                          <div className="relative inline-block">
                            <select value={u.role || "user"} onChange={(e) => changeRole(u.id, e.target.value)} disabled={busy || isBlocked} className={`appearance-none text-xs font-semibold px-3 py-1.5 pr-7 rounded-full border-0 cursor-pointer ${roleInfo.color} disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10`}>
                              {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${isBlocked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{isBlocked ? "Blocked" : "Active"}</span></td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(u.created_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Send Email" onClick={() => window.open(`mailto:${u.email}`, "_blank")} disabled={!u.email} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Mail className="w-4 h-4" /></button>
                          <button title="Edit" onClick={() => setEditUser({ ...blankUser, ...u, status: u.status || "active" })} disabled={busy} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><Pencil className="w-4 h-4" /></button>
                          <button title="Change password" onClick={() => { setPasswordUser(u); setNewPassword(""); }} disabled={busy} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><KeyRound className="w-4 h-4" /></button>
                          <button title={isBlocked ? "Unblock" : "Block"} onClick={() => toggleBlock(u)} disabled={busy || isSelf} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40">{isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</button>
                          <button title="Delete" onClick={() => deleteUser(u)} disabled={busy || isSelf} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-heading font-semibold text-slate-900">Hariri Mtumiaji</h3>
              <button onClick={() => setEditUser(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <input value={editUser.full_name || ""} onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })} placeholder="Jina kamili" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              <input type="email" value={editUser.email || ""} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={editUser.role || "user"} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })} disabled={editUser.id === currentUser?.id} className="px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                </select>
                <select value={editUser.status || "active"} onChange={(e) => setEditUser({ ...editUser, status: e.target.value })} disabled={editUser.id === currentUser?.id} className="px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} disabled={updatingId === editUser.id} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">{updatingId === editUser.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
            </div>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-heading font-semibold text-slate-900">Badili Password</h3>
              <button onClick={() => setPasswordUser(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-500">{passwordUser.email}</p>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password mpya" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setPasswordUser(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={savePassword} disabled={updatingId === passwordUser.id || newPassword.length < 8} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">{updatingId === passwordUser.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}