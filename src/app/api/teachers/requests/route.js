import { NextResponse } from "next/server";
import {
  requestTeacherAccess,
  listAccessRequests,
} from "@/lib/teachers";
import { parseTokenFromRequest } from "@/lib/apiAuth";

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, name = "", context = "" } = body;
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const request = await requestTeacherAccess({ email, name, context });
    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to submit request" },
      { status: 400 }
    );
  }
}

export async function GET(req) {
  try {
    const token = parseTokenFromRequest(req);
    if (!token || token.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const status = searchParams.get("status") || undefined;
    const requests = await listAccessRequests({ status });

    return NextResponse.json({ requests });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to fetch requests" },
      { status: 400 }
    );
  }
}
