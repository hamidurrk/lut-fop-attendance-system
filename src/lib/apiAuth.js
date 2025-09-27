import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function parseTokenFromRequest(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    throw new Error("Missing token");
  }
  return verifyAuthToken(token);
}

export function handleError(error, defaultMessage = "Something went wrong") {
  console.error(error);
  return NextResponse.json(
    { error: error.message || defaultMessage },
    { status: 400 }
  );
}
