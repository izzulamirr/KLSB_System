"use client";
import { useState, useEffect } from "react";
import { getAuth, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { withBasePath } from "../lib/apiPath";

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState("profile");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  // Notification state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(true);

  // Appearance state
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Asia/Kuala_Lumpur");

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
    }

    // Load saved preferences from localStorage
    const savedTheme = localStorage.getItem("klsb:theme") || "light";
    const savedLang = localStorage.getItem("klsb:language") || "en";
    const savedTz = localStorage.getItem("klsb:timezone") || "Asia/Kuala_Lumpur";
    const savedEmailNotif = localStorage.getItem("klsb:emailNotifications") !== "false";
    const savedPushNotif = localStorage.getItem("klsb:pushNotifications") === "true";
    const savedWeekly = localStorage.getItem("klsb:weeklyReports") !== "false";
    const saved2FA = localStorage.getItem("klsb:twoFactor") === "true";

    setTheme(savedTheme);
    setLanguage(savedLang);
    setTimezone(savedTz);
    setEmailNotifications(savedEmailNotif);
    setPushNotifications(savedPushNotif);
    setWeeklyReports(savedWeekly);
    setTwoFactorEnabled(saved2FA);
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName });
      showMessage("success", "Profile updated successfully!");
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!user || !user.email) {
      showMessage("error", "User email not available");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage("error", "New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      showMessage("error", "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showMessage("success", "Password changed successfully!");
    } catch (err) {
      console.error(err);
      showMessage("error", err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSave = () => {
    localStorage.setItem("klsb:emailNotifications", emailNotifications);
    localStorage.setItem("klsb:pushNotifications", pushNotifications);
    localStorage.setItem("klsb:weeklyReports", weeklyReports);
    showMessage("success", "Notification preferences saved!");
  };

  const handleAppearanceSave = () => {
    localStorage.setItem("klsb:theme", theme);
    localStorage.setItem("klsb:language", language);
    localStorage.setItem("klsb:timezone", timezone);
    // Apply theme (basic implementation)
    document.documentElement.setAttribute("data-theme", theme);
    showMessage("success", "Appearance settings saved!");
  };

  const handleExportData = async (format) => {
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/manpower"));
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      
      let content, filename, mimeType;
      if (format === "csv") {
        // Convert to CSV
        if (!data.length) {
          showMessage("error", "No data to export");
          setLoading(false);
          return;
        }
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(",")];
        data.forEach((row) => {
          const values = headers.map((h) => {
            const val = String(row[h] ?? "");
            return val.includes(",") ? `"${val}"` : val;
          });
          csvRows.push(values.join(","));
        });
        content = csvRows.join("\n");
        filename = `manpower-export-${Date.now()}.csv`;
        mimeType = "text/csv";
      } else {
        // JSON
        content = JSON.stringify(data, null, 2);
        filename = `manpower-export-${Date.now()}.json`;
        mimeType = "application/json";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showMessage("success", `Data exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      showMessage("error", "Failed to export data");
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    if (confirm("Are you sure you want to clear all cached data?")) {
      localStorage.removeItem("klsb:manpower:demo");
      showMessage("success", "Cache cleared successfully!");
    }
  };

  const handleToggle2FA = () => {
    const newVal = !twoFactorEnabled;
    setTwoFactorEnabled(newVal);
    localStorage.setItem("klsb:twoFactor", newVal);
    showMessage("success", newVal ? "2FA enabled (demo)" : "2FA disabled");
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "data", label: "Data Management", icon: "💾" },
    { id: "security", label: "Security", icon: "🔒" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">Manage your account preferences and system configuration</p>
      </div>

      {/* Message Banner */}
      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-1 ring-rose-200"}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#0e2b57] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="mr-3">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Profile Settings</h2>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                    <input
                      type="text"
                      value="Administrator"
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-[#0e2b57] text-white rounded-lg hover:bg-[#0a1f3d] disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-200">
                    <div>
                      <div className="font-medium text-slate-900">Email Notifications</div>
                      <div className="text-sm text-slate-600">Receive email alerts for important updates</div>
                    </div>
                    <label className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-full h-full bg-slate-300 rounded-full peer-checked:bg-[#0e2b57] transition-colors cursor-pointer"></div>
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-slate-200">
                    <div>
                      <div className="font-medium text-slate-900">Push Notifications</div>
                      <div className="text-sm text-slate-600">Get real-time browser notifications</div>
                    </div>
                    <label className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        checked={pushNotifications}
                        onChange={(e) => setPushNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-full h-full bg-slate-300 rounded-full peer-checked:bg-[#0e2b57] transition-colors cursor-pointer"></div>
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-slate-900">Weekly Reports</div>
                      <div className="text-sm text-slate-600">Receive weekly summary reports</div>
                    </div>
                    <label className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        checked={weeklyReports}
                        onChange={(e) => setWeeklyReports(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-full h-full bg-slate-300 rounded-full peer-checked:bg-[#0e2b57] transition-colors cursor-pointer"></div>
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                    </label>
                  </div>

                  <button
                    onClick={handleNotificationSave}
                    className="mt-4 px-4 py-2 bg-[#0e2b57] text-white rounded-lg hover:bg-[#0a1f3d]"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Appearance Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      {["light", "dark", "auto"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`p-4 rounded-lg border-2 transition-colors capitalize ${
                            theme === t
                              ? "border-[#0e2b57] bg-[#0e2b57]/5"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/30"
                    >
                      <option value="en">English</option>
                      <option value="ms">Bahasa Melayu</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/30"
                    >
                      <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (GMT+8)</option>
                      <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                      <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleAppearanceSave}
                    className="px-4 py-2 bg-[#0e2b57] text-white rounded-lg hover:bg-[#0a1f3d]"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}

            {/* Data Management Tab */}
            {activeTab === "data" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Data Management</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-slate-900 mb-2">Export Data</h3>
                    <p className="text-sm text-slate-600 mb-3">Download your manpower data in various formats</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleExportData("csv")}
                        disabled={loading}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Export as CSV
                      </button>
                      <button
                        onClick={() => handleExportData("json")}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Export as JSON
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="font-medium text-slate-900 mb-2">Clear Cache</h3>
                    <p className="text-sm text-slate-600 mb-3">Remove all locally cached data (does not affect database)</p>
                    <button
                      onClick={handleClearCache}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      Clear Cache
                    </button>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="font-medium text-slate-900 mb-2">Storage Info</h3>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Local Storage Used:</span>
                        <span className="font-medium">~{Math.round((JSON.stringify(localStorage).length / 1024) * 10) / 10} KB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Last Sync:</span>
                        <span className="font-medium">{new Date().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Security Settings</h2>
                
                {/* Change Password */}
                <div className="mb-6">
                  <h3 className="font-medium text-slate-900 mb-3">Change Password</h3>
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]/30"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-[#0e2b57] text-white rounded-lg hover:bg-[#0a1f3d] disabled:opacity-50"
                    >
                      {loading ? "Changing..." : "Change Password"}
                    </button>
                  </form>
                </div>

                {/* Two-Factor Authentication */}
                <div className="border-t border-slate-200 pt-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">Two-Factor Authentication</h3>
                      <p className="text-sm text-slate-600 mt-1">Add an extra layer of security to your account</p>
                    </div>
                    <label className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        checked={twoFactorEnabled}
                        onChange={handleToggle2FA}
                        className="sr-only peer"
                      />
                      <div className="w-full h-full bg-slate-300 rounded-full peer-checked:bg-[#0e2b57] transition-colors cursor-pointer"></div>
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                    </label>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="font-medium text-slate-900 mb-3">Active Sessions</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">Current Session</div>
                        <div className="text-xs text-slate-600 mt-1">
                          {typeof navigator !== 'undefined' && (
                            <>
                              {navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Mac") ? "macOS" : "Linux"} · 
                              {navigator.userAgent.includes("Chrome") ? " Chrome" : navigator.userAgent.includes("Firefox") ? " Firefox" : " Safari"}
                            </>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Last active: Just now</div>
                      </div>
                      <span className="text-xs text-emerald-600 font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
