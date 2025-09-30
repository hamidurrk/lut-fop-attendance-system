import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientToaster from "@/components/ClientToaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "LUT FOP Attendance Portal",
  description:
    "Responsive attendance management for LUT's Fundamentals of Programming sessions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}
      >
        <ClientToaster />
        <div className="min-h-screen bg-gradient-to-br from-white via-sky-50/60 to-blue-50/40">
          {children}
        </div>
      </body>
    </html>
  );
}
