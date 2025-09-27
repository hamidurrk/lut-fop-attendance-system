import { NextResponse } from "next/server";
import { parseTokenFromRequest, handleError } from "@/lib/apiAuth";
import { markAttendance } from "@/lib/attendance";

export async function POST(req) {
  try {
    const token = parseTokenFromRequest(req);
    const { recordId, qrPayload, teacherId: overrideTeacherId } = await req.json();

    if (!recordId || !qrPayload) {
      return NextResponse.json(
        { error: "recordId and qrPayload are required" },
        { status: 400 }
      );
    }

    const targetTeacherId =
      token.role === "admin" && overrideTeacherId
        ? overrideTeacherId
        : token.teacherId;

    const result = await markAttendance({
      recordId,
      teacherId: targetTeacherId,
      rawQr: qrPayload,
    });

    return NextResponse.json({ attendance: result });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleError(error, "Unable to mark attendance");
  }
}
