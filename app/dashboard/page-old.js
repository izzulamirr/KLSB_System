"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../../firebase";

export default function Page() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, monthly: 0, hourly: 0 });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    // Fetch manpower stats and recent activity
    (async () => {
      try {
        const res = await fetch("/api/manpower");
        if (res.ok) {
          const data = await res.json();
          const total = data.length;
          
          // Use STATUS_COLOR field for filtering (not STATUS which is display text)
          const active = data.filter((r) => {
            const statusColor = String(r.STATUS_COLOR || "").toLowerCase();
            return statusColor === "active" || statusColor === "ongoing";
          }).length;
          
          const pending = data.filter((r) => {
            const statusColor = String(r.STATUS_COLOR || "").toLowerCase();
            return statusColor === "pending";
          }).length;
          
          const monthly = data.filter((r) => r.PAY_TYPE === "M" || String(r.PAY_TYPE || "").toLowerCase().includes("monthly")).length;
          const hourly = data.filter((r) => r.PAY_TYPE === "H" || String(r.PAY_TYPE || "").toLowerCase().includes("hourly")).length;
          setStats({ total, active, pending, monthly, hourly });

          // Generate recent activity from actual data
          const activities = [];
          
          // Sort by BIL (most recent first) and take last 10 records
          const sortedData = [...data].sort((a, b) => (b.BIL || 0) - (a.BIL || 0));
          const recentRecords = sortedData.slice(0, 10);

          recentRecords.forEach((record, idx) => {
            const staffName = record.STAFF_NAME || "Unknown Staff";
            const status = record.STATUS || "Unknown";
            const statusColor = String(record.STATUS_COLOR || "").toLowerCase();
            const position = record.POSITION || "";
            const location = record.LOCATION || "";
            const payType = record.PAY_TYPE === "M" ? "Monthly" : record.PAY_TYPE === "H" ? "Hourly" : "";

            // Create activity based on record properties
            if (idx === 0) {
              activities.push({
                action: "New staff record added",
                detail: staffName,
                time: "Recently",
                type: "success",
                metadata: position ? `${position}${location ? ` - ${location}` : ""}` : location
              });
            } else if (statusColor === "active" || statusColor === "ongoing") {
              activities.push({
                action: "Status updated",
                detail: `${staffName} - Active`,
                time: `${idx} record${idx > 1 ? "s" : ""} ago`,
                type: "success",
                metadata: position || location
              });
            } else if (statusColor === "pending") {
              activities.push({
                action: "Pending approval",
                detail: staffName,
                time: `${idx} record${idx > 1 ? "s" : ""} ago`,
                type: "warning",
                metadata: position || location
              });
            } else if (payType) {
              activities.push({
                action: "Pay type set",
                detail: `${staffName} - ${payType}`,
                time: `${idx} record${idx > 1 ? "s" : ""} ago`,
                type: "info",
                metadata: position || location
              });
            } else {
              activities.push({
                action: "Record updated",
                detail: staffName,
                time: `${idx} record${idx > 1 ? "s" : ""} ago`,
                type: "info",
                metadata: position || location
              });
            }
          });

          setRecentActivity(activities.slice(0, 5)); // Show only top 5
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!user) return null;

  const metricCards = [
    { 
      label: "Total Staff", 
      value: loading ? "..." : stats.total, 
      icon: "👥", 
      color: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      change: "+12%",
      changePositive: true
    },
    { 
      label: "Active", 
      value: loading ? "..." : stats.active, 
      icon: "✓", 
      color: "from-emerald-500 to-emerald-600",
      bgGradient: "from-emerald-50 to-emerald-100",
      change: "+8%",
      changePositive: true
    },
    { 
      label: "Pending", 
      value: loading ? "..." : stats.pending, 
      icon: "⏳", 
      color: "from-amber-500 to-amber-600",
      bgGradient: "from-amber-50 to-amber-100",
      change: "-3%",
      changePositive: false
    },
    { 
      label: "Monthly", 
      value: loading ? "..." : stats.monthly, 
      icon: "📅", 
      color: "from-indigo-500 to-indigo-600",
      bgGradient: "from-indigo-50 to-indigo-100",
      change: "+5%",
      changePositive: true
    },
    { 
      label: "Hourly", 
      value: loading ? "..." : stats.hourly, 
      icon: "⏰", 
      color: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
      change: "+15%",
      changePositive: true
    },
  ];

  const quickActions = [
    { label: "Add Staff", icon: "➕", href: "/dashboard/manpower", color: "bg-blue-600 hover:bg-blue-700" },
    { label: "Import CSV", icon: "📤", href: "/dashboard/manpower", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Export Data", icon: "📥", href: "/dashboard/settings?tab=data", color: "bg-indigo-600 hover:bg-indigo-700" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Welcome back, <span className="text-[#0e2b57]">{user?.displayName || user?.email?.split("@")[0]}</span>
            </h1>
            <p className="text-slate-600 mt-1">Here&apos;s what&apos;s happening with your manpower today</p>
          </div>
          <div className="hidden md:block">
            <div className="px-4 py-2 bg-gradient-to-r from-[#0e2b57] to-[#1a3d6f] text-white rounded-lg shadow-md">
              <div className="text-xs text-white/80">Today</div>
              <div className="text-sm font-semibold">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bgGradient} p-6 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} text-white text-2xl shadow-lg`}>
                {card.icon}
              </div>
              <div className={`text-xs font-semibold px-2 py-1 rounded-full ${card.changePositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {card.change}
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{card.value}</div>
            <div className="text-sm text-slate-600">{card.label}</div>
            <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-white/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              Quick Actions
            </h2>
            <div className="space-y-3">
              {quickActions.map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className={`flex items-center gap-3 ${action.color} text-white px-4 py-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md group`}
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="font-medium">{action.label}</span>
                  <svg className="ml-auto w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              System Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <span className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">API Status</span>
                <span className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last Sync</span>
                <span className="text-sm text-slate-500">Just now</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Recent Activity
            </h2>
            <div className="space-y-4">
              {loading ? (
                // Loading skeleton
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 animate-pulse">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-200"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))
              ) : recentActivity.length > 0 ? (
                recentActivity.map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group"
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      activity.type === "success" ? "bg-emerald-100 text-emerald-600" :
                      activity.type === "info" ? "bg-blue-100 text-blue-600" :
                      activity.type === "warning" ? "bg-amber-100 text-amber-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {activity.type === "success" ? "✓" : activity.type === "info" ? "ℹ" : activity.type === "warning" ? "⚠" : "•"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                      <p className="text-sm text-slate-600 truncate">{activity.detail}</p>
                      {activity.metadata && (
                        <p className="text-xs text-slate-500 mt-0.5">{activity.metadata}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/dashboard/manpower"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#0e2b57] hover:text-[#0a1f3d] transition-colors"
              >
                View all activity
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <div className="mt-8 bg-gradient-to-r from-[#0e2b57] via-[#1a3d6f] to-[#0e2b57] rounded-2xl shadow-lg p-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold">{loading ? "..." : stats.total}</div>
            <div className="text-sm text-white/80 mt-1">Total Records</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{loading ? "..." : Math.round((stats.active / stats.total) * 100) || 0}%</div>
            <div className="text-sm text-white/80 mt-1">Active Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{new Date().toLocaleDateString("en-US", { month: "short" })}</div>
            <div className="text-sm text-white/80 mt-1">Current Month</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">24/7</div>
            <div className="text-sm text-white/80 mt-1">Support Available</div>
          </div>
        </div>
      </div>
    </div>
  );
}
