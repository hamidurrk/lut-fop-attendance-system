import { NextResponse } from "next/server";
import {
  createTeacher,
  consumeInvite,
  markInviteUsed,
} from "@/lib/teachers";
import { signAuthToken } from "@/lib/jwt";
import { handleError } from "@/lib/apiAuth";

function validateSignupPayload(body) {
  const errors = [];
  if (!body.email) errors.push("Email is required");
  if (!body.password) errors.push("Password is required");
  if (body.password && body.password.length < 8)
    errors.push("Password must be at least 8 characters long");

  return errors;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const errors = validateSignupPayload(body);
    if (errors.length) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { email, password, inviteCode } = body;
    if (!inviteCode) {
      return NextResponse.json(
        {
          error:
            "An invite code is required. Request access or contact an administrator.",
        },
        { status: 403 }
      );
    }

    const inviteInfo = await consumeInvite(inviteCode, email);
    const role = inviteInfo.invite.role || "teacher";

    const teacher = await createTeacher({ email, password, role });
    await markInviteUsed({
      rowIndex: inviteInfo.rowIndex,
      invite: inviteInfo.invite,
      teacherId: teacher.teacherId,
      email,
    });
    const token = signAuthToken({
      teacherId: teacher.teacherId,
      email: teacher.email,
      role: teacher.role,
    });

    return NextResponse.json(
      {
        token,
        teacher,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error, "Unable to sign up");
  }
}
