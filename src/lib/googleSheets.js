const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]; // read/write

export const TEACHER_HEADERS = [
  "teacher_id",
  "email",
  "password_hash",
  "role",
];

export const ATTENDANCE_HEADERS = [
  "record_id",
  "teacher_id",
  "class_name",
  "record_name",
  "student_id",
  "student_name",
  "timestamp",
];

export const INVITE_HEADERS = [
  "invite_code",
  "email",
  "role",
  "status",
  "created_by",
  "created_at",
  "expires_at",
  "used_by",
  "used_at",
  "note",
];

export const REQUEST_HEADERS = [
  "request_id",
  "email",
  "name",
  "context",
  "status",
  "created_at",
  "handled_by",
  "handled_at",
  "note",
];

const DEFAULT_INVITES_SHEET = "TeacherInvites";
const DEFAULT_REQUESTS_SHEET = "TeacherRequests";

let sheetsClientPromise;

function getEnvVar(key, optional = false) {
  const value = process.env[key];
  if (!value && !optional) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getSpreadsheetId() {
  return getEnvVar("GOOGLE_SPREADSHEET_ID");
}

async function getSheetsClient() {
  if (sheetsClientPromise) {
    return sheetsClientPromise;
  }

  sheetsClientPromise = (async () => {
    const { google } = await import("googleapis");
    const clientEmail = getEnvVar("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = getEnvVar("GOOGLE_SERVICE_ACCOUNT_KEY");

    const jwt = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });

    return google.sheets({
      version: "v4",
      auth: jwt,
    });
  })();

  return sheetsClientPromise;
}

async function ensureHeaders(sheetName, headers) {
  if (!headers?.length) return;
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  let currentHeaders = [];
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      majorDimension: "ROWS",
    });
    currentHeaders = response.data.values?.[0] ?? [];
  } catch (error) {
    // If the sheet is missing entirely, the Sheets API throws; we attempt to create headers anyway.
    console.warn(`Unable to read headers for ${sheetName}:`, error.message);
  }

  const needsUpdate =
    currentHeaders.length === 0 ||
    headers.some(
      (header, index) => header !== (currentHeaders[index] || "").trim()
    );

  if (needsUpdate) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!1:${1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });
  }
}

export async function appendRow(sheetName, values, headers) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureHeaders(sheetName, headers);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
}

export async function readRows(sheetName, headers) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureHeaders(sheetName, headers);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    return { headers: headers ?? [], rows: [] };
  }

  const [detectedHeaders, ...data] = rows;
  return { headers: detectedHeaders, rows: data };
}

export async function batchAppend(sheetName, rows, headers) {
  if (!rows.length) return;
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureHeaders(sheetName, headers);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });
}

export function teacherSheetName() {
  return getEnvVar("GOOGLE_TEACHERS_SHEET");
}

export function attendanceSheetName() {
  return getEnvVar("GOOGLE_ATTENDANCE_SHEET");
}

export function teacherInviteSheetName() {
  return (
    process.env.GOOGLE_TEACHER_INVITES_SHEET || DEFAULT_INVITES_SHEET
  );
}

export function teacherRequestSheetName() {
  return (
    process.env.GOOGLE_TEACHER_REQUESTS_SHEET || DEFAULT_REQUESTS_SHEET
  );
}

export async function updateRow(sheetName, rowIndex, values) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const columnEnd = String.fromCharCode("A".charCodeAt(0) + Math.max(values.length - 1, 0));
  const range = `${sheetName}!A${rowIndex}:${columnEnd}${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
}
