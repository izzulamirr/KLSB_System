"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../../firebase";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, monthly: 0, hourly: 0 });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/manpower");
      if (res.ok) {
        const data = await res.json();
        
        // Calculate stats
        const total = data.length;
        const active = data.filter((r) => {
          const statusColor = String(r.STATUS_COLOR || "").toLowerCase();
          return statusColor === "active" || statusColor === "ongoing";
        }).length;
        const pending = data.filter((r) => {
          const statusColor = String(r.STATUS_COLOR || "").toLowerCase();
          return statusColor === "pending";
        }).length;
        const monthly = data.filter((r) => r.PAY_TYPE === "M").length;
        const hourly = data.filter((r) => r.PAY_TYPE === "H").length;
        setStats({ total, active, pending, monthly, hourly });

        // Project Summary by PO/SO
        const projectMap = {};
        data.forEach((record) => {
          const poSo = record.PO_SO_No || "Unassigned";
          if (!projectMap[poSo]) {
            projectMap[poSo] = { name: poSo, count: 0, active: 0, location: record.LOCATION || "N/A" };
          }
          projectMap[poSo].count++;
          const statusColor = String(record.STATUS_COLOR || "").toLowerCase();
          if (statusColor === "active" || statusColor === "ongoing") {
            projectMap[poSo].active++;
          }
        });
        const projects = Object.values(projectMap).sort((a, b) => b.count - a.count).slice(0, 6);
        setProjectSummary(projects);

        // Upcoming Deadlines
        const deadlines = [];
        const today = new Date();
        data.forEach((record) => {
          if (record.END_DATE_KLSB) {
            const endDate = new Date(record.END_DATE_KLSB);
            const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            if (daysRemaining > 0 && daysRemaining <= 30) {
              deadlines.push({
                staff: record.STAFF_NAME,
                date: record.END_DATE_KLSB,
                daysRemaining,
                project: record.PO_SO_No || "N/A",
              });
            }
          }
        });
        setUpcomingDeadlines(deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 5));

        // Recent Activity
        const sortedData = [...data].sort((a, b) => (b.BIL || 0) - (a.BIL || 0)).slice(0, 5);
        const activities = sortedData.map((record, idx) => ({
          staff: record.STAFF_NAME,
          position: record.POSITION,
          location: record.LOCATION,
          status: record.STATUS_COLOR || "Unknown",
        }));
        setRecentActivity(activities);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome back, <span className="text-[#0e2b57]">{user?.displayName || user?.email?.split("@")[0]}</span>
        </h1>
        <p className="text-slate-600">Here's your business overview for today</p>
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
                      <div className="font-semibold text-slate-900">{project.name}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {project.location} • {project.active} active of {project.count} total
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#0e2b57]">{project.count}</div>
                        <div className="text-xs text-slate-500">Staff</div>
                      </div>
                      <Link
                        href="/dashboard/manpower"
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
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#0e2b57] to-[#7aa4cf] flex items-center justify-center text-white font-semibold">
                      {activity.staff?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{activity.staff}</div>
                      <div className="text-sm text-slate-600">{activity.position || "Position N/A"}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{activity.location || "Location N/A"}</div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      activity.status.toLowerCase() === "active" ? "bg-emerald-100 text-emerald-700" :
                      activity.status.toLowerCase() === "pending" ? "bg-amber-100 text-amber-700" :
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
                  <div key={idx} className="p-3 border-l-4 border-amber-400 bg-amber-50 rounded">
                    <div className="font-semibold text-slate-900 text-sm">{deadline.staff}</div>
                    <div className="text-xs text-slate-600 mt-1">{deadline.project}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500">{deadline.date}</span>
                      <span className={`text-xs font-bold ${
                        deadline.daysRemaining <= 7 ? "text-red-600" :
                        deadline.daysRemaining <= 14 ? "text-amber-600" :
                        "text-emerald-600"
                      }`}>
                        {deadline.daysRemaining} days
                      </span>
                    </div>
                  </div>
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
