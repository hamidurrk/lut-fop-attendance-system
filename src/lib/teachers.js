import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  appendRow,
  readRows,
  teacherSheetName,
  teacherInviteSheetName,
  teacherRequestSheetName,
  updateRow,
  TEACHER_HEADERS,
  INVITE_HEADERS,
  REQUEST_HEADERS,
} from "@/lib/googleSheets";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function rowsToObjects(headers, rows) {
  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });
    return obj;
  });
}

function objectsToRow(headers, obj) {
  return headers.map((header) => obj[header] ?? "");
}

function isoNow() {
  return new Date().toISOString();
}

function generateInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function sanitizeContext(value) {
  return value?.trim() ?? "";
}

function sanitizeName(value) {
  return value?.toString().trim() ?? "";
}

export async function findTeacherByEmail(email) {
  const { rows } = await readRows(teacherSheetName(), TEACHER_HEADERS);
  const lowerEmail = normalizeEmail(email);

  for (const row of rows) {
    const [teacherId, name, rowEmail, passwordHash, role] = row;
    if (rowEmail && rowEmail.trim().toLowerCase() === lowerEmail) {
      return {
        teacherId,
        name: sanitizeName(name),
        email: rowEmail,
        passwordHash,
        role: role || "teacher",
      };
    }
  }

  return null;
}

export async function createTeacher({ email, password, name, role = "teacher" }) {
  const existing = await findTeacherByEmail(email);
  if (existing) {
    throw new Error("A teacher account with this email already exists.");
  }

  const cleanName = sanitizeName(name);
  if (!cleanName) {
    throw new Error("Name is required to create a teacher account.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const teacherId = crypto.randomUUID();
  const normalizedEmail = normalizeEmail(email);

  await appendRow(
    teacherSheetName(),
    [teacherId, cleanName, normalizedEmail, passwordHash, role],
    TEACHER_HEADERS
  );

  return { teacherId, name: cleanName, email: normalizedEmail, role };
}

export async function verifyTeacherCredentials(email, password) {
  const teacher = await findTeacherByEmail(email);
  if (!teacher) {
    return null;
  }

  const isValid = await bcrypt.compare(password, teacher.passwordHash);
  if (!isValid) {
    return null;
  }

  return teacher;
}

export async function listTeachers() {
  const { rows, headers } = await readRows(teacherSheetName(), TEACHER_HEADERS);
  const teachers = rowsToObjects(headers, rows)
    .filter((entry) => entry.teacher_id)
    .map((entry) => ({
      teacherId: entry.teacher_id,
      name: sanitizeName(entry.name),
      email: entry.email ?? "",
      role: entry.role || "teacher",
    }));

  return teachers;
}

export async function createInvite({
  email,
  role = "teacher",
  createdBy,
  expiresInDays = 14,
  note = "",
}) {
  const inviteCode = generateInviteCode();
  const now = isoNow();
  const expiresAt = new Date(
    Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000
  ).toISOString();

  await appendRow(
    teacherInviteSheetName(),
    [
      inviteCode,
      email ? normalizeEmail(email) : "",
      role,
      "active",
      createdBy,
      now,
      expiresAt,
      "",
      "",
      note,
    ],
    INVITE_HEADERS
  );

  return {
    inviteCode,
    email: email ? normalizeEmail(email) : "",
    role,
    status: "active",
    createdBy,
    createdAt: now,
    expiresAt,
    note,
  };
}

async function listInvitesInternal() {
  const { rows, headers } = await readRows(
    teacherInviteSheetName(),
    INVITE_HEADERS
  );
  return rowsToObjects(headers, rows);
}

export async function listInvites({ status } = {}) {
  const invites = await listInvitesInternal();
  if (status) {
    return invites.filter(
      (invite) => invite.status.toLowerCase() === status.toLowerCase()
    );
  }
  return invites;
}

export async function consumeInvite(inviteCode, email) {
  const invites = await listInvitesInternal();
  const lookup = invites.findIndex(
    (invite) => invite.invite_code === inviteCode.trim().toUpperCase()
  );

  if (lookup === -1) {
    throw new Error("Invalid invite code. Please contact an administrator.");
  }

  const invite = invites[lookup];
  if (invite.status !== "active") {
    throw new Error("This invite code is not active.");
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw new Error("This invite code has expired.");
  }

  if (invite.email && normalizeEmail(invite.email) !== normalizeEmail(email)) {
    throw new Error("This invite is restricted to a different email address.");
  }

  const rowIndex = lookup + 2; // account for header row
  return { invite, rowIndex };
}

export async function markInviteUsed({ rowIndex, invite, teacherId, email }) {
  const updated = {
    ...invite,
    status: "used",
    used_by: teacherId,
    used_at: isoNow(),
    email: invite.email || normalizeEmail(email),
  };

  await updateRow(
    teacherInviteSheetName(),
    rowIndex,
    objectsToRow(INVITE_HEADERS, updated)
  );
}

export async function requestTeacherAccess({ email, name, context }) {
  const normalizedEmail = normalizeEmail(email);
  const requestId = crypto.randomUUID();

  const existingPending = (await listRequestsInternal()).find(
    (request) =>
      request.email === normalizedEmail && request.status.toLowerCase() === "pending"
  );

  if (existingPending) {
    throw new Error("You already have a pending access request. An admin will reach out soon.");
  }

  await appendRow(
    teacherRequestSheetName(),
    [
      requestId,
      normalizedEmail,
      sanitizeContext(name),
      sanitizeContext(context),
      "pending",
      isoNow(),
      "",
      "",
      "",
    ],
    REQUEST_HEADERS
  );

  return {
    requestId,
    email: normalizedEmail,
    name: sanitizeContext(name),
    context: sanitizeContext(context),
    status: "pending",
  };
}

async function listRequestsInternal() {
  const { rows, headers } = await readRows(
    teacherRequestSheetName(),
    REQUEST_HEADERS
  );
  return rowsToObjects(headers, rows);
}

export async function listAccessRequests({ status } = {}) {
  const requests = await listRequestsInternal();
  if (status) {
    return requests.filter(
      (request) => request.status.toLowerCase() === status.toLowerCase()
    );
  }
  return requests;
}

export async function markRequestHandled({
  requestId,
  handledBy,
  status = "approved",
  note = "",
}) {
  const requests = await listRequestsInternal();
  const index = requests.findIndex((request) => request.request_id === requestId);
  if (index === -1) {
    throw new Error("Request not found");
  }

  const updated = {
    ...requests[index],
    status,
    handled_by: handledBy,
    handled_at: isoNow(),
    note,
  };

  await updateRow(
    teacherRequestSheetName(),
    index + 2,
    objectsToRow(REQUEST_HEADERS, updated)
  );

  return updated;
}

export async function approveAccessRequest({
  requestId,
  handledBy,
  role = "teacher",
  expiresInDays = 14,
  note = "",
}) {
  const requests = await listRequestsInternal();
  const target = requests.find((request) => request.request_id === requestId);
  if (!target) {
    throw new Error("Request not found");
  }

  if (target.status !== "pending") {
    throw new Error("Only pending requests can be approved");
  }

  const invite = await createInvite({
    email: target.email,
    role,
    createdBy: handledBy,
    expiresInDays,
    note: note || `Approved request ${requestId}`,
  });

  const updatedRequest = await markRequestHandled({
    requestId,
    handledBy,
    status: "approved",
    note: `Invite ${invite.inviteCode}`,
  });

  return { invite, request: updatedRequest };
}

export async function declineAccessRequest({
  requestId,
  handledBy,
  note = "",
}) {
  return markRequestHandled({
    requestId,
    handledBy,
    status: "declined",
    note,
  });
}
