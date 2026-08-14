"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../firebase";
import { fetchWithAuth } from "../../lib/fetchWithAuth";

const MANPOWER_COLLECTION_NAME = process.env.NEXT_PUBLIC_MANPOWER_COLLECTION_NAME || "manpower";

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
  const previousTotalRef = useRef(0);
  const dataChangedTimerRef = useRef(null);

  const applyDashboardData = useCallback((data, { isAutoRefresh = false } = {}) => {
    const total = data.length;

    const active = data.filter((r) => {
      const statusColor = String(r.STATUS_COLOR || "").toLowerCase().trim();
      return statusColor === "active" || statusColor === "ongoing" || statusColor === "green";
    }).length;

    const pending = data.filter((r) => {
      const statusColor = String(r.STATUS_COLOR || "").toLowerCase().trim();
      return statusColor === "pending" || statusColor === "yellow" || statusColor === "waiting";
    }).length;

    const monthly = data.filter((r) => {
      const payType = String(r.PAY_TYPE || "").toUpperCase().trim();
      return payType === "M" || payType === "MONTHLY";
    }).length;

    const hourly = data.filter((r) => {
      const payType = String(r.PAY_TYPE || "").toUpperCase().trim();
      return payType === "H" || payType === "HOURLY";
    }).length;

    if (isAutoRefresh && total !== previousTotalRef.current && previousTotalRef.current !== 0) {
      setDataChanged(true);
      if (dataChangedTimerRef.current) {
        clearTimeout(dataChangedTimerRef.current);
      }
      dataChangedTimerRef.current = setTimeout(() => setDataChanged(false), 3000);
    }

    setStats({ total, active, pending, monthly, hourly });
    previousTotalRef.current = total;

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
          positions: new Set(),
        };
      }
      projectMap[poSo].count++;

      const statusColor = String(record.STATUS_COLOR || "").toLowerCase().trim();
      if (statusColor === "active" || statusColor === "ongoing" || statusColor === "green") {
        projectMap[poSo].active++;
      }
      if (statusColor === "pending" || statusColor === "yellow" || statusColor === "waiting") {
        projectMap[poSo].pending++;
      }
      if (record.POSITION) {
        projectMap[poSo].positions.add(record.POSITION);
      }
    });

    const projects = Object.values(projectMap)
      .map((p) => ({ ...p, positions: p.positions.size }))
      .filter((p) => p.active > 0)
      .sort((a, b) => b.count - a.count);

    setProjectSummary(projects);

    const deadlines = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    data.forEach((record) => {
      // A record can have two end dates (contractual End Date and End Date
      // KLSB) — whichever one falls sooner is the more urgent deadline, so
      // that's the one shown here.
      const candidates = [
        { field: "END_DATE", label: "End Date", value: record.END_DATE },
        { field: "END_DATE_KLSB", label: "End Date (KLSB)", value: record.END_DATE_KLSB },
      ].filter((c) => c.value);

      let soonest = null;
      for (const candidate of candidates) {
        try {
          const endDate = new Date(candidate.value);
          endDate.setHours(0, 0, 0, 0);

          const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
          if (daysRemaining >= 0 && daysRemaining <= 60) {
            if (!soonest || daysRemaining < soonest.daysRemaining) {
              soonest = { ...candidate, daysRemaining };
            }
          }
        } catch (err) {
          console.warn(`Invalid date for record:`, candidate.value);
        }
      }

      if (soonest) {
        deadlines.push({
          id: record.id || "",
          staff: record.STAFF_NAME || "Unknown",
          position: record.POSITION || "N/A",
          date: soonest.value,
          dateLabel: soonest.label,
          daysRemaining: soonest.daysRemaining,
          project: record.PO_SO_No || "N/A",
          location: record.LOCATION || "N/A",
          status: record.STATUS_COLOR || "Unknown",
        });
      }
    });

    setUpcomingDeadlines(deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining));

    const sortedData = [...data]
      .filter((r) => r.STAFF_NAME)
      .sort((a, b) => new Date(b.START_DATE || 0) - new Date(a.START_DATE || 0))
      .slice(0, 5);

    const activities = sortedData.map((record) => ({
      staff: record.STAFF_NAME,
      position: record.POSITION || "Position N/A",
      location: record.LOCATION || "Location N/A",
      status: record.STATUS_COLOR || "Unknown",
      project: record.PO_SO_No || "Unassigned",
      payType: record.PAY_TYPE || "N/A",
      startDate: record.START_DATE_KLSB || null,
    }));

    setRecentActivity(activities);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  const fetchDashboardData = useCallback(async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const res = await fetchWithAuth("/api/manpower", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        console.log(`Loaded ${data.length} total records from database`);
        applyDashboardData(data, { isAutoRefresh });
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyDashboardData]);

  useEffect(() => {
    return () => {
      if (dataChangedTimerRef.current) {
        clearTimeout(dataChangedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      const liveUnsub = onSnapshot(collection(db, MANPOWER_COLLECTION_NAME), (snapshot) => {
        const liveData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        applyDashboardData(liveData);
      }, (err) => {
        console.error("Live dashboard listener failed:", err);
      });

      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchDashboardData(true);
      }, 30000);
      return () => {
        clearInterval(interval);
        liveUnsub();
      };
    }
  }, [user, fetchDashboardData]);

  const handleManualRefresh = () => {
    fetchDashboardData(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 p-4 md:p-6">
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome back, <span className="text-[#0e2b57] dark:text-blue-400">{user?.displayName || user?.email?.split("@")[0]}</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Here&apos;s your business overview for today</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              refreshing
                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
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
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6 hover:shadow-md transition">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} text-white text-2xl mb-3`}>
              {card.icon}
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{loading ? "..." : card.value}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Active Projects
            </h2>
            <div className="thin-scrollbar space-y-3 max-h-[520px] overflow-y-auto overflow-x-hidden pr-1">
              {loading ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">Loading projects...</div>
              ) : projectSummary.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">No projects found</div>
              ) : (
                projectSummary.map((project, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words">{project.name}</span>
                        {project.pending > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs rounded-full font-medium">
                            {project.pending} pending
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 break-words">📍 {project.location}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{project.active} active</span>
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
                        <div className="text-2xl font-bold text-[#0e2b57] dark:text-blue-400">{project.count}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Staff</div>
                      </div>
                      <Link
                        href={
                          project.name === "Unassigned" || !project.name
                            ? `/dashboard/manpower?company=${encodeURIComponent(project.location)}`
                            : `/dashboard/manpower?po=${encodeURIComponent(project.name)}`
                        }
                        className="inline-flex min-w-[68px] items-center justify-center px-3 py-2 bg-[#0e2b57] !text-white font-semibold rounded-lg text-sm hover:bg-[#0a1f3d] focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/40 transition"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">🆕</span>
              Recent Staff Additions
            </h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">Loading...</div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">No recent activity</div>
              ) : (
                recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#0e2b57] to-[#7aa4cf] flex items-center justify-center text-white font-semibold text-sm">
                      {String(activity.staff || "?").trim().charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{activity.staff}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span>{activity.position}</span>
                        {activity.payType && (
                          <>
                            <span>•</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              activity.payType === "M" ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" : "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400"
                            }`}>
                              {activity.payType === "M" ? "Monthly" : activity.payType === "H" ? "Hourly" : activity.payType}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>📍 {activity.location}</span>
                        {activity.project && activity.project !== "Unassigned" && (
                          <>
                            <span>•</span>
                            <span>🏗️ {activity.project}</span>
                          </>
                        )}
                      </div>
                      {activity.startDate && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          Started: {new Date(activity.startDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      activity.status.toLowerCase() === "active" || activity.status.toLowerCase() === "green" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                      activity.status.toLowerCase() === "pending" || activity.status.toLowerCase() === "yellow" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" :
                      activity.status.toLowerCase() === "completed" ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400" :
                      "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              Upcoming Deadlines
            </h2>
            <div className="thin-scrollbar space-y-3 max-h-[520px] overflow-y-auto overflow-x-hidden pr-1">
              {loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">Loading...</div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">No upcoming deadlines</div>
              ) : (
                upcomingDeadlines.map((deadline, idx) => (
                  <a
                    key={idx}
                    href={`/dashboard/manpower?po=${encodeURIComponent(deadline.project || "")}${
                      deadline.id ? `&edit=${encodeURIComponent(deadline.id)}` : ""
                    }`}
                    className={`block p-3 border-l-4 rounded transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${
                    deadline.daysRemaining === 0 ? "border-red-500 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60" :
                    deadline.daysRemaining <= 3 ? "border-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60" :
                    deadline.daysRemaining <= 7 ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60" :
                    deadline.daysRemaining <= 14 ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 hover:bg-yellow-100 dark:hover:bg-yellow-950/60" :
                    "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{deadline.staff}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{deadline.position}</div>
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
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 break-words">🏗️ {deadline.project}</span>
                      {deadline.location && deadline.location !== "N/A" && (
                        <>
                          <span>•</span>
                          <span className="min-w-0 break-words">📍 {deadline.location}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{deadline.dateLabel || "Due"}: {new Date(deadline.date).toLocaleDateString()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        deadline.status.toLowerCase() === "active" || deadline.status.toLowerCase() === "green" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                        deadline.status.toLowerCase() === "pending" || deadline.status.toLowerCase() === "yellow" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" :
                        "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              Quick Links
            </h2>
            <div className="space-y-2">
              {[
                { label: "Manage Staff", href: "/dashboard/manpower", icon: "👥" },
                { label: "Timesheets", href: "/dashboard/timesheet", icon: "📋" },
                { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
              ].map((link, idx) => (
                <Link
                  key={idx}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition group"
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{link.label}</span>
                  <svg className="ml-auto w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-[#0e2b57] dark:group-hover:text-blue-400 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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