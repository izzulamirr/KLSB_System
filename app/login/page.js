"use client";
import { Suspense } from "react";
import LoginForm from "../../components/LoginForm";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#f8fafc_0%,#eef2f7_100%)]" />
      <Suspense fallback={<div className="text-center text-slate-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
