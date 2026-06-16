"use client";

import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { withBasePath } from "../lib/apiPath";

export default function ProfileClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [user, setUser] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSending, setCodeSending] = useState(false);
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeInfo, setCodeInfo] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    return () => clearTimeout(timer);
  }, [message.text]);

  const showMessage = (type, text) => setMessage({ type, text });

  const resetVerificationState = () => {
    setCodeVerified(false);
    setVerificationCode("");
    setCodeInfo("");
  };

  const openVerificationModal = () => {
    setShowVerificationModal(true);
  };

  const closeVerificationModal = () => {
    setShowVerificationModal(false);
  };

  const requestVerificationCode = async ({ silent = false } = {}) => {
    if (!user) return;
    if (!newPassword || !confirmPassword) {
      showMessage("error", "Enter the new password first before sending a verification code.");
      return;
    }
    if (!currentPassword) {
      showMessage("error", "Enter your current password first.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage("error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      showMessage("error", "Password must be at least 6 characters.");
      return;
    }

    setCodeSending(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(withBasePath("/api/auth/password-verification"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "send" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send verification code");
      }

      setCodeVerified(false);
      setVerificationCode("");
      setShowVerificationModal(true);
      setCodeInfo(`Verification code sent to ${user.email}. Expires in ${data?.expiresInMinutes || 10} minutes.`);
      if (!silent) {
        showMessage("success", "Verification code sent to your email.");
      }
    } catch (err) {
      console.error(err);
      showMessage("error", err?.message || "Failed to send verification code");
    } finally {
      setCodeSending(false);
    }
  };

  const handleSendVerificationCode = () => requestVerificationCode();

  const handleVerifyCode = async () => {
    if (!user) return;
    const code = String(verificationCode || "").trim();
    if (!code) {
      showMessage("error", "Enter the verification code from your email.");
      return;
    }

    setCodeVerifying(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(withBasePath("/api/auth/password-verification"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "verify", code }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Invalid verification code");
      }

      setCodeVerified(true);
      setCodeInfo("Verification code confirmed. You can now save the new password.");
      setShowVerificationModal(false);
      showMessage("success", "Verification code confirmed.");
    } catch (err) {
      console.error(err);
      setCodeVerified(false);
      showMessage("error", err?.message || "Failed to verify code");
    } finally {
      setCodeVerifying(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    const nextDisplayName = String(displayName || "").trim();
    const nextEmail = String(email || "").trim().toLowerCase();
    const currentEmail = String(user.email || "").trim().toLowerCase();
    const wantsPasswordChange = Boolean(newPassword || confirmPassword);
    const wantsEmailChange = nextEmail && nextEmail !== currentEmail;
    const wantsCredentialCheck = wantsEmailChange || wantsPasswordChange;

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        showMessage("error", "New passwords do not match.");
        return;
      }
      if (newPassword.length < 6) {
        showMessage("error", "Password must be at least 6 characters.");
        return;
      }
    }

    if (wantsEmailChange && !nextEmail.includes("@")) {
      showMessage("error", "Enter a valid email address.");
      return;
    }

    if (wantsCredentialCheck && !currentPassword) {
      showMessage("error", "Enter your current password to update email or password.");
      return;
    }

    if (wantsPasswordChange && !codeVerified) {
      openVerificationModal();
      await requestVerificationCode({ silent: true });
      return;
    }

    setSaving(true);
    try {
      if (wantsCredentialCheck) {
        const credential = EmailAuthProvider.credential(currentEmail, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      if (nextDisplayName !== String(user.displayName || "").trim()) {
        await updateProfile(user, { displayName: nextDisplayName });
      }

      if (wantsEmailChange) {
        await updateEmail(user, nextEmail);
      }

      if (newPassword) {
        if (!codeVerified) {
          throw new Error("Verify the email code before changing your password.");
        }
        await updatePassword(user, newPassword);
      }

      await user.reload();
      const refreshedUser = getAuth().currentUser;
      setUser(refreshedUser);
      setDisplayName(refreshedUser?.displayName || nextDisplayName || "");
      setEmail(refreshedUser?.email || nextEmail || currentEmail || "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      resetVerificationState();
      closeVerificationModal();
      showMessage("success", "Account information updated successfully.");
    } catch (err) {
      console.error(err);
      const code = String(err?.code || "");
      if (code.includes("requires-recent-login")) {
        showMessage("error", "Please sign out and sign back in, then try again.");
      } else if (code.includes("email-already-in-use")) {
        showMessage("error", "That email address is already in use.");
      } else {
        showMessage("error", err?.message || "Failed to update account information.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/50 p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Account</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Profile Management</h1>
        <p className="mt-2 text-sm text-slate-600">Update your name, email address, and password in one place.</p>
      </div>

      {message.text && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Display Name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Email Address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Current Password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Required for email or password changes"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="lg:col-span-2 grid gap-4 lg:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium text-slate-600">New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                resetVerificationState();
              }}
              placeholder="Leave blank to keep current password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium text-slate-600">Confirm New Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                resetVerificationState();
              }}
              placeholder="Repeat the new password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div><span className="font-medium text-slate-700">Current user:</span> {user?.displayName || user?.email || "Unknown"}</div>
          <div className="mt-1"><span className="font-medium text-slate-700">Signed in as:</span> {user?.email || "Unknown"}</div>
        </div>

        <div className="lg:col-span-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#0f3d7a] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(15,61,122,0.25)] hover:bg-[#0c3368] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>

      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Security Check</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Verify your email</h2>
              </div>
              <button
                type="button"
                onClick={closeVerificationModal}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {codeInfo || `A 6-digit code has been sent to ${user?.email || "your email"}.`}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="flex-1 text-sm text-slate-700">
                <span className="mb-1 block font-medium text-slate-600">Verification Code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={codeVerifying || !verificationCode}
                className="rounded-xl bg-[#0f3d7a] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(15,61,122,0.25)] hover:bg-[#0c3368] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {codeVerifying ? "Verifying..." : codeVerified ? "Code Verified" : "Verify Code"}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSendVerificationCode}
                disabled={codeSending || !newPassword || !confirmPassword}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {codeSending ? "Sending..." : "Resend Code"}
              </button>
              <span className={codeVerified ? "text-sm font-medium text-emerald-700" : "text-sm text-slate-500"}>
                {codeVerified ? "Verified for password update." : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}