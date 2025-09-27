import { NextResponse } from "next/server";
import {
  approveAccessRequest,
  declineAccessRequest,
} from "@/lib/teachers";
import { parseTokenFromRequest } from "@/lib/apiAuth";

function ensureAdmin(token) {
  if (!token || token.role !== "admin") {
    throw new Error("Administrator access required");
  }
}

export async function POST(req) {
  try {
    const token = parseTokenFromRequest(req);
    ensureAdmin(token);

    const body = await req.json();
    if (!body.requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
    }

    const role = body.role || "teacher";
    const expiresInDays = body.expiresInDays ?? 14;
    const note = body.note || "";

    const result = await approveAccessRequest({
      requestId: body.requestId,
      handledBy: token.email || token.teacherId,
      role,
      expiresInDays,
      note,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const statusCode =
      error.message === "Administrator access required" ? 403 : 400;
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to approve request" },
      { status: statusCode }
    );
  }
}

export async function PATCH(req) {
  try {
    const token = parseTokenFromRequest(req);
    ensureAdmin(token);

    const body = await req.json();
    if (!body.requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
    }

    const result = await declineAccessRequest({
      requestId: body.requestId,
      handledBy: token.email || token.teacherId,
      note: body.note || "",
    });

    return NextResponse.json({ request: result });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const statusCode =
      error.message === "Administrator access required" ? 403 : 400;
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to update request" },
      { status: statusCode }
    );
  }
}
