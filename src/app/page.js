import Link from "next/link";

const actions = [
  {
    title: "Student Check-in",
    description:
      "Generate your personalised attendance QR code for marking attendance.",
    href: "/student",
    cta: "Create Student QR",
    accent: "from-emerald-100 to-white border-emerald-200",
  },
  {
    title: "Teacher Console",
    description:
      "Review attendance history, launch new sessions, and scan QR codes securely in one place.",
    href: "/teacher/login",
    cta: "Enter Teacher Portal",
    accent: "from-sky-100 to-white border-sky-200",
  },
];

export default function Home() {
  return (
    <div className="relative isolate overflow-hidden px-6 pb-24 pt-16 sm:pt-24 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-16 text-center">
        <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-slate-600 shadow-sm">
          LUT · Fundamentals of Programming
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
          LUT FoP Attendance Portal
        </h1>
        <p className="max-w-3xl text-pretty text-lg text-slate-600 sm:text-xl">
          Attendance system designed for LUT Fundamentals of Programming course students and teaching staff.
        </p>

        <div className="grid w-full gap-6 sm:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative flex flex-col gap-4 rounded-3xl border bg-gradient-to-br ${action.accent} p-8 text-left shadow-[0_25px_60px_-35px_rgba(148,163,184,0.55)] transition hover:-translate-y-1 hover:shadow-[0_30px_70px_-40px_rgba(148,163,184,0.6)]`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {action.title}
                </span>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition group-hover:scale-110 group-hover:text-slate-700">
                  →
                </span>
              </div>
              <p className="text-base text-slate-600">{action.description}</p>
              <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-900 shadow-sm transition group-hover:bg-emerald-50">
                {action.cta}
                <span className="translate-y-[1px] transition group-hover:translate-x-1">↗</span>
              </span>
            </Link>
          ))}
        </div>

      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_rgba(226,232,240,0)_65%)]" />
    </div>
  );
}
