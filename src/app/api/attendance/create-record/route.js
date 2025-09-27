import { NextResponse } from "next/server";
import { parseTokenFromRequest, handleError } from "@/lib/apiAuth";
import { createAttendanceRecord } from "@/lib/attendance";

export async function POST(req) {
  try {
    const token = parseTokenFromRequest(req);
    const { className, recordName } = await req.json();

    const record = await createAttendanceRecord({
      teacherId: token.teacherId,
      className,
      recordName,
    });

    return NextResponse.json({ record });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleError(error, "Unable to create record");
  }
}
