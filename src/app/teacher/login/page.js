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
        name: payload.name?.trim(),
        email: payload.email?.trim(),
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
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 pb-20 pt-16 text-slate-700 sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:py-24">
      <div className="flex-1 space-y-6 text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold tracking-[0.3em] text-slate-600 shadow-sm">
          LUT STAFF ACCESS
        </span>
        <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
          LUT University Attendance Administration
        </h1>
        <p className="text-lg text-slate-600">
          Sign in to maintain teaching records, open new attendance sessions, and review recent activity. Programme leads may switch between instructors for oversight.
        </p>
        <ul className="space-y-3 text-sm text-slate-600">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-emerald-500">✦</span>
            <span>Access is limited to LUT staff accounts. Use the request form if you require an invitation.</span>
          </li>
        </ul>
      </div>

      <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_28px_65px_-38px_rgba(14,165,233,0.25)]">
        <div className="mb-6 inline-flex rounded-full bg-slate-100 p-1">
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
                  : "text-slate-500 hover:text-slate-700"
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
              <label className="text-sm font-medium text-slate-700">
                LUT email address
              </label>
              <input
                type="email"
                placeholder="firstname.lastname@lut.fi"
                {...loginForm.register("email", { required: true })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...loginForm.register("password", { required: true })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
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
              <label className="text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                type="text"
                placeholder="Aino Virtanen"
                {...signupForm.register("name", { required: true, minLength: 2 })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                LUT email address
              </label>
              <input
                type="email"
                placeholder="firstname.lastname@lut.fi"
                {...signupForm.register("email", { required: true })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                placeholder="Strong password"
                {...signupForm.register("password", { required: true, minLength: 8 })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Invite code
              </label>
              <input
                type="text"
                placeholder="Provided by programme lead"
                {...signupForm.register("inviteCode", { required: true })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
              <p className="text-xs text-slate-500">
                Need an invite? <button type="button" className="text-emerald-600 underline underline-offset-4" onClick={() => setShowRequestForm(true)}>Request access</button>
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400/90 px-6 py-3 text-base font-semibold text-sky-950 transition hover:bg-emerald-300"
            >
              Create account
            </button>
          </form>
        )}
        {showRequestForm && (
          <form
            onSubmit={requestForm.handleSubmit(handleRequestAccess)}
            className="mt-8 space-y-4 rounded-2xl border border-emerald-300/40 bg-emerald-50 p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-emerald-900">Request an invite</h3>
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="text-xs uppercase tracking-wide text-emerald-600"
              >
                Close
              </button>
            </div>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                LUT email
              </span>
              <input
                type="email"
                placeholder="firstname.lastname@lut.fi"
                {...requestForm.register("email", { required: true })}
                className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Full name
              </span>
              <input
                type="text"
                placeholder="Preferred display name"
                {...requestForm.register("name")}
                className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Context (optional)
              </span>
              <textarea
                rows={3}
                placeholder="Which groups will you be teaching?"
                {...requestForm.register("context")}
                className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
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
