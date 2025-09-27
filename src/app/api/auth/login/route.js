import { NextResponse } from "next/server";
import { verifyTeacherCredentials } from "@/lib/teachers";
import { signAuthToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const teacher = await verifyTeacherCredentials(email, password);
    if (!teacher) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signAuthToken({
      teacherId: teacher.teacherId,
      role: teacher.role,
      email: teacher.email,
    });

    return NextResponse.json({
      token,
      teacher: {
        teacherId: teacher.teacherId,
        email: teacher.email,
        role: teacher.role,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to log in" },
      { status: 500 }
    );
  }
}
