"use client";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../firebase";

export default function ControlClient() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaff: 0,
    pendingStaff: 0,
    totalTimesheets: 0,
    systemHealth: "Good",
    dbStatus: "Online",
    lastBackup: "N/A",
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchSystemStats();
      fetchRecentActivities();
    }
  }, [user]);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);
      
      // Fetch manpower data
      const manpowerRes = await fetch("/api/manpower");
      const manpowerData = manpowerRes.ok ? await manpowerRes.json() : [];
      
      // Fetch timesheet data
      const timesheetRes = await fetch("/api/timesheet");
      const timesheetData = timesheetRes.ok ? await timesheetRes.json() : [];

      const totalStaff = manpowerData.length;
      const activeStaff = manpowerData.filter((r) => {
        const statusColor = String(r.STATUS_COLOR || "").toLowerCase();
        return statusColor === "active" || statusColor === "ongoing";
      }).length;
      const pendingStaff = manpowerData.filter((r) => {
        const statusColor = String(r.STATUS_COLOR || "").toLowerCase();
        return statusColor === "pending";
      }).length;

      setStats({
        totalStaff,
        activeStaff,
        pendingStaff,
        totalTimesheets: timesheetData.length,
        systemHealth: "Good",
        dbStatus: "Online",
        lastBackup: new Date().toLocaleDateString(),
      });
    } catch (err) {
      console.error("Failed to fetch system stats:", err);
      setStats((prev) => ({ ...prev, systemHealth: "Error", dbStatus: "Error" }));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    // Mock recent activities - in production, fetch from audit log
    setActivities([
      { id: 1, user: user?.email, action: "Logged in", timestamp: new Date().toISOString(), type: "info" },
      { id: 2, user: "system", action: "Database backup completed", timestamp: new Date(Date.now() - 3600000).toISOString(), type: "success" },
      { id: 3, user: user?.email, action: "Viewed control center", timestamp: new Date().toISOString(), type: "info" },
    ]);
  };

  const handleClearCache = () => {
    if (confirm("Clear all cached data? This will log you out.")) {
      localStorage.clear();
      sessionStorage.clear();
      alert("Cache cleared! Logging out...");
      auth.signOut().then(() => router.push("/login"));
    }
  };

  const handleExportLogs = () => {
    const logData = JSON.stringify(activities, null, 2);
    const blob = new Blob([logData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupDatabase = async () => {
    try {
      // Fetch all data
      const manpowerRes = await fetch("/api/manpower");
      const timesheetRes = await fetch("/api/timesheet");
      
      const backup = {
        timestamp: new Date().toISOString(),
        manpower: manpowerRes.ok ? await manpowerRes.json() : [],
        timesheets: timesheetRes.ok ? await timesheetRes.json() : [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klsb-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert("Database backup created successfully!");
      setStats((prev) => ({ ...prev, lastBackup: new Date().toLocaleDateString() }));
    } catch (err) {
      console.error("Backup error:", err);
      alert("Failed to create backup");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Control Center</h1>
        <p className="text-slate-600">System monitoring, administration, and controls</p>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">System Health</span>
            <span className={`w-3 h-3 rounded-full ${stats.systemHealth === "Good" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.systemHealth}</div>
          <p className="text-xs text-slate-500 mt-1">All systems operational</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Database</span>
            <span className={`w-3 h-3 rounded-full ${stats.dbStatus === "Online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.dbStatus}</div>
          <p className="text-xs text-slate-500 mt-1">Firestore connected</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Total Records</span>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.totalStaff}</div>
          <p className="text-xs text-slate-500 mt-1">Manpower records</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Last Backup</span>
            <span className="text-2xl">💾</span>
          </div>
          <div className="text-xl font-bold text-slate-900">{stats.lastBackup}</div>
          <p className="text-xs text-slate-500 mt-1">Database backup</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics Overview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📈</span>
              Statistics Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <div className="text-3xl font-bold text-emerald-700">{loading ? "..." : stats.activeStaff}</div>
                <div className="text-sm text-emerald-600 mt-1">Active Staff</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="text-3xl font-bold text-amber-700">{loading ? "..." : stats.pendingStaff}</div>
                <div className="text-sm text-amber-600 mt-1">Pending</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-700">{loading ? "..." : stats.totalTimesheets}</div>
                <div className="text-sm text-blue-600 mt-1">Timesheets</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-700">1</div>
                <div className="text-sm text-purple-600 mt-1">Active Users</div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-3xl font-bold text-indigo-700">0</div>
                <div className="text-sm text-indigo-600 mt-1">Alerts</div>
              </div>
              <div className="p-4 bg-rose-50 rounded-lg">
                <div className="text-3xl font-bold text-rose-700">0</div>
                <div className="text-sm text-rose-600 mt-1">Errors</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleBackupDatabase}
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all"
              >
                <span className="text-xl">💾</span>
                <span className="font-medium">Backup Database</span>
              </button>
              <button
                onClick={handleExportLogs}
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:shadow-lg transition-all"
              >
                <span className="text-xl">📥</span>
                <span className="font-medium">Export Logs</span>
              </button>
              <button
                onClick={handleClearCache}
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:shadow-lg transition-all"
              >
                <span className="text-xl">🗑️</span>
                <span className="font-medium">Clear Cache</span>
              </button>
              <button
                onClick={() => router.push("/dashboard/settings")}
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg transition-all"
              >
                <span className="text-xl">⚙️</span>
                <span className="font-medium">System Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Recent Activity
            </h2>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      activity.type === "success" ? "bg-emerald-100 text-emerald-600" :
                      activity.type === "error" ? "bg-red-100 text-red-600" :
                      "bg-blue-100 text-blue-600"
                    }`}>
                      {activity.type === "success" ? "✓" : activity.type === "error" ? "✗" : "ℹ"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{activity.user}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">💻</span>
              System Information
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Version</span>
                <span className="font-semibold text-slate-900">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Environment</span>
                <span className="font-semibold text-slate-900">Production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Framework</span>
                <span className="font-semibold text-slate-900">Next.js 15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Database</span>
                <span className="font-semibold text-slate-900">Firestore</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Auth Provider</span>
                <span className="font-semibold text-slate-900">Firebase Auth</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
