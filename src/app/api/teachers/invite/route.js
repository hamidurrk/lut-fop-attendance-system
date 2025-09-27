import { NextResponse } from "next/server";
import {
  createInvite,
  listInvites,
} from "@/lib/teachers";
import { parseTokenFromRequest } from "@/lib/apiAuth";

function ensureAdmin(token) {
  if (!token || token.role !== "admin") {
    throw new Error("Administrator access required");
  }
}

export async function GET(req) {
  try {
    const token = parseTokenFromRequest(req);
    ensureAdmin(token);

    const searchParams = new URL(req.url).searchParams;
    const status = searchParams.get("status") || undefined;
    const invites = await listInvites({ status });

    return NextResponse.json({ invites });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const statusCode =
      error.message === "Administrator access required" ? 403 : 400;
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to fetch invites" },
      { status: statusCode }
    );
  }
}

export async function POST(req) {
  try {
    const token = parseTokenFromRequest(req);
    ensureAdmin(token);

    const body = await req.json();
    const invite = await createInvite({
      email: body.email || "",
      role: body.role || "teacher",
      expiresInDays: body.expiresInDays ?? 14,
      note: body.note || "",
      createdBy: token.email || token.teacherId,
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const statusCode =
      error.message === "Administrator access required" ? 403 : 400;
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to create invite" },
      { status: statusCode }
    );
  }
}
