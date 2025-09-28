export function encodeStudentQR({ studentId, studentName }) {
  // Simple format: ID|Name - preserve leading zeros in ID
  return `${studentId}|${studentName.trim()}`;
}

export function parseStudentQR(raw) {
  try {
    const parts = raw.split('|');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    return {
      studentId: parts[0], // Keep as string, preserve leading zeros
      studentName: parts[1].trim(),
    };
  } catch (error) {
    return null;
  }
}
