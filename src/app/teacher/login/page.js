'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

const AUTH_STORAGE_KEY = "lut-fop-auth";

async function request(path, options = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(options.body ?? {}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.errors?.join?.(" ") || "Request failed");
  }
  return data;
}

export default function TeacherLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const loginForm = useForm();
  const signupForm = useForm();
  const requestForm = useForm();
  const [requesting, setRequesting] = useState(false);

  const handleLogin = async (payload) => {
    try {
      const data = await request("/api/auth/login", { body: payload });
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: data.token, teacher: data.teacher })
      );
      toast.success("Welcome back! Redirecting to dashboard…");
      router.push("/teacher/dashboard");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSignup = async (payload) => {
    try {
      const body = {
        ...payload,
        inviteCode: payload.inviteCode?.trim().toUpperCase(),
      };
  const data = await request("/api/auth/signup", { body });
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: data.token, teacher: data.teacher })
      );
      toast.success("Account created! Taking you to the dashboard…");
      router.push("/teacher/dashboard");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRequestAccess = async (payload) => {
    try {
      setRequesting(true);
      const res = await fetch("/api/teachers/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to submit request");
      }
      toast.success("Request sent! We'll be in touch soon.");
      requestForm.reset();
      setShowRequestForm(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 pb-20 pt-16 sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:py-24">
      <div className="flex-1 space-y-6 text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-slate-300">
          Teacher access · Orientation
        </span>
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">
          Manage attendance with confidence.
        </h1>
        <p className="text-lg text-slate-300">
          Sign in to review previous sessions, launch a new record, and scan student QR codes straight from your browser. Admins can jump between instructors for complete oversight.
        </p>
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-emerald-400">✦</span>
            <span>All data lives inside secure LUT-owned Google Sheets via a service account.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-emerald-400">✦</span>
            <span>Invites keep access secure. Request one with your LUT email if you don’t have it yet.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-emerald-400">✦</span>
            <span>Need help? Contact the LUT FOP coordination team for onboarding.</span>
          </li>
        </ul>
      </div>

      <div className="flex-1 rounded-3xl border border-white/10 bg-slate-900/70 p-8 backdrop-blur-md">
        <div className="mb-6 inline-flex rounded-full bg-white/10 p-1">
          {[
            { id: "login", label: "Sign in" },
            { id: "signup", label: "Sign up" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setMode(tab.id);
                if (tab.id === "login") {
                  setShowRequestForm(false);
                }
              }}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                mode === tab.id
                  ? "bg-emerald-400 text-emerald-950"
                  : "text-slate-300 hover:text-white"
              }`}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                LUT email address
              </label>
              <input
                type="email"
                placeholder="firstname.lastname@lut.fi"
                {...loginForm.register("email", { required: true })}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...loginForm.register("password", { required: true })}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400/90 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-300"
            >
              Sign in
            </button>
          </form>
        ) : (
          <form
            onSubmit={signupForm.handleSubmit(handleSignup)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                LUT email address
              </label>
              <input
                type="email"
                placeholder="firstname.lastname@lut.fi"
                {...signupForm.register("email", { required: true })}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                placeholder="Strong password"
                {...signupForm.register("password", { required: true, minLength: 8 })}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Invite code
              </label>
              <input
                type="text"
                placeholder="Provided by programme lead"
                {...signupForm.register("inviteCode", { required: true })}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
              <p className="text-xs text-slate-400">
                Need an invite? <button type="button" className="text-emerald-300 underline underline-offset-4" onClick={() => setShowRequestForm(true)}>Request access</button>
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-400/90 px-6 py-3 text-base font-semibold text-sky-950 transition hover:bg-sky-300"
            >
              Create account
            </button>
          </form>
        )}
        {showRequestForm && (
          <form
            onSubmit={requestForm.handleSubmit(handleRequestAccess)}
            className="mt-8 space-y-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Request an invite</h3>
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="text-xs uppercase tracking-wide text-emerald-200"
              >
                Close
              </button>
            </div>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                LUT email
              </span>
              <input
                type="email"
                placeholder="firstname.lastname@lut.fi"
                {...requestForm.register("email", { required: true })}
                className="w-full rounded-xl border border-emerald-400/40 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/20"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                Full name
              </span>
              <input
                type="text"
                placeholder="Preferred display name"
                {...requestForm.register("name")}
                className="w-full rounded-xl border border-emerald-400/40 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/20"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                Context (optional)
              </span>
              <textarea
                rows={3}
                placeholder="Which groups will you be teaching?"
                {...requestForm.register("context")}
                className="w-full rounded-xl border border-emerald-400/40 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/20"
              />
            </label>
            <button
              type="submit"
              disabled={requesting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-70"
            >
              {requesting ? "Sending…" : "Submit request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
