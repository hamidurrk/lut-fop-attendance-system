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
    const trimmedId = studentId; // Don't trim to preserve leading zeros

    if (!trimmedName || !trimmedId) {
      toast.error("Please provide both your name and student ID");
      return;
    }

    const payload = encodeStudentQR({ 
      studentId: trimmedId, // Preserve as string with leading zeros
      studentName: trimmedName
    });
    setQrPayload(payload);
    setStudentMeta({ 
      name: trimmedName, 
      studentId: trimmedId
    });
    toast.success("QR code generated. Screenshot or save it for check-in!");
  };

  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;

    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      margin: 2,
      width: 200,
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
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 pb-20 pt-16 text-slate-700 sm:px-8 lg:py-24">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">Student QR Generator</h1>
        <p className="text-balance text-lg text-slate-600">
          Fill in your details once to receive a QR code. Present it to teachers during each Fundamentals of Programming exercise session.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.25)]"
        >
          <h2 className="text-2xl font-semibold text-slate-900">Your details</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use your official LUT student ID (e.g., 001234567). These values are encoded inside the QR code and visible to teachers when scanned.
          </p>

          <div className="mt-8 space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Full name</span>
              <input
                type="text"
                placeholder="Aino Virtanen"
                {...register("name", { required: true, minLength: 2 })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
              {errors.name && (
                <span className="text-xs text-emerald-600">
                  Name is required (min. 2 characters).
                </span>
              )}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Student ID</span>
              <input
                type="text"
                placeholder="001234567"
                {...register("studentId", { required: true, minLength: 9 })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-300/30"
              />
              {errors.studentId && (
                <span className="text-xs text-emerald-600">
                  Student ID is required (min. 9 characters).
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

        <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-[0_24px_55px_-30px_rgba(15,23,42,0.25)]">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Your QR</h2>
            <p className="mt-2 text-sm text-slate-600">
              Keep a screenshot or wallet pass ready. Teachers will scan this to mark your attendance.
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            {qrPayload ? (
              qrDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-[220px] w-[220px] overflow-hidden rounded-2xl border border-emerald-400/40 bg-white p-4 shadow-lg">
                    <Image
                      src={qrDataUrl}
                      alt="Generated student QR code"
                      fill
                      sizes="220px"
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="rounded-full bg-emerald-50 px-4 py-1 text-xs text-emerald-800">
                    {studentMeta?.name} · {studentMeta?.studentId}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                    …
                  </span>
                  <p>Rendering your QR code…</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 text-3xl text-slate-400">
                  ✱
                </span>
                <p>Submit the form to generate your individual QR code.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-slate-300 p-4 text-left text-xs text-emerald-900">
            <p className="font-semibold text-slate-600">Privacy notice</p>
            <p className="mt-1 text-slate-600">
              Your name and student ID are only visible to LUT teachers with the official scanner. No location or additional metadata is stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
