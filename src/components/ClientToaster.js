'use client';

import { Toaster } from "react-hot-toast";

export default function ClientToaster() {
  return <Toaster position="top-right" toastOptions={{ duration: 4000 }} />;
}
