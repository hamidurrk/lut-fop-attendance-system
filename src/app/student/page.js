'use client';

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { encodeStudentQR } from "@/lib/qrFormat";

export default function StudentPage() {
  const [qrPayload, setQrPayload] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [studentMeta, setStudentMeta] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = ({ name, studentId }) => {
    const trimmedName = name.trim();
    const trimmedId = studentId.trim();

    if (!trimmedName || !trimmedId) {
      toast.error("Please provide both your name and student ID");
      return;
    }

    const payload = encodeStudentQR({ studentId: trimmedId, studentName: trimmedName });
    setQrPayload(payload);
    setStudentMeta({ name: trimmedName, studentId: trimmedId });
    toast.success("QR code generated. Screenshot or save it for check-in!");
  };

  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;

    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "H",
      color: {
        dark: "#22c55eff",
        light: "#0f172aff",
      },
      margin: 2,
      width: 220,
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch((error) => {
        console.error("Failed to generate QR code", error);
        if (!cancelled) {
          toast.error("Couldn't render the QR code. Try again.");
          setQrDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 pb-20 pt-16 sm:px-8 lg:py-24">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">Student QR Generator</h1>
        <p className="text-balance text-lg text-slate-300">
          Fill in your details once to receive a QR code. Present it to teachers before each Fundamentals of Programming exercise session.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur-sm"
        >
          <h2 className="text-2xl font-semibold text-white">Your details</h2>
          <p className="mt-2 text-sm text-slate-300">
            Use your official LUT student ID (e.g., 0123456). These values are encoded inside the QR code and visible to teachers when scanned.
          </p>

          <div className="mt-8 space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Full name</span>
              <input
                type="text"
                placeholder="Aino Virtanen"
                {...register("name", { required: true, minLength: 2 })}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-base text-white shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
              {errors.name && (
                <span className="text-xs text-emerald-300">
                  Name is required (min. 2 characters).
                </span>
              )}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Student ID</span>
              <input
                type="text"
                placeholder="0123456"
                {...register("studentId", { required: true, minLength: 4 })}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-base text-white shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
              {errors.studentId && (
                <span className="text-xs text-emerald-300">
                  Student ID is required (min. 4 characters).
                </span>
              )}
            </label>
          </div>

          <button
            type="submit"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400/90 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-300"
          >
            Generate QR code
          </button>
        </form>

        <div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">Your QR</h2>
            <p className="mt-2 text-sm text-slate-300">
              Keep a screenshot or wallet pass ready. Teachers will scan this to mark your attendance.
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            {qrPayload ? (
              qrDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-[220px] w-[220px] overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950 p-4 shadow-lg">
                    <Image
                      src={qrDataUrl}
                      alt="Generated student QR code"
                      fill
                      sizes="220px"
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="rounded-full bg-slate-800 px-4 py-1 text-xs text-slate-200">
                    {studentMeta?.name} · {studentMeta?.studentId}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-600">
                    …
                  </span>
                  <p>Rendering your QR code…</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-4 text-sm text-slate-400">
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-600 text-3xl text-slate-600">
                  ✱
                </span>
                <p>Submit the form to generate your individual QR code.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-4 text-left text-xs text-slate-300">
            <p className="font-semibold text-white">Privacy notice</p>
            <p className="mt-1">
              Your name and student ID are only visible to LUT teachers with the official scanner. No location or additional metadata is stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
