"use client";

import { auth } from "../../firebase";
import { withBasePath } from "../../lib/apiPath";

export async function bdFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Unauthenticated");

  const token = await user.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(withBasePath(path), { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function formatCurrency(num) {
  const value = Number(num || 0);
  if (!value) return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function statusClass(status) {
  const value = String(status || "").toUpperCase();
  if (value === "WON") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (value === "LOST") return "bg-rose-100 text-rose-700 border-rose-200";
  if (value === "DECLINED") return "bg-red-100 text-red-700 border-red-200";
  if (value === "CANCELLED") return "bg-slate-200 text-slate-700 border-slate-300";
  if (value === "KIV") return "bg-violet-100 text-violet-700 border-violet-200";
  if (value === "ON-GOING") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}
