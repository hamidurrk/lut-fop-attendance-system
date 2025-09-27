import Link from "next/link";

const actions = [
  {
    title: "Student Check-in",
    description:
      "Generate your personalised attendance QR code in seconds before the exercise session begins.",
    href: "/student",
    cta: "Create Student QR",
    accent: "from-emerald-400/40 to-emerald-500/20 border-emerald-500/40",
  },
  {
    title: "Teacher Console",
    description:
      "Review attendance history, launch new sessions, and scan QR codes securely in one place.",
    href: "/teacher/login",
    cta: "Enter Teacher Portal",
    accent: "from-sky-400/40 to-sky-500/20 border-sky-500/40",
  },
];

export default function Home() {
  return (
    <div className="relative isolate overflow-hidden px-6 pb-24 pt-16 sm:pt-24 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-16 text-center">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-slate-300">
          LUT · Fundamentals of Programming
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          Effortless attendance for every exercise session.
        </h1>
        <p className="max-w-3xl text-pretty text-lg text-slate-300 sm:text-xl">
          A modern attendance system co-designed for LUT students and teaching staff. Generate QR codes instantly, scan securely, and centralise every record in Google Sheets for verifiable audit trails.
        </p>

        <div className="grid w-full gap-6 sm:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative flex flex-col gap-4 rounded-3xl border bg-gradient-to-br ${action.accent} p-8 text-left shadow-[0_25px_60px_-35px_rgba(14,165,233,0.45)] transition hover:-translate-y-1 hover:bg-opacity-70`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
                  {action.title}
                </span>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-lg text-white/80 transition group-hover:scale-110">
                  →
                </span>
              </div>
              <p className="text-base text-slate-200/90">{action.description}</p>
              <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition group-hover:bg-white/20">
                {action.cta}
                <span className="translate-y-[1px] transition group-hover:translate-x-1">↗</span>
              </span>
            </Link>
          ))}
        </div>

  <div className="w-full rounded-3xl border border-white/5 bg-white/10 p-8 text-left backdrop-blur-md sm:p-10">
          <h2 className="text-2xl font-semibold text-white">
            Why this works for LUT
          </h2>
          <ul className="mt-6 grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
            <li className="rounded-2xl border border-white/5 bg-white/5 p-4">
              ✅ Fully responsive and mobile-first—perfect for scanning on the go.
            </li>
            <li className="rounded-2xl border border-white/5 bg-white/5 p-4">
              ✅ Secure Google Sheets integration with immutable audit trails.
            </li>
            <li className="rounded-2xl border border-white/5 bg-white/5 p-4">
              ✅ Admin oversight across all classes and teachers with role-based access.
            </li>
            <li className="rounded-2xl border border-white/5 bg-white/5 p-4">
              ✅ QR verification logic prevents spoofed attendance submissions.
            </li>
          </ul>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.35),_rgba(15,23,42,0)_60%)]" />
    </div>
  );
}
