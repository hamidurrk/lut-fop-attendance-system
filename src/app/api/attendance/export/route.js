import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseTokenFromRequest } from "@/lib/apiAuth";
import { getAttendanceRecord } from "@/lib/attendance";

function formatFilename(base, extension) {
  const safeBase = base.replace(/[^a-z0-9\-]+/gi, "_").slice(0, 80) || "attendance";
  return `${safeBase}.${extension}`;
}

function formatDisplayDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function recordTitle(record) {
  return `${record.className || "Class"} - ${record.recordName || "Session"}`;
}

async function buildExcel(record) {
  const rows = [
    ["Class", record.className || ""],
    ["Session", record.recordName || ""],
    ["Created", formatDisplayDate(record.createdAt)],
    ["Teacher", record.teacherId || ""],
    [],
    ["Student ID", "Student Name", "Timestamp"],
    ...record.attendees.map((student) => [
      student.studentId,
      student.studentName,
      formatDisplayDate(student.timestamp),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

async function buildPdf(record) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  const { height } = page.getSize();
  let cursor = height - 60;

  const writeLine = (text, size = 12, weight = "normal") => {
    if (cursor < 60) {
      page = pdfDoc.addPage();
      cursor = page.getSize().height - 60;
    }

    const fontSize = weight === "bold" ? size + 2 : size;
    page.drawText(text, {
      x: 50,
      y: cursor,
      size: fontSize,
      font,
    });
    cursor -= fontSize + 8;
  };

  writeLine("LUT FOP Attendance", 18, "bold");
  writeLine(recordTitle(record), 14);
  writeLine(`Created: ${formatDisplayDate(record.createdAt)}`);
  writeLine(`Teacher: ${record.teacherId || ""}`);
  cursor -= 10;
  writeLine("Attendees", 14, "bold");

  if (record.attendees.length === 0) {
    writeLine("No attendees have been recorded yet.");
  } else {
    record.attendees.forEach((student, index) => {
      writeLine(
        `${index + 1}. ${student.studentName} (${student.studentId}) — ${formatDisplayDate(student.timestamp)}`
      );
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function GET(req) {
  try {
    const token = parseTokenFromRequest(req);
    const url = new URL(req.url);
    const recordId = url.searchParams.get("recordId");
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId is required" },
        { status: 400 }
      );
    }

    const format = (url.searchParams.get("format") || "excel").toLowerCase();
    const overrideTeacherId = url.searchParams.get("teacherId") || undefined;

    const isAdmin = token.role === "admin";
    const record = await getAttendanceRecord({
      recordId,
      teacherId: isAdmin ? overrideTeacherId : token.teacherId,
      isAdmin,
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let buffer;
    let contentType;
    let extension;

    if (format === "pdf") {
      buffer = await buildPdf(record);
      contentType = "application/pdf";
      extension = "pdf";
    } else {
      buffer = await buildExcel(record);
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    }

    const filename = formatFilename(recordTitle(record), extension);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    if (error.message === "Missing token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Unable to export attendance" },
      { status: 400 }
    );
  }
}
