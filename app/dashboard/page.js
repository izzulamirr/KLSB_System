"use client";
import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../../firebase";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, monthly: 0, hourly: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataChanged, setDataChanged] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchDashboardData(true);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchDashboardData = async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const res = await fetch("/api/manpower");
      if (res.ok) {
        const data = await res.json();
        
        console.log(`Loaded ${data.length} total records from database`);
        
        // Check if data changed (for notifications)
        const newTotal = data.length;
        const oldTotal = stats.total;
        if (isAutoRefresh && newTotal !== oldTotal && oldTotal !== 0) {
          setDataChanged(true);
          setTimeout(() => setDataChanged(false), 3000);
        }
        
        // ===== DYNAMIC STATS COLLECTION =====
        
        // Total Staff - count all records
        const total = data.length;
        
        // Active Staff - dynamic filter by STATUS_COLOR
        const active = data.filter((r) => {
          const statusColor = String(r.STATUS_COLOR || "").toLowerCase().trim();
          return statusColor === "active" || statusColor === "ongoing" || statusColor === "green";
        }).length;
        
        // Pending Staff - dynamic filter by STATUS_COLOR
        const pending = data.filter((r) => {
          const statusColor = String(r.STATUS_COLOR || "").toLowerCase().trim();
          return statusColor === "pending" || statusColor === "yellow" || statusColor === "waiting";
        }).length;
        
        // Monthly Pay - dynamic count by PAY_TYPE
        const monthly = data.filter((r) => {
          const payType = String(r.PAY_TYPE || "").toUpperCase().trim();
          return payType === "M" || payType === "MONTHLY";
        }).length;
        
        // Hourly Pay - dynamic count by PAY_TYPE
        const hourly = data.filter((r) => {
          const payType = String(r.PAY_TYPE || "").toUpperCase().trim();
          return payType === "H" || payType === "HOURLY";
        }).length;
        
        setStats({ total, active, pending, monthly, hourly });

        // ===== ACTIVE PROJECTS - Dynamic by PO/SO =====
        const projectMap = {};
        data.forEach((record) => {
          const poSo = record.PO_SO_No || "Unassigned";
          if (!projectMap[poSo]) {
            projectMap[poSo] = { 
              name: poSo, 
              count: 0, 
              active: 0, 
              pending: 0,
              location: record.LOCATION || "N/A",
              positions: new Set()
            };
          }
          projectMap[poSo].count++;
          
          // Count active staff in project
          const statusColor = String(record.STATUS_COLOR || "").toLowerCase().trim();
          if (statusColor === "active" || statusColor === "ongoing" || statusColor === "green") {
            projectMap[poSo].active++;
          }
          
          // Count pending staff in project
          if (statusColor === "pending" || statusColor === "yellow" || statusColor === "waiting") {
            projectMap[poSo].pending++;
          }
          
          // Collect unique positions
          if (record.POSITION) {
            projectMap[poSo].positions.add(record.POSITION);
          }
        });
        
        // Sort projects by total staff count (most staff first)
        const projects = Object.values(projectMap)
          .map(p => ({
            ...p,
            positions: p.positions.size
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        
        setProjectSummary(projects);

        // ===== UPCOMING DEADLINES - Dynamic from END_DATE_KLSB =====
        const deadlines = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        data.forEach((record) => {
          if (record.END_DATE_KLSB) {
            try {
              const endDate = new Date(record.END_DATE_KLSB);
              endDate.setHours(0, 0, 0, 0);
              
              const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
              
              // Only include deadlines within next 30 days and not passed
              if (daysRemaining >= 0 && daysRemaining <= 30) {
                deadlines.push({
                  bil: record.BIL,
                  staff: record.STAFF_NAME || "Unknown",
                  position: record.POSITION || "N/A",
                  date: record.END_DATE_KLSB,
                  daysRemaining,
                  project: record.PO_SO_No || "N/A",
                  location: record.LOCATION || "N/A",
                  status: record.STATUS_COLOR || "Unknown"
                });
              }
            } catch (err) {
              console.warn(`Invalid date for record:`, record.END_DATE_KLSB);
            }
          }
        });
        
        // Sort by urgency (soonest first)
        setUpcomingDeadlines(deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 5));

        // ===== RECENT STAFF ADDITIONS - Dynamic by BIL (newest first) =====
        const sortedData = [...data]
          .filter(r => r.STAFF_NAME) // Only records with staff names
          .sort((a, b) => (b.BIL || 0) - (a.BIL || 0)) // Sort by BIL descending (newest first)
          .slice(0, 5);
        
        const activities = sortedData.map((record) => ({
          bil: record.BIL,
          staff: record.STAFF_NAME,
          position: record.POSITION || "Position N/A",
          location: record.LOCATION || "Location N/A",
          status: record.STATUS_COLOR || "Unknown",
          project: record.PO_SO_No || "Unassigned",
          payType: record.PAY_TYPE || "N/A",
          startDate: record.START_DATE_KLSB || null
        }));
        
        setRecentActivity(activities);
        
        setLastUpdated(new Date());
        
        console.log('Dashboard Stats:', { 
          total, 
          active, 
          pending, 
          monthly, 
          hourly,
          projects: projects.length,
          deadlines: deadlines.length,
          recentAdditions: activities.length
        });
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchDashboardData(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-6">
      {/* Data Changed Notification */}
      {dataChanged && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
          <span className="text-xl">✓</span>
          <span className="font-medium">Data updated!</span>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, <span className="text-[#0e2b57]">{user?.displayName || user?.email?.split("@")[0]}</span>
          </h1>
          <p className="text-slate-600">Here&apos;s your business overview for today</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="text-sm text-slate-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              refreshing 
                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-[#0e2b57] text-white hover:bg-[#0a1f3d] hover:shadow-lg"
            }`}
          >
            <svg 
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Staff", value: stats.total, icon: "👥", gradient: "from-blue-500 to-blue-600" },
          { label: "Active", value: stats.active, icon: "✓", gradient: "from-emerald-500 to-emerald-600" },
          { label: "Pending", value: stats.pending, icon: "⏳", gradient: "from-amber-500 to-amber-600" },
          { label: "Monthly Pay", value: stats.monthly, icon: "📅", gradient: "from-indigo-500 to-indigo-600" },
          { label: "Hourly Pay", value: stats.hourly, icon: "⏰", gradient: "from-purple-500 to-purple-600" },
        ].map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 hover:shadow-md transition">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} text-white text-2xl mb-3`}>
              {card.icon}
            </div>
            <div className="text-3xl font-bold text-slate-900">{loading ? "..." : card.value}</div>
            <div className="text-sm text-slate-600 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Active Projects
            </h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-slate-500">Loading projects...</div>
              ) : projectSummary.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No projects found</div>
              ) : (
                projectSummary.map((project, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {project.name}
                        {project.pending > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                            {project.pending} pending
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                        <span>📍 {project.location}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-medium">{project.active} active</span>
                        <span>of {project.count} total</span>
                        {project.positions > 0 && (
                          <>
                            <span>•</span>
                            <span>{project.positions} positions</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#0e2b57]">{project.count}</div>
                        <div className="text-xs text-slate-500">Staff</div>
                      </div>
                      <Link
                        href={
                          project.name === "Unassigned" || !project.name
                            ? `/dashboard/manpower?company=${encodeURIComponent(project.location)}`
                            : `/dashboard/manpower?po=${encodeURIComponent(project.name)}`
                        }
                        className="px-3 py-2 bg-[#0e2b57] text-white rounded-lg text-sm hover:bg-[#0a1f3d] transition"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Additions */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🆕</span>
              Recent Staff Additions
            </h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-4 text-slate-500">Loading...</div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-4 text-slate-500">No recent activity</div>
              ) : (
                recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#0e2b57] to-[#7aa4cf] flex items-center justify-center text-white font-semibold text-sm">
                      #{activity.bil || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{activity.staff}</div>
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <span>{activity.position}</span>
                        {activity.payType && (
                          <>
                            <span>•</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              activity.payType === "M" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"
                            }`}>
                              {activity.payType === "M" ? "Monthly" : activity.payType === "H" ? "Hourly" : activity.payType}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>📍 {activity.location}</span>
                        {activity.project && activity.project !== "Unassigned" && (
                          <>
                            <span>•</span>
                            <span>🏗️ {activity.project}</span>
                          </>
                        )}
                      </div>
                      {activity.startDate && (
                        <div className="text-xs text-slate-400 mt-1">
                          Started: {new Date(activity.startDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      activity.status.toLowerCase() === "active" || activity.status.toLowerCase() === "green" ? "bg-emerald-100 text-emerald-700" :
                      activity.status.toLowerCase() === "pending" || activity.status.toLowerCase() === "yellow" ? "bg-amber-100 text-amber-700" :
                      activity.status.toLowerCase() === "completed" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {activity.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              Upcoming Deadlines
            </h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">No upcoming deadlines</div>
              ) : (
                upcomingDeadlines.map((deadline, idx) => (
                  <a 
                    key={idx} 
                    href={`/dashboard/manpower?bil=${deadline.bil}`}
                    className={`block p-3 border-l-4 rounded transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${
                    deadline.daysRemaining === 0 ? "border-red-500 bg-red-50 hover:bg-red-100" :
                    deadline.daysRemaining <= 3 ? "border-red-400 bg-red-50 hover:bg-red-100" :
                    deadline.daysRemaining <= 7 ? "border-amber-500 bg-amber-50 hover:bg-amber-100" :
                    deadline.daysRemaining <= 14 ? "border-yellow-400 bg-yellow-50 hover:bg-yellow-100" :
                    "border-emerald-400 bg-emerald-50 hover:bg-emerald-100"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{deadline.staff}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{deadline.position}</div>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                        deadline.daysRemaining === 0 ? "bg-red-600 text-white" :
                        deadline.daysRemaining <= 3 ? "bg-red-500 text-white" :
                        deadline.daysRemaining <= 7 ? "bg-amber-600 text-white" :
                        deadline.daysRemaining <= 14 ? "bg-yellow-600 text-white" :
                        "bg-emerald-600 text-white"
                      }`}>
                        {deadline.daysRemaining === 0 ? "TODAY" : 
                         deadline.daysRemaining === 1 ? "1 day" :
                         `${deadline.daysRemaining} days`}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mt-2 flex items-center gap-2">
                      <span>🏗️ {deadline.project}</span>
                      {deadline.location && deadline.location !== "N/A" && (
                        <>
                          <span>•</span>
                          <span>📍 {deadline.location}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                      <span className="text-xs text-slate-500">Due: {new Date(deadline.date).toLocaleDateString()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        deadline.status.toLowerCase() === "active" || deadline.status.toLowerCase() === "green" ? "bg-emerald-100 text-emerald-700" :
                        deadline.status.toLowerCase() === "pending" || deadline.status.toLowerCase() === "yellow" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {deadline.status}
                      </span>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              Quick Links
            </h2>
            <div className="space-y-2">
              {[
                { label: "Manage Staff", href: "/dashboard/manpower", icon: "👥" },
                { label: "Timesheets", href: "/dashboard/timesheet", icon: "📋" },
                { label: "Finance", href: "/dashboard/finance", icon: "💰" },
                { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
              ].map((link, idx) => (
                <Link
                  key={idx}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition group"
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-sm font-medium text-slate-900">{link.label}</span>
                  <svg className="ml-auto w-4 h-4 text-slate-400 group-hover:text-[#0e2b57] group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
