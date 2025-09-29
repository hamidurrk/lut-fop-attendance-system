import crypto from "crypto";
import {
  appendRow,
  readRows,
  attendanceSheetName,
  teacherSheetName,
  ATTENDANCE_HEADERS,
  TEACHER_HEADERS,
} from "@/lib/googleSheets";
import { parseStudentQR } from "@/lib/qrFormat";

const META_FLAG = "__meta__";

function normalizeString(value) {
  return value ? String(value).trim() : "";
}

async function fetchTeacherDirectory() {
  const { headers, rows } = await readRows(teacherSheetName(), TEACHER_HEADERS);
  const normalizedHeaders = headers.map((header) =>
    header ? String(header).trim().toLowerCase() : ""
  );

  const teacherIdIndex = normalizedHeaders.indexOf("teacher_id");
  if (teacherIdIndex === -1) {
    return new Map();
  }

  const nameIndex = normalizedHeaders.indexOf("name");
  const emailIndex = normalizedHeaders.indexOf("email");
  const roleIndex = normalizedHeaders.indexOf("role");

  const directory = new Map();

  for (const row of rows) {
    const teacherId = normalizeString(row[teacherIdIndex]);
    if (!teacherId) {
      continue;
    }

    const entry = {
      teacherId,
      name: nameIndex !== -1 ? normalizeString(row[nameIndex]) : "",
      email: emailIndex !== -1 ? normalizeString(row[emailIndex]) : "",
      role:
        roleIndex !== -1 && normalizeString(row[roleIndex])
          ? normalizeString(row[roleIndex])
          : "teacher",
    };

    directory.set(teacherId, entry);
  }

  return directory;
}

export async function createAttendanceRecord({
  teacherId,
  className,
  recordName,
}) {
  const cleanClass = normalizeString(className);
  const cleanRecord = normalizeString(recordName);

  if (!cleanClass || !cleanRecord) {
    throw new Error("Class name and record name are required.");
  }

  const recordId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await appendRow(
    attendanceSheetName(),
    [
      recordId,
      teacherId,
      cleanClass,
      cleanRecord,
      META_FLAG,
      META_FLAG,
      timestamp,
    ],
    ATTENDANCE_HEADERS
  );

  return {
    recordId,
    className: cleanClass,
    recordName: cleanRecord,
    createdAt: timestamp,
  };
}

export async function markAttendance({
  recordId,
  teacherId,
  rawQr,
}) {
  if (!recordId || !rawQr) {
    throw new Error("Record ID and QR payload are required.");
  }

  const parsed = parseStudentQR(rawQr);
  if (!parsed) {
    throw new Error("Invalid QR code detected.");
  }

  const { rows } = await readRows(attendanceSheetName(), ATTENDANCE_HEADERS);
  const timestamp = new Date().toISOString();

  // Find the meta record to get className and recordName
  const metaRecord = rows.find((row) => {
    const [rowRecordId, rowTeacherId, , , studentId] = row;
    return (
      normalizeString(rowRecordId) === recordId &&
      normalizeString(rowTeacherId) === teacherId &&
      normalizeString(studentId) === META_FLAG
    );
  });

  if (!metaRecord) {
    throw new Error(
      "Record not found. Ensure you created the record before scanning."
    );
  }

  // Extract className and recordName from the meta record
  const [, , className, recordName] = metaRecord;

  const duplicate = rows.find((row) => {
    const [rowRecordId, rowTeacherId, , , studentId] = row;
    return (
      normalizeString(rowRecordId) === recordId &&
      normalizeString(rowTeacherId) === teacherId &&
      normalizeString(studentId) === parsed.studentId
    );
  });

  if (duplicate) {
    throw new Error("Student already marked for this record.");
  }

  await appendRow(
    attendanceSheetName(),
    [
      recordId,
      teacherId,
      className, // Now includes the actual className
      recordName, // Now includes the actual recordName
      parsed.studentId,
      parsed.studentName,
      timestamp,
    ],
    ATTENDANCE_HEADERS
  );

  return {
    studentId: parsed.studentId,
    studentName: parsed.studentName,
    timestamp,
  };
}

export async function listAttendance({ teacherId, isAdmin }) {
  const { rows } = await readRows(attendanceSheetName(), ATTENDANCE_HEADERS);
  const teacherDirectory = await fetchTeacherDirectory();
  const grouped = new Map();

  for (const row of rows) {
    const [
      recordId,
      rowTeacherId,
      className,
      recordName,
      studentId,
      studentName,
      timestamp,
    ] = row;

    const cleanTeacherId = normalizeString(rowTeacherId);
    if (!cleanTeacherId) continue;

    if (!isAdmin && cleanTeacherId !== teacherId) {
      continue;
    }

    const cleanRecordId = normalizeString(recordId);
    if (!cleanRecordId) continue;

    const cleanClass = normalizeString(className);
    const cleanRecordName = normalizeString(recordName);
    const cleanStudentId = normalizeString(studentId);
    const cleanStudentName = normalizeString(studentName);
    const teacherProfile = teacherDirectory.get(cleanTeacherId);

    if (!grouped.has(cleanRecordId)) {
      grouped.set(cleanRecordId, {
        recordId: cleanRecordId,
        teacherId: cleanTeacherId,
        teacherName: teacherProfile?.name || "",
        teacherEmail: teacherProfile?.email || "",
        className: cleanClass,
        recordName: cleanRecordName,
        createdAt: null,
        attendees: [],
      });
    }

    const bucket = grouped.get(cleanRecordId);

    if (teacherProfile) {
      bucket.teacherName = teacherProfile.name;
      bucket.teacherEmail = teacherProfile.email;
    }

    if (cleanClass) bucket.className = cleanClass;
    if (cleanRecordName) bucket.recordName = cleanRecordName;

    if (cleanStudentId === META_FLAG) {
      bucket.createdAt = timestamp || bucket.createdAt;
      continue;
    }

    if (cleanStudentId) {
      bucket.attendees.push({
        studentId: cleanStudentId,
        studentName: cleanStudentName,
        timestamp,
      });
    }
  }

  const byClass = new Map();
  for (const record of grouped.values()) {
    const key = record.className || "Ungrouped";
    const list = byClass.get(key) ?? [];
    list.push(record);
    byClass.set(key, list);
  }

  const recordsByClass = Array.from(byClass.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([className, records]) => ({
      className,
      records: records.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
      }),
    }));

  const teachers = Array.from(teacherDirectory.values()).sort((a, b) => {
    const aLabel = a.name || a.email || a.teacherId;
    const bLabel = b.name || b.email || b.teacherId;
    return aLabel.localeCompare(bLabel, undefined, { sensitivity: "base" });
  });

  return {
    records: recordsByClass,
    teachers,
  };
}

export async function getAttendanceRecord({
  recordId,
  teacherId,
  isAdmin,
}) {
  const targetId = normalizeString(recordId);
  if (!targetId) {
    throw new Error("Record ID is required");
  }

  const { rows } = await readRows(attendanceSheetName(), ATTENDANCE_HEADERS);
  const teacherDirectory = await fetchTeacherDirectory();
  const record = {
    recordId: targetId,
    teacherId: "",
    teacherName: "",
    teacherEmail: "",
    className: "",
    recordName: "",
    createdAt: null,
    attendees: [],
  };

  let found = false;

  for (const row of rows) {
    const [
      rowRecordId,
      rowTeacherId,
      className,
      recordName,
      studentId,
      studentName,
      timestamp,
    ] = row;

    if (normalizeString(rowRecordId) !== targetId) {
      continue;
    }

    const cleanTeacherId = normalizeString(rowTeacherId);
    if (!isAdmin && cleanTeacherId !== teacherId) {
      throw new Error("Not authorised to access this record");
    }

    if (!record.teacherId) {
      record.teacherId = cleanTeacherId;
    }

    if (cleanTeacherId && record.teacherId && record.teacherId !== cleanTeacherId) {
      record.teacherId = cleanTeacherId;
    }

    const teacherProfile = teacherDirectory.get(cleanTeacherId);
    if (teacherProfile) {
      record.teacherName = teacherProfile.name;
      record.teacherEmail = teacherProfile.email;
    }

    found = true;

    const cleanClass = normalizeString(className);
    const cleanRecordName = normalizeString(recordName);
    const cleanStudentId = normalizeString(studentId);
    const cleanStudentName = normalizeString(studentName);

    if (cleanClass) record.className = cleanClass;
    if (cleanRecordName) record.recordName = cleanRecordName;

    if (cleanStudentId === META_FLAG) {
      record.createdAt = timestamp || record.createdAt;
      continue;
    }

    if (cleanStudentId) {
      record.attendees.push({
        studentId: cleanStudentId,
        studentName: cleanStudentName,
        timestamp,
      });
    }
  }

  if (!found) {
    return null;
  }

  if (!record.teacherName && record.teacherId) {
    const teacherProfile = teacherDirectory.get(record.teacherId);
    if (teacherProfile) {
      record.teacherName = teacherProfile.name;
      record.teacherEmail = teacherProfile.email;
    }
  }

  record.attendees.sort((a, b) => {
    const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
    return aTime - bTime;
  });

  return record;
}
