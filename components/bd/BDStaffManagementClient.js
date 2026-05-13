"use client";
import { useState, useEffect, useCallback } from "react";
import { getAuth } from "firebase/auth";

export default function BDStaffManagementClient({ viewRole } = {}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [filterRole, setFilterRole] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Form state for creating new user
  const [newUser, setNewUser] = useState({
    email: "",
    displayName: "",
    password: "",
    role: "staff",
    isAdmin: false,
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [updatingUser, setUpdatingUser] = useState(false);

  const auth = getAuth();

  const fetchStaff = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showMessage("error", "Not authenticated");
        return;
      }

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auth/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 403) {
          showMessage("error", "Only admins can manage staff");
        } else {
          showMessage("error", "Failed to fetch staff");
        }
        return;
      }

      const data = await res.json();
      let fetched = data.users || [];
      if (viewRole) {
        const vr = String(viewRole || "").toLowerCase();
        fetched = fetched.filter((u) => String(u.customClaims?.role || "").toLowerCase() === vr);
      }
      setUsers(fetched);
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to load staff");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth, viewRole]);

  const checkAdminAccess = useCallback(async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auth/role", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const role = String(data?.role || "").toLowerCase();
        const email = String(data?.email || currentUser.email || "").toLowerCase();
        const respIsAdmin = Boolean(data?.isAdmin);
        if (role === "sysdev" || email === "bd@gmail.com" || respIsAdmin) {
          setIsAdmin(true);
          fetchStaff();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [auth, fetchStaff]);

  useEffect(() => {
    checkAdminAccess();
  }, [checkAdminAccess]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.email || !newUser.displayName || !newUser.password) {
      showMessage("error", "All fields are required");
      return;
    }

    if (newUser.password.length < 6) {
      showMessage("error", "Password must be at least 6 characters");
      return;
    }

    setCreatingUser(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showMessage("error", "Not authenticated");
        return;
      }

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error || "Failed to create user");
        return;
      }

      showMessage("success", "User created successfully!");
      setNewUser({ email: "", displayName: "", password: "", role: "staff", isAdmin: false });
      setShowCreateModal(false);
      fetchStaff();
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (uid, currentlyDisabled) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showMessage("error", "Not authenticated");
        return;
      }

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          disabled: !currentlyDisabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error || "Failed to update user");
        return;
      }

      showMessage("success", `User ${!currentlyDisabled ? "deactivated" : "activated"}`);
      fetchStaff();
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to update user");
    }
  };

  const openEditModal = (user) => {
    setEditingUser({
      uid: user.uid,
      email: user.email || "",
      displayName: user.name || "",
      role: String(user.customClaims?.role || "staff").toLowerCase(),
      disabled: Boolean(user.disabled),
      isAdmin: Boolean(user.customClaims?.isAdmin),
      newPassword: "",
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser?.uid) {
      showMessage("error", "No user selected");
      return;
    }

    if (!editingUser.displayName.trim()) {
      showMessage("error", "Display name is required");
      return;
    }

    if (editingUser.newPassword && editingUser.newPassword.length < 6) {
      showMessage("error", "New password must be at least 6 characters");
      return;
    }

    setUpdatingUser(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showMessage("error", "Not authenticated");
        return;
      }

      const token = await currentUser.getIdToken();
      const payload = {
        uid: editingUser.uid,
        displayName: editingUser.displayName.trim(),
        role: editingUser.role,
        disabled: editingUser.disabled,
        isAdmin: Boolean(editingUser.isAdmin),
      };

      if (editingUser.newPassword) {
        payload.password = editingUser.newPassword;
      }

      const res = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error || "Failed to update account");
        return;
      }

      showMessage("success", "Account updated successfully");
      setShowEditModal(false);
      setEditingUser(null);
      fetchStaff();
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to update account");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser?.uid) {
      showMessage("error", "No user selected");
      return;
    }

    const confirmDelete = window.confirm(`Delete user ${editingUser.email}? This action cannot be undone.`);
    if (!confirmDelete) return;

    setUpdatingUser(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showMessage("error", "Not authenticated");
        return;
      }

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auth/users", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: editingUser.uid }),
      });

      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error || "Failed to delete user");
        return;
      }

      showMessage("success", "User deleted");
      setShowEditModal(false);
      setEditingUser(null);
      fetchStaff();
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to delete user");
    } finally {
      setUpdatingUser(false);
    }
  };

  // Filter and sort users
  let filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || u.customClaims?.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (sortBy === "name") {
    filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "lastLogin") {
    filteredUsers.sort((a, b) => {
      const timeA = a.lastSignInTime ? new Date(a.lastSignInTime) : new Date(0);
      const timeB = b.lastSignInTime ? new Date(b.lastSignInTime) : new Date(0);
      return timeB - timeA;
    });
  } else if (sortBy === "created") {
    filteredUsers.sort((a, b) => {
      const timeA = a.creationTime ? new Date(a.creationTime) : new Date(0);
      const timeB = b.creationTime ? new Date(b.creationTime) : new Date(0);
      return timeB - timeA;
    });
  }

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleColor = (role) => {
    const roleColors = {
      sysdev: "bg-purple-100 text-purple-800",
      hr: "bg-blue-100 text-blue-800",
      bd: "bg-green-100 text-green-800",
      staff: "bg-slate-100 text-slate-800",
    };
    return roleColors[role] || roleColors.staff;
  };

  const getRoleLabel = (role) => {
    const normalizedRole = String(role || "").toLowerCase();
    const roleLabels = {
      bd: "BD",
      sysdev: "System Developers",
      hr: "HR",
      staff: "Staff",
    };
    return roleLabels[normalizedRole] || "Staff";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="h-12 w-12 text-slate-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="text-slate-600 font-medium">Access Denied</p>
        <p className="text-sm text-slate-500 mt-1">Only admins can manage staff</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Staff Management</h1>
          <p className="mt-1 text-sm text-slate-600">Manage users, view login history, and assign roles</p>
          <div className="mt-3 text-sm text-slate-500">Total users: <span className="font-medium text-slate-700">{users.length}</span></div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStaff(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f3d7a] px-4 py-2.5 font-semibold text-white hover:bg-[#0c3368] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Staff
          </button>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-3 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm placeholder-slate-400 focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
          >
            <option value="all">All Roles</option>
            <option value="bd">BD</option>
            <option value="sysdev">System Developers</option>
            <option value="hr">HR</option>
            <option value="staff">Staff</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
          >
            <option value="name">Sort by Name</option>
            <option value="lastLogin">Sort by Last Login</option>
            <option value="created">Sort by Created</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
          Click any row to edit account settings.
        </div>
        {filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20a3 3 0 003-3V7a3 3 0 00-3-3H3a3 3 0 00-3 3v10a3 3 0 003 3h3z"
                />
              </svg>
              <p className="mt-2 text-slate-600">No staff found</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Last Login</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr
                  key={user.uid}
                  onClick={() => openEditModal(user)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold">{(user.name || "?").split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                    <div>
                      <div className="text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-400">{getRoleLabel(user.customClaims?.role || "staff")}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getRoleColor(user.customClaims?.role || "staff")}`}>
                      {getRoleLabel(user.customClaims?.role || "staff")}
                    </span>
                    {user.customClaims?.isAdmin && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-semibold">
                        Staff Admin
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {formatDate(user.lastSignInTime)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {formatDate(user.creationTime)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleUserStatus(user.uid, user.disabled);
                      }}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        user.disabled
                          ? "bg-red-50 text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                      }`}
                    >
                      <span className={`inline-block h-2 w-2 rounded-full ${user.disabled ? "bg-red-600" : "bg-emerald-600"}`} />
                      {user.disabled ? "Inactive" : "Active"}
                    </button>
                  </td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Add New Staff</h3>
              <p className="mt-1 text-sm text-slate-600">Create a new user account</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                  placeholder="staff@klsb.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                >
                  <option value="bd">BD</option>
                  <option value="sysdev">System Developers</option>
                  <option value="hr">HR</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="new-is-admin"
                  type="checkbox"
                  checked={newUser.isAdmin}
                  onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-[#0f3d7a] focus:ring-[#0f3d7a]"
                />
                <label htmlFor="new-is-admin" className="text-sm text-slate-700">Staff Admin (can manage staff)</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingUser}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 rounded-lg bg-[#0f3d7a] px-4 py-2.5 font-semibold text-white hover:bg-[#0c3368] disabled:opacity-50"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Edit Account</h3>
              <p className="mt-1 text-sm text-slate-600">Update role and account settings</p>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Email</label>
                <input
                  type="text"
                  value={editingUser.email}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                  >
                    <option value="bd">BD</option>
                    <option value="sysdev">System Developers</option>
                    <option value="hr">HR</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Status</label>
                  <select
                    value={editingUser.disabled ? "inactive" : "active"}
                    onChange={(e) => setEditingUser({ ...editingUser, disabled: e.target.value === "inactive" })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Set New Password (Optional)</label>
                <input
                  type="password"
                  value={editingUser.newPassword}
                  onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#0f3d7a] focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/20"
                  placeholder="Leave empty to keep current password"
                />
              </div>

              <div className="mt-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingUser.isAdmin}
                    onChange={(e) => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0f3d7a] focus:ring-[#0f3d7a]"
                  />
                  <span className="text-sm text-slate-700">Staff Admin (can manage staff)</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  disabled={updatingUser}
                  aria-label="Cancel"
                  title="Cancel"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="flex gap-3">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleDeleteUser}
                      disabled={updatingUser}
                      aria-label="Delete User"
                      title="Delete User"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={updatingUser}
                    aria-label="Save Changes"
                    title="Save Changes"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f3d7a] text-white hover:bg-[#0c3368] disabled:opacity-50"
                  >
                    {updatingUser ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
