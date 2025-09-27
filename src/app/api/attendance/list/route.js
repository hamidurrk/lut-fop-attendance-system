import { NextResponse } from "next/server";
import { parseTokenFromRequest, handleError } from "@/lib/apiAuth";
import { listAttendance } from "@/lib/attendance";

export async function GET(req) {
  try {
    const token = parseTokenFromRequest(req);
    const searchParams = new URL(req.url).searchParams;
    const filterTeacherId = searchParams.get("teacherId");

    const isAdmin = token.role === "admin" && !filterTeacherId;
    const teacherId =
      token.role === "admin" && filterTeacherId
        ? filterTeacherId
        : token.teacherId;

    const records = await listAttendance({ teacherId, isAdmin });

    return NextResponse.json({ records });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleError(error, "Unable to fetch attendance records");
  }
}
