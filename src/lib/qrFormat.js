export const QR_PREFIX = "LUTFOP_ATTENDANCE";

export function encodeStudentQR({ studentId, studentName }) {
  return JSON.stringify({
    p: QR_PREFIX,
    id: studentId.trim(),
    name: studentName.trim(),
  });
}

export function parseStudentQR(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.p !== QR_PREFIX) {
      return null;
    }
    if (!parsed.id || !parsed.name) {
      return null;
    }
    return {
      studentId: String(parsed.id).trim(),
      studentName: String(parsed.name).trim(),
    };
  } catch (error) {
    return null;
  }
}
