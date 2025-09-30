"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";

const AUTH_STORAGE_KEY = "lut-fop-auth";

function loadAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Failed to parse auth payload", error);
    return null;
  }
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

function makeExportFilename(record, extension) {
  const base = `${record.className || "class"}-${record.recordName || "session"}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "attendance"}.${extension}`;
}

const QR_SCANNER_BENIGN_ERROR_NAMES = new Set([
  "No QR code found",
  "QR code parse error",
  "Camera error"
]);

export default function TeacherDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [records, setRecords] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ className: "", recordName: "" });
  const [activeRecord, setActiveRecord] = useState(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannedStudents, setScannedStudents] = useState(new Map());
  const [selectedTeacher, setSelectedTeacher] = useState("all");
  const [adminTab, setAdminTab] = useState("analytics");
  const [analyticsClassFilter, setAnalyticsClassFilter] = useState("all");
  const [analyticsRecordFilter, setAnalyticsRecordFilter] = useState("all");
  const [graphStartDate, setGraphStartDate] = useState("");
  const [graphEndDate, setGraphEndDate] = useState("");
  const [invites, setInvites] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "teacher",
    expiresInDays: 14,
    note: "",
  });
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [handlingRequest, setHandlingRequest] = useState(null);
  const [downloadingRecord, setDownloadingRecord] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [scannerStatus, setScannerStatus] = useState("idle");
  const isAdmin = auth?.teacher.role === "admin";
  const teacherDisplayName =
    auth?.teacher?.name?.trim() || auth?.teacher?.email || "";
  const teacherDisplayEmail =
    auth?.teacher?.name?.trim() ? auth?.teacher?.email : "";
  
  const html5QrCodeRef = useRef(null);
  const scannerElementRef = useRef(null);
  const processedQrsRef = useRef(new Set());
  const lastQrRef = useRef(null);
  const lastQrTimeRef = useRef(0);
  const restartTimerRef = useRef(null);
  const isScannerActiveRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isSwitchingRef = useRef(false);
  const desiredDeviceIdRef = useRef(null);

  useEffect(() => {
    const stored = loadAuth();
    if (!stored) {
      router.replace("/teacher/login");
      return;
    }
    setAuth(stored);
  }, [router]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }
    const mobileCheck = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobileDevice(mobileCheck);
  }, []);

  const refreshRecords = useCallback(
    async (override = {}) => {
      if (!auth?.token) return;
      try {
        setLoading(true);
        const teacherFilter = override.teacherId ?? selectedTeacher;
        const query =
          auth.teacher.role === "admin" && teacherFilter !== "all"
            ? `?teacherId=${teacherFilter}`
            : "";
        const data = await api(`/api/attendance/list${query}`, {
          token: auth.token,
        });
        setRecords(data.records ?? []);
        setTeachers(data.teachers ?? []);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    },
    [auth, selectedTeacher]
  );

  useEffect(() => {
    if (!auth?.token) return;
    refreshRecords();
  }, [auth, selectedTeacher, refreshRecords]);

  const teacherMap = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      if (teacher?.teacherId) {
        map.set(teacher.teacherId, teacher);
      }
    });
    return map;
  }, [teachers]);

  const uniqueTeachers = useMemo(() => {
    const lookup = new Map();

    teachers.forEach((teacher) => {
      if (!teacher?.teacherId) return;
      lookup.set(teacher.teacherId, {
        teacherId: teacher.teacherId,
        name:
          teacher.name?.trim() || teacher.email?.trim() || teacher.teacherId,
        email: teacher.email || "",
        role: teacher.role || "teacher",
      });
    });

    records?.forEach((group) => {
      group.records.forEach((record) => {
        const id = record.teacherId;
        if (!id || lookup.has(id)) return;
        lookup.set(id, {
          teacherId: id,
          name:
            record.teacherName?.trim() || record.teacherEmail || id,
          email: record.teacherEmail || "",
          role: teacherMap.get(id)?.role || "teacher",
        });
      });
    });

    return Array.from(lookup.values()).sort((a, b) => {
      const aName = a.name || a.teacherId;
      const bName = b.name || b.teacherId;
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
  }, [records, teachers, teacherMap]);

  const analytics = useMemo(() => {
    const summary = {
      totalSessions: 0,
      totalAttendees: 0,
      uniqueStudents: 0,
      classSummaries: [],
      topClasses: [],
      teacherActivity: [],
      minDateIso: "",
      maxDateIso: "",
    };

    if (!records?.length) {
      return summary;
    }

    const studentIds = new Set();
    const classMap = new Map();
    let minTimestamp = null;
    let maxTimestamp = null;

    records.forEach((group) => {
      const className = group.className?.trim() || "Class";
      if (!group?.records?.length) {
        return;
      }

      let classEntry = classMap.get(className);
      if (!classEntry) {
        classEntry = {
          className,
          totalSessions: 0,
          totalAttendees: 0,
          records: new Map(),
          teachers: new Map(),
        };
        classMap.set(className, classEntry);
      }

      group.records.forEach((record) => {
        const attendees = Array.isArray(record.attendees)
          ? record.attendees
          : [];
        const attendeeCount = attendees.length;

        summary.totalSessions += 1;
        summary.totalAttendees += attendeeCount;
        classEntry.totalSessions += 1;
        classEntry.totalAttendees += attendeeCount;

        attendees.forEach((student) => {
          const id =
            student?.studentId ?? student?.id ?? student?.qrId ?? null;
          if (id) {
            studentIds.add(String(id));
          }
        });

        if (record.createdAt) {
          const timestamp = Date.parse(record.createdAt);
          if (!Number.isNaN(timestamp)) {
            if (minTimestamp === null || timestamp < minTimestamp) {
              minTimestamp = timestamp;
            }
            if (maxTimestamp === null || timestamp > maxTimestamp) {
              maxTimestamp = timestamp;
            }
          }
        }

        const recordKey =
          record.recordId ||
          `${classEntry.className}::${record.recordName || "Session"}`;
        let recordEntry = classEntry.records.get(recordKey);
        const teacherId = record.teacherId || null;
        const teacherInfo = teacherId ? teacherMap.get(teacherId) : undefined;
        if (!recordEntry) {
          recordEntry = {
            recordId: record.recordId || recordKey,
            recordName: record.recordName || "Session",
            attendeeCount: 0,
            createdAt: record.createdAt || null,
            teacherId: teacherId,
            teacherName:
              record.teacherName?.trim() ||
              teacherInfo?.name?.trim() ||
              "",
            teacherEmail: record.teacherEmail || teacherInfo?.email || "",
          };
          classEntry.records.set(recordKey, recordEntry);
        }

        recordEntry.attendeeCount += attendeeCount;
        if (record.createdAt) {
          if (!recordEntry.createdAt) {
            recordEntry.createdAt = record.createdAt;
          } else {
            const existingTimestamp = Date.parse(recordEntry.createdAt);
            const nextTimestamp = Date.parse(record.createdAt);
            if (
              !Number.isNaN(nextTimestamp) &&
              (Number.isNaN(existingTimestamp) || nextTimestamp > existingTimestamp)
            ) {
              recordEntry.createdAt = record.createdAt;
            }
          }
        }
        if (!recordEntry.teacherName?.trim()) {
          recordEntry.teacherName =
            record.teacherName?.trim() ||
            teacherInfo?.name?.trim() ||
            recordEntry.teacherName ||
            "";
        }
        if (!recordEntry.teacherEmail) {
          recordEntry.teacherEmail =
            record.teacherEmail || teacherInfo?.email || recordEntry.teacherEmail;
        }
        if (!recordEntry.teacherId && teacherId) {
          recordEntry.teacherId = teacherId;
        }

        const teacherKey = teacherId || "unknown";
        let teacherEntry = classEntry.teachers.get(teacherKey);
        const teacherFallback = teacherId ? teacherMap.get(teacherId) : undefined;
        if (!teacherEntry) {
          teacherEntry = {
            teacherId: teacherKey,
            teacherName:
              record.teacherName?.trim() ||
              teacherFallback?.name?.trim() ||
              (teacherKey === "unknown" ? "Unknown" : teacherKey),
            teacherEmail: record.teacherEmail || teacherFallback?.email || "",
            sessionCount: 0,
            attendeeCount: 0,
          };
          classEntry.teachers.set(teacherKey, teacherEntry);
        }

        teacherEntry.sessionCount += 1;
        teacherEntry.attendeeCount += attendeeCount;

        if (
          (!teacherEntry.teacherName || teacherEntry.teacherName === "Unknown") &&
          record.teacherName?.trim()
        ) {
          teacherEntry.teacherName = record.teacherName.trim();
        }
        if (!teacherEntry.teacherEmail && record.teacherEmail) {
          teacherEntry.teacherEmail = record.teacherEmail;
        }
      });
    });

    summary.uniqueStudents = studentIds.size;

    const classSummaries = Array.from(classMap.values()).map((classEntry) => {
      const recordsByDate = Array.from(classEntry.records.values()).sort(
        (a, b) => {
          const dateA = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
          const dateB = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;

          if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
            return dateB - dateA;
          }
          if (!Number.isNaN(dateA)) return -1;
          if (!Number.isNaN(dateB)) return 1;
          return (a.recordName || "").localeCompare(b.recordName || "");
        }
      );

      const recordsByAttendance = recordsByDate
        .slice()
        .sort((a, b) => {
          if (b.attendeeCount !== a.attendeeCount) {
            return b.attendeeCount - a.attendeeCount;
          }
          return (a.recordName || "").localeCompare(b.recordName || "");
        });

      const teacherList = Array.from(classEntry.teachers.values()).sort(
        (a, b) => {
          if (b.attendeeCount !== a.attendeeCount) {
            return b.attendeeCount - a.attendeeCount;
          }
          if (b.sessionCount !== a.sessionCount) {
            return b.sessionCount - a.sessionCount;
          }
          return (a.teacherName || a.teacherId || "").localeCompare(
            b.teacherName || b.teacherId || ""
          );
        }
      );

      const primaryTeacher = teacherList[0] || null;

      return {
        className: classEntry.className,
        totalSessions: classEntry.totalSessions,
        totalAttendees: classEntry.totalAttendees,
        records: recordsByDate,
        recordsByAttendance,
        teacherList,
        primaryTeacher,
      };
    });

    summary.classSummaries = classSummaries;
    summary.topClasses = classSummaries
      .slice()
      .sort((a, b) => b.totalAttendees - a.totalAttendees);

    summary.teacherActivity = classSummaries
      .map((cls) => ({
        className: cls.className,
        primaryTeacher: cls.primaryTeacher,
        additionalTeachers: cls.teacherList.slice(1),
        totalSessions: cls.totalSessions,
        totalAttendees: cls.totalAttendees,
      }))
      .sort((a, b) => b.totalAttendees - a.totalAttendees);

    summary.minDateIso = minTimestamp
      ? new Date(minTimestamp).toISOString().slice(0, 10)
      : "";
    summary.maxDateIso = maxTimestamp
      ? new Date(maxTimestamp).toISOString().slice(0, 10)
      : "";

    return summary;
  }, [records, teacherMap]);

  useEffect(() => {
    setAnalyticsRecordFilter("all");
  }, [analyticsClassFilter]);

  useEffect(() => {
    if (!analytics.minDateIso || !analytics.maxDateIso) {
      return;
    }

    setGraphStartDate((prev) => {
      if (!prev) return analytics.minDateIso;
      if (prev < analytics.minDateIso) return analytics.minDateIso;
      if (prev > analytics.maxDateIso) return analytics.maxDateIso;
      return prev;
    });

    setGraphEndDate((prev) => {
      if (!prev) return analytics.maxDateIso;
      if (prev > analytics.maxDateIso) return analytics.maxDateIso;
      if (prev < analytics.minDateIso) return analytics.minDateIso;
      return prev;
    });
  }, [analytics.minDateIso, analytics.maxDateIso]);

  useEffect(() => {
    if (analyticsClassFilter === "all" || analyticsRecordFilter === "all") {
      return;
    }

    const classSummary = analytics.classSummaries.find(
      (cls) => cls.className === analyticsClassFilter
    );
    const hasRecord = classSummary?.recordsByAttendance?.some(
      (record) => record.recordId === analyticsRecordFilter
    );
    if (!hasRecord) {
      setAnalyticsRecordFilter("all");
    }
  }, [
    analytics.classSummaries,
    analyticsClassFilter,
    analyticsRecordFilter,
  ]);

  const recordOptions = useMemo(() => {
    if (analyticsClassFilter === "all") {
      return [];
    }

    const classSummary = analytics.classSummaries.find(
      (cls) => cls.className === analyticsClassFilter
    );
    if (!classSummary) {
      return [];
    }

    return classSummary.recordsByAttendance.map((record) => ({
      value: record.recordId,
      label: record.recordName,
    }));
  }, [analytics.classSummaries, analyticsClassFilter]);

  const filteredTopClasses = useMemo(() => {
    if (!analytics.topClasses.length) {
      return [];
    }

    if (analyticsClassFilter === "all") {
      return analytics.topClasses.slice(0, 5).map((cls) => ({
        className: cls.className,
        totalAttendees: cls.totalAttendees,
        records:
          analyticsRecordFilter === "all"
            ? cls.recordsByAttendance.slice(0, 3)
            : cls.recordsByAttendance.filter(
                (record) => record.recordId === analyticsRecordFilter
              ),
      }));
    }

    const classSummary = analytics.classSummaries.find(
      (cls) => cls.className === analyticsClassFilter
    );
    if (!classSummary) {
      return [];
    }

    const records =
      analyticsRecordFilter === "all"
        ? classSummary.recordsByAttendance
        : classSummary.recordsByAttendance.filter(
            (record) => record.recordId === analyticsRecordFilter
          );

    return [
      {
        className: classSummary.className,
        totalAttendees: classSummary.totalAttendees,
        records,
      },
    ];
  }, [
    analytics.topClasses,
    analytics.classSummaries,
    analyticsClassFilter,
    analyticsRecordFilter,
  ]);

  const attendanceGraph = useMemo(() => {
    if (!graphStartDate || !graphEndDate) {
      return {
        rangeProvided: false,
        rangeValid: false,
        hasData: false,
        classes: [],
        maxCount: 0,
      };
    }

    if (graphStartDate > graphEndDate) {
      return {
        rangeProvided: true,
        rangeValid: false,
        hasData: false,
        classes: [],
        maxCount: 0,
      };
    }

    const rangeStart = Date.parse(`${graphStartDate}T00:00:00`);
    const rangeEnd = Date.parse(`${graphEndDate}T23:59:59.999`);
    if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd)) {
      return {
        rangeProvided: true,
        rangeValid: false,
        hasData: false,
        classes: [],
        maxCount: 0,
      };
    }

    let runningMax = 0;

    const classes = analytics.classSummaries
      .map((cls) => {
        const recordsInRange = cls.records
          .filter((record) => {
            if (!record.createdAt) return false;
            const timestamp = Date.parse(record.createdAt);
            if (Number.isNaN(timestamp)) {
              return false;
            }
            return timestamp >= rangeStart && timestamp <= rangeEnd;
          })
          .map((record) => ({ ...record }));

        if (recordsInRange.length === 0) {
          return null;
        }

        const sortedRecords = recordsInRange.sort((a, b) => {
          const dateA = a.createdAt ? Date.parse(a.createdAt) : 0;
          const dateB = b.createdAt ? Date.parse(b.createdAt) : 0;
          return dateA - dateB;
        });

        sortedRecords.forEach((record) => {
          if (record.attendeeCount > runningMax) {
            runningMax = record.attendeeCount;
          }
        });

        const totalAttendees = sortedRecords.reduce(
          (sum, record) => sum + record.attendeeCount,
          0
        );

        return {
          className: cls.className,
          totalAttendees,
          records: sortedRecords,
        };
      })
      .filter(Boolean);

    return {
      rangeProvided: true,
      rangeValid: true,
      hasData: classes.length > 0,
      classes,
      maxCount: runningMax,
    };
  }, [analytics.classSummaries, graphStartDate, graphEndDate]);

  const activeInviteCount = useMemo(
    () => invites.filter((invite) => invite.status === "active").length,
    [invites]
  );

  const sortedInvites = useMemo(() => {
    return invites
      .slice()
      .sort((a, b) => {
        const aDate = a.created_at ? Date.parse(a.created_at) : 0;
        const bDate = b.created_at ? Date.parse(b.created_at) : 0;
        return bDate - aDate;
      });
  }, [invites]);

  const pendingRequests = useMemo(() => {
    return accessRequests
      .slice()
      .sort((a, b) => {
        const aDate = a.created_at ? Date.parse(a.created_at) : 0;
        const bDate = b.created_at ? Date.parse(b.created_at) : 0;
        return bDate - aDate;
      });
  }, [accessRequests]);

  const refreshAdminData = useCallback(async () => {
    if (!auth?.token || !isAdmin) return;
    try {
      setLoadingAdminData(true);
      const [inviteRes, requestRes] = await Promise.all([
        api("/api/teachers/invite", { token: auth.token }),
        api("/api/teachers/requests?status=pending", { token: auth.token }),
      ]);
      setInvites(inviteRes.invites ?? []);
      setAccessRequests(requestRes.requests ?? []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAdminData(false);
    }
  }, [auth, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      refreshAdminData();
    }
  }, [isAdmin, refreshAdminData]);

  const createInviteFromForm = async (event) => {
    event.preventDefault();
    if (!auth?.token) return;

    try {
      setCreatingInvite(true);
      await api("/api/teachers/invite", {
        method: "POST",
        token: auth.token,
        body: {
          email: inviteForm.email.trim() || undefined,
          role: inviteForm.role,
          expiresInDays: Number(inviteForm.expiresInDays) || 14,
          note: inviteForm.note,
        },
      });
      toast.success("Invite created");
      setInviteForm({ email: "", role: "teacher", expiresInDays: 14, note: "" });
      refreshAdminData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const approveRequest = async (requestId, role = "teacher") => {
    if (!auth?.token) return;
    try {
      setHandlingRequest({ id: requestId, action: "approve" });
      await api("/api/teachers/requests/approve", {
        method: "POST",
        token: auth.token,
        body: {
          requestId,
          role,
        },
      });
      toast.success("Invite dispatched to requester");
      refreshAdminData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setHandlingRequest(null);
    }
  };

  const declineRequest = async (requestId) => {
    if (!auth?.token) return;
    try {
      setHandlingRequest({ id: requestId, action: "decline" });
      await api("/api/teachers/requests/approve", {
        method: "PATCH",
        token: auth.token,
        body: { requestId },
      });
      toast("Request declined", { icon: "⚠️" });
      refreshAdminData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setHandlingRequest(null);
    }
  };

  const loadCameraDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setCameraDevices(videoInputs);
      setCameraError(null);

      if (videoInputs.length === 0) {
        setSelectedDeviceId(null);
        return;
      }

      const currentDeviceStillAvailable = selectedDeviceId
        ? videoInputs.some((device) => device.deviceId === selectedDeviceId)
        : false;

      if (!currentDeviceStillAvailable && !selectedDeviceId) {
        const fallbackDevice = videoInputs[0];
        if (!fallbackDevice) {
          setSelectedDeviceId(null);
          return;
        }

        if (isMobileDevice) {
          const backFacing = videoInputs.find((device) =>
            /back|rear|environment/i.test(device.label)
          );
          const chosenDevice = backFacing || fallbackDevice;
          setSelectedDeviceId(chosenDevice.deviceId);
        } else {
          setSelectedDeviceId(fallbackDevice.deviceId);
        }
      }
    } catch (error) {
      console.error("Unable to enumerate cameras", error);
    }
  }, [isMobileDevice, selectedDeviceId]);

  useEffect(() => {
    if (!isScannerActive) {
      setCameraError(null);
      setCameraDevices([]);
      setSelectedDeviceId(null);
      setScannerStatus("idle");
      processedQrsRef.current.clear();
      lastQrRef.current = null;
      lastQrTimeRef.current = 0;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    }
  }, [isScannerActive]);

  useEffect(() => {
    isScannerActiveRef.current = isScannerActive;
  }, [isScannerActive]);

  useEffect(() => {
    if (!isScannerActive) {
      return undefined;
    }

    loadCameraDevices();

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return undefined;
    }

    const mediaDevices = navigator.mediaDevices;
    const deviceChangeHandler = () => {
      loadCameraDevices();
    };

    if (typeof mediaDevices.addEventListener === "function") {
      mediaDevices.addEventListener("devicechange", deviceChangeHandler);
    } else if ("ondevicechange" in mediaDevices) {
      mediaDevices.ondevicechange = deviceChangeHandler;
    }

    const refreshTimer = window.setTimeout(() => {
      loadCameraDevices();
    }, 1500);

    return () => {
      window.clearTimeout(refreshTimer);
      if (typeof mediaDevices.removeEventListener === "function") {
        mediaDevices.removeEventListener("devicechange", deviceChangeHandler);
      } else if ("ondevicechange" in mediaDevices) {
        if (mediaDevices.ondevicechange === deviceChangeHandler) {
          mediaDevices.ondevicechange = null;
        }
      }
    };
  }, [isScannerActive, loadCameraDevices]);

  const currentCameraLabel = useMemo(() => {
    if (!selectedDeviceId) {
      return null;
    }

    const match = cameraDevices.find((device) => device.deviceId === selectedDeviceId);
    if (match?.label) {
      return match.label;
    }

    if (cameraDevices.length > 1) {
      const index = cameraDevices.findIndex((device) => device.deviceId === selectedDeviceId);
      return `Camera ${index + 1}`;
    }

    return cameraDevices.length === 1 ? "Default camera" : null;
  }, [cameraDevices, selectedDeviceId]);

  const qrReaderConstraints = useMemo(() => {
    const baseConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    };
    
    if (selectedDeviceId) {
      return { ...baseConstraints, deviceId: { exact: selectedDeviceId } };
    }
    return { ...baseConstraints, facingMode: isMobileDevice ? "environment" : "user" };
  }, [isMobileDevice, selectedDeviceId]);

  const handleExportRecord = useCallback(
    async (record, format) => {
      if (!auth?.token) return;
      try {
        setDownloadingRecord({ id: record.recordId, format });
        const params = new URLSearchParams({
          recordId: record.recordId,
          format,
        });
        if (isAdmin && record.teacherId) {
          params.set("teacherId", record.teacherId);
        }

        const res = await fetch(`/api/attendance/export?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (!res.ok) {
          let message = "Unable to export record";
          try {
            const data = await res.json();
            message = data.error || message;
          } catch (ignore) {
            
          }
          throw new Error(message);
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = makeExportFilename(
          record,
          format === "pdf" ? "pdf" : "xlsx"
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success(`Exported ${format.toUpperCase()} file`);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setDownloadingRecord(null);
      }
    },
    [auth, isAdmin]
  );

  const handleCreateRecord = async (event) => {
    event.preventDefault();
    if (!auth?.token) return;

    try {
      if (!createForm.className.trim() || !createForm.recordName.trim()) {
        toast.error("Please provide a class and record name");
        return;
      }

      const data = await api("/api/attendance/create-record", {
        method: "POST",
        token: auth.token,
        body: {
          className: createForm.className,
          recordName: createForm.recordName,
        },
      });

      toast.success("Record created. Scanner is live.");
      setActiveRecord({
        ...data.record,
        teacherId: auth.teacher.teacherId,
        teacherName: teacherDisplayName,
      });
      setIsScannerActive(true);
      setShowCreate(false);
      setCreateForm({ className: "", recordName: "" });
      setScannedStudents(new Map());
      processedQrsRef.current.clear();
      lastQrRef.current = null;
      lastQrTimeRef.current = 0;
      setCameraError(null);
      setScannerStatus("loading");
      await refreshRecords();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleScanResult = useCallback(
    async (decodedText) => {
      if (!decodedText || !activeRecord || !auth?.token) {
        return;
      }

      const now = Date.now();
      
      if (lastQrRef.current === decodedText && (now - lastQrTimeRef.current) < 1000) {
        return;
      }

      if (processedQrsRef.current.has(decodedText)) {
        return;
      }

      console.log('Processing QR Code:', decodedText);
      
      lastQrRef.current = decodedText;
      lastQrTimeRef.current = now;
      processedQrsRef.current.add(decodedText);
      
      try {
        const response = await api("/api/attendance/mark", {
          method: "POST",
          token: auth.token,
          body: {
            recordId: activeRecord.recordId,
            qrPayload: decodedText,
            teacherId: activeRecord.teacherId,
          },
        });

        toast.success(
          `Marked ${response.attendance.studentName} (${response.attendance.studentId})`
        );
        
        setScannedStudents((prev) => {
          const next = new Map(prev);
          next.set(decodedText, response.attendance);
          return next;
        });

        await refreshRecords();
      } catch (err) {
        toast.error(err.message);
        processedQrsRef.current.delete(decodedText);
      }
    },
    [activeRecord, auth, refreshRecords]
  );

  const startQrScanner = useCallback(async () => {
    if (isStartingRef.current) return;
    if (html5QrCodeRef.current || !scannerElementRef.current) return;

    try {
      isStartingRef.current = true;
      setScannerStatus("loading");
      setCameraError(null);

      // Request permission first to ensure we get camera labels
      try {
        await navigator.mediaDevices.getUserMedia({video: true});
      } catch (err) {
        console.warn("Could not pre-request camera permission", err);
      }
      
      // Fresh enumeration of cameras with labels
      let videoInputs = [];
      if (navigator?.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoInputs = devices.filter((d) => d.kind === "videoinput");
        
        // Enhanced camera labeling for debugging
        const enhancedCameras = videoInputs.map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index+1}`,
          isBack: device.label && /back|rear|environment/i.test(device.label),
          isFront: device.label && /front|face|user/i.test(device.label),
          index
        }));
        
        console.log("Available cameras:", enhancedCameras.map(d => 
          `${d.label} (${d.isBack ? 'BACK' : d.isFront ? 'FRONT' : 'UNKNOWN'})`));
        
        // Set the detected cameras with better labels
        setCameraDevices(videoInputs);
      }

      // Select camera with priority:
      // 1. Previously desired camera (if available)
      // 2. Back camera on mobile
      // 3. First available camera
      let deviceId = null;
      
      // If we have a desired camera from before, try to use it
      if (desiredDeviceIdRef.current) {
        const stillExists = videoInputs.some(d => d.deviceId === desiredDeviceIdRef.current);
        if (stillExists) {
          deviceId = desiredDeviceIdRef.current;
          console.log("Using previously selected camera:", deviceId);
        }
      }
      
      // Otherwise, on mobile prefer back camera
      if (!deviceId && isMobileDevice && videoInputs.length > 0) {
        const backCamera = videoInputs.find(d => 
          d.label && /back|rear|environment/i.test(d.label)
        );
        
        if (backCamera) {
          deviceId = backCamera.deviceId;
          console.log("Selected back camera:", backCamera.label);
        } else {
          // If no obvious back camera found, use first camera
          deviceId = videoInputs[0].deviceId;
          console.log("No back camera found, using first:", videoInputs[0].label || "Unlabeled camera");
        }
      }
      // For non-mobile or fallback, use first camera
      else if (!deviceId && videoInputs.length > 0) {
        deviceId = videoInputs[0].deviceId;
        console.log("Using default camera:", videoInputs[0].label || "Unlabeled camera");
      }
      
      // Update both the ref and state to stay in sync
      desiredDeviceIdRef.current = deviceId;
      setSelectedDeviceId(deviceId);
      
      // Create scanner
      const html5QrCode = new Html5Qrcode("qr-code-scanner");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      // Always use specific constraints format for consistent behavior
      const cameraConstraints = deviceId 
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { exact: isMobileDevice ? "environment" : "user" } };
      
      console.log("Starting scanner with constraints:", JSON.stringify(cameraConstraints));

      await html5QrCode.start(
        cameraConstraints,
        config,
        (decodedText) => {
          if (!isScannerActive) return;
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Filter benign errors
          if (QR_SCANNER_BENIGN_ERROR_NAMES.some(err => errorMessage.includes(err))) {
            return;
          }
          console.warn("QR Scanner error:", errorMessage);
        }
      );

      setScannerStatus("ready");
      console.log("QR scanner started successfully");
    } catch (error) {
      console.error("Failed to start QR scanner:", error);
      setCameraError(`Camera error: ${error.message || 'Failed to access camera'}`);
      setScannerStatus("error");
      html5QrCodeRef.current = null;
    } finally {
      isStartingRef.current = false;
    }
  }, [isScannerActive, handleScanResult, isMobileDevice]);

  const stopScannerOnly = useCallback(async () => {
    if (!html5QrCodeRef.current) return;
    if (isStoppingRef.current) return;
    
    try {
      isStoppingRef.current = true;
      console.log('Stopping QR scanner...');
      
      // Clear any pending restart timers
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      
      const scanner = html5QrCodeRef.current;
      
      try {
        // Try the standard stop method
        await scanner.stop();
        console.log('Scanner stopped via standard method');
      } catch (e) {
        console.warn('Standard stop() failed, using manual track cleanup', e);
        
        // More aggressive approach to stop all video tracks
        try {
          // Find all video elements in the scanner container
          const container = document.getElementById('qr-code-scanner');
          if (container) {
            // Stop all video tracks directly
            const videos = container.querySelectorAll('video');
            videos.forEach((video) => {
              if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach((track) => {
                  track.stop();
                  console.log('Manually stopped track:', track.id);
                });
                video.srcObject = null;
                video.pause();
              }
            });
            
            // Also try to find any tracks directly from MediaDevices
            navigator.mediaDevices?.getTracks?.().forEach(track => {
              track.stop();
            });
          }
        } catch (trackError) {
          console.error('Failed to manually stop tracks:', trackError);
        }
      }
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  const teardownScanner = useCallback(async () => {
    if (!html5QrCodeRef.current) {
      setScannerStatus("idle");
      return;
    }
    
    try {
      console.log('Tearing down QR scanner completely...');
      
      // First stop all scanning operations
      await stopScannerOnly();
      
      const scanner = html5QrCodeRef.current;
      
      // Then try to clear the HTML5QrCode instance
      try {
        await scanner.clear();
        console.log('Scanner cleared successfully');
      } catch (e) {
        console.warn('Scanner clear() failed:', e);
        
        // More aggressive approach to clear the scanner DOM
        try {
          const container = document.getElementById('qr-code-scanner');
          if (container) {
            // Clear all child elements
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }
            console.log('Manually cleared scanner DOM');
          }
        } catch (clearError) {
          console.error('Failed manual DOM cleanup:', clearError);
        }
      }
    } finally {
      // Make sure we null out the reference
      html5QrCodeRef.current = null;
      setScannerStatus("idle");
      console.log('QR scanner teardown completed');
    }
  }, [stopScannerOnly]);

  const switchToDevice = useCallback(async (deviceId) => {
    if (!deviceId) return;
    desiredDeviceIdRef.current = deviceId;

    // For mobile devices, fully teardown and restart the scanner
    if (isMobileDevice) {
      await teardownScanner();
      setSelectedDeviceId(deviceId);
      await startQrScanner();
      return;
    }

    if (!html5QrCodeRef.current) {
      setSelectedDeviceId(deviceId);
      return;
    }
    if (isSwitchingRef.current) return;
    isSwitchingRef.current = true;
    setScannerStatus("loading");
    try {
      await stopScannerOnly();

      const scanner = html5QrCodeRef.current;
      if (!scanner) {
        setSelectedDeviceId(deviceId);
        return;
      }

      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      await scanner.start(
        deviceId,
        config,
        (decodedText) => {
          if (!isScannerActiveRef.current) return;
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Ignore QR scanning errors
        }
      );

      setSelectedDeviceId(deviceId);
      setScannerStatus("ready");
      console.log("Switched camera successfully");
    } catch (error) {
      console.error("Failed to switch camera", error);
      toast.error("Unable to switch camera");
      try {
        const scanner = html5QrCodeRef.current;
        if (scanner) {
          await scanner.start(
            { facingMode: isMobileDevice ? 'environment' : 'user' },
            {
              fps: 10,
              qrbox: { width: 200, height: 200 },
              aspectRatio: 1.0,
              disableFlip: false,
            },
            (decodedText) => {
              if (!isScannerActiveRef.current) return;
              handleScanResult(decodedText);
            },
            () => {}
          );
          setScannerStatus("ready");
        }
      } catch {}
    } finally {
      isSwitchingRef.current = false;
    }
  }, [handleScanResult, isMobileDevice, teardownScanner, stopScannerOnly, startQrScanner]);

  const cycleCameraReal = useCallback(async () => {
    if (cameraDevices.length < 2) return;
    
    try {
      setScannerStatus("loading");
      
      // Get fresh camera list with current permissions
      await navigator.mediaDevices.getUserMedia({video: true});
      const devices = await navigator.mediaDevices.enumerateDevices();
      const freshCameras = devices.filter(d => d.kind === 'videoinput');
      
      // Enhanced camera info for logging
      const enhancedCameras = freshCameras.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index+1}`,
        isBack: device.label && /back|rear|environment/i.test(device.label),
        isFront: device.label && /front|face|user/i.test(device.label),
        index
      }));
      
      console.log("Camera switching - available cameras:", enhancedCameras.map(d => 
        `${d.label} (${d.isBack ? 'BACK' : d.isFront ? 'FRONT' : 'UNKNOWN'})`));
      
      // Find current camera index
      const currentIndex = freshCameras.findIndex(d => d.deviceId === selectedDeviceId);
      console.log("Current camera index:", currentIndex, "deviceId:", selectedDeviceId);
      
      // Simple next index selection
      const nextIndex = (currentIndex + 1) % freshCameras.length;
      const nextCamera = freshCameras[nextIndex];
      
      // Always completely teardown and rebuild for consistent behavior
      await teardownScanner();
      
      // Set both state and ref in sync
      desiredDeviceIdRef.current = nextCamera.deviceId;
      setSelectedDeviceId(nextCamera.deviceId);
      
      console.log(`Switching to camera ${nextIndex}: ${nextCamera.label || 'Unlabeled camera'}`);
      
      // Wait a moment for state to update
      await new Promise(r => setTimeout(r, 100));
      
      // Start with the new camera
      await startQrScanner();
      
      const cameraType = nextCamera.label && /back|rear|environment/i.test(nextCamera.label) 
        ? "back camera"
        : nextCamera.label && /front|face|user/i.test(nextCamera.label)
        ? "front camera" 
        : "camera";
        
      toast.success(`Switched to ${cameraType}`);
      
    } catch (error) {
      console.error("Camera switch failed:", error);
      toast.error("Failed to switch camera");
      
      // Recovery
      await startQrScanner();
    }
  }, [cameraDevices, selectedDeviceId, teardownScanner, startQrScanner]);

const handleStopScanner = async () => {
  // Set state first to prevent any new scans
  setIsScannerActive(false);
  isScannerActiveRef.current = false;
  
  // Completely teardown the scanner
  await teardownScanner();
  
  // Clear all related state
  setCameraDevices([]);
  setSelectedDeviceId(null);
  setActiveRecord(null);
  setScannedStudents(new Map());
  processedQrsRef.current.clear();
  lastQrRef.current = null;
  lastQrTimeRef.current = 0;
  setScannerStatus("idle");
  setCameraError(null);
  
  // Attempt to clean up any remaining camera resources
  try {
    // This extra step ensures all tracks are stopped
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false });
      stream.getTracks().forEach(track => track.stop());
    }
  } catch {}
};

  useEffect(() => {
    if (isScannerActive && !html5QrCodeRef.current) {
      startQrScanner();
    }
  }, [isScannerActive, startQrScanner]);


  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (html5QrCodeRef.current) {
        teardownScanner();
      }
    };
  }, [teardownScanner]);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth(null);
    router.replace("/teacher/login");
  };

  if (!auth) {
    return null;
  }

  return (
    <div className="relative isolate mx-auto min-h-screen max-w-6xl px-6 pb-24 pt-16 sm:px-10 lg:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-[-18rem] h-[26rem] w-[26rem] rounded-full bg-emerald-200/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 right-[-14rem] h-[24rem] w-[24rem] rounded-full bg-emerald-100/30 blur-3xl"
      />
      <div className="relative z-10 flex flex-col gap-10 text-slate-700">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Attendance dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as {teacherDisplayName || auth.teacher.email}
              {teacherDisplayEmail ? (
                <span className="text-slate-500"> ({teacherDisplayEmail})</span>
              ) : null}
              {" · role: "}
              {auth.teacher.role}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {auth.teacher.role === "admin" && (
              <select
                value={selectedTeacher}
                onChange={(event) => setSelectedTeacher(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/30"
              >
                <option value="all">All teachers</option>
                {uniqueTeachers.map((teacher) => (
                  <option key={teacher.teacherId} value={teacher.teacherId}>
                    {teacher.name}
                    {teacher.email ? ` · ${teacher.email}` : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              New record
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
            >
              Log out
            </button>
          </div>
        </header>

        {showCreate && (
          <form
            onSubmit={handleCreateRecord}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Class name
              </span>
              <input
                type="text"
                value={createForm.className}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, className: event.target.value }))
                }
                placeholder="FOP Exercise Group A"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="flex-1 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Record name
              </span>
              <input
                type="text"
                value={createForm.recordName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, recordName: event.target.value }))
                }
                placeholder="Week 3 · Loops"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white"
              >
                Launch scanner
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
          </form>
        )}

      {isScannerActive && activeRecord && (
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg lg:p-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Live scanner
            </h2>
            <p className="text-sm text-slate-600">
              Class <span className="font-medium text-slate-900">{activeRecord.className}</span>
              <br />
              Session <span className="font-medium text-slate-900">{activeRecord.recordName}</span>
            </p>
            <div className="space-y-3">
              <div
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner w-full"
                style={{ 
                  aspectRatio: "1 / 1", 
                  minHeight: "240px",
                  maxHeight: "400px",
                  maxWidth: "100%"
                }}
              >
                <div
                  id="qr-code-scanner"
                  ref={scannerElementRef}
                  className="h-full w-full [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover [&>video]:!max-w-none [&>canvas]:!h-full [&>canvas]:!w-full [&>canvas]:!object-cover [&>canvas]:!max-w-none"
                />
                {(cameraError || scannerStatus === "loading") && (
                  <div className="absolute inset-0 grid place-items-center bg-white/90 px-4 text-center text-xs text-slate-600">
                    {scannerStatus === "loading" && !cameraError ? (
                      <div>
                        <p className="font-semibold text-emerald-700">Initializing camera…</p>
                        <p className="mt-2 text-[10px] text-slate-500">
                          Allow camera access in your browser to start scanning.
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-sm">
                        <p className="mb-2 font-semibold text-slate-700">Camera access issue</p>
                        <div className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">
                          {cameraError}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {scannerStatus === "ready" && !cameraError && (
                  <div className="absolute inset-4 border-2 border-emerald-400/50 rounded-lg pointer-events-none">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>
                    
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {currentCameraLabel && (
                  <p className="text-xs text-slate-500">
                    Camera: <span className="text-slate-700">{currentCameraLabel}</span>
                  </p>
                )}
                {!currentCameraLabel && cameraDevices.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Waiting for camera access...
                  </p>
                )}
                {!isMobileDevice && cameraDevices.length > 1 && (
                  <label className="block text-xs text-slate-500">
                    <span className="mb-1 block font-semibold uppercase tracking-wide text-slate-600">
                      Camera source
                    </span>
                    <select
                      value={selectedDeviceId ?? ""}
                      onChange={(event) =>
                        setSelectedDeviceId(event.target.value || null)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200/30"
                    >
                      {cameraDevices.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {isMobileDevice && cameraDevices.length > 1 && (
                  <button
                    type="button"
                    onClick={cycleCameraReal}
                    disabled={scannerStatus === "loading"}
                    className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {scannerStatus === "loading" ? "Switching..." : `Switch Camera (${currentCameraLabel || 'Unknown'})`}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleStopScanner}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
              >
                Stop Scanner
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Recently scanned
            </h3>
            <ul className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto pr-2 text-sm">
              {Array.from(scannedStudents.values()).length === 0 && (
                <li className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-slate-500">
                  Scan a student QR to see live confirmations here.
                </li>
              )}
              {Array.from(scannedStudents.values())
                .slice()
                .reverse()
                .map((entry) => (
                  <li
                    key={`${entry.studentId}-${entry.timestamp}`}
                    className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                  >
                    <span className="font-medium text-emerald-700">
                      {entry.studentName}
                    </span>
                    <span className="text-xs text-emerald-600">
                      {entry.studentId}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

          {isAdmin && (
            <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 right-[-14rem] h-64 w-64 rounded-full bg-emerald-200/20 blur-3xl"
              />
              <div className="relative z-10 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold text-slate-900">Admin insights</h2>
                  <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                    {[
                      { id: "analytics", label: "Analytics" },
                      {
                        id: "invites",
                        label:
                          activeInviteCount > 0
                            ? `Invites (${activeInviteCount})`
                            : "Invites",
                      },
                      {
                        id: "requests",
                        label:
                          pendingRequests.length > 0
                            ? `Requests (${pendingRequests.length})`
                            : "Requests",
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAdminTab(tab.id)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          adminTab === tab.id
                            ? "bg-emerald-500 text-white"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {adminTab === "analytics" && (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 pb-4 pt-6 shadow-sm">
                        <span className="absolute inset-x-4 top-2 h-[3px] rounded-full bg-emerald-200" aria-hidden="true" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total sessions
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-emerald-600">
                          {analytics.totalSessions}
                        </p>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 pb-4 pt-6 shadow-sm">
                        <span className="absolute inset-x-4 top-2 h-[3px] rounded-full bg-emerald-200" aria-hidden="true" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Attendance events
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-emerald-600">
                          {analytics.totalAttendees}
                        </p>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 pb-4 pt-6 shadow-sm">
                        <span className="absolute inset-x-4 top-2 h-[3px] rounded-full bg-emerald-200" aria-hidden="true" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Unique students
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-emerald-600">
                          {analytics.uniqueStudents}
                        </p>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 pb-4 pt-6 shadow-sm">
                        <span className="absolute inset-x-4 top-2 h-[3px] rounded-full bg-emerald-200" aria-hidden="true" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Active invites · Pending requests
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-emerald-600">
                          {activeInviteCount} · {pendingRequests.length}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-col sm:items-start sm:justify-between">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                            Top classes by attendance
                          </h3>
                          <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                            <label className="flex flex-col gap-1">
                              <span className="font-semibold uppercase tracking-wide text-slate-600">
                                Class filter
                              </span>
                              <select
                                value={analyticsClassFilter}
                                onChange={(event) => setAnalyticsClassFilter(event.target.value)}
                                className="min-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/20"
                              >
                                <option value="all">All classes</option>
                                {analytics.classSummaries.map((cls) => (
                                  <option key={cls.className} value={cls.className}>
                                    {cls.className}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="font-semibold uppercase tracking-wide text-slate-600">
                                Record filter
                              </span>
                              <select
                                value={analyticsRecordFilter}
                                onChange={(event) => setAnalyticsRecordFilter(event.target.value)}
                                disabled={
                                  analyticsClassFilter === "all" || recordOptions.length === 0
                                }
                                className="min-w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                <option value="all">All records</option>
                                {recordOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-slate-600">
                          {filteredTopClasses.length === 0 && (
                            <li className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
                              No attendance records yet.
                            </li>
                          )}
                          {filteredTopClasses.map((entry, index) => (
                            <li
                              key={entry.className || index}
                              className="relative overflow-hidden rounded-xl border border-slate-200 bg-white pl-6 pr-4 py-4 shadow-sm"
                            >
                              <span
                                aria-hidden="true"
                                className="absolute inset-y-3 left-2 w-[3px] rounded-full bg-emerald-300"
                              />
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-medium text-emerald-900">
                                  {analyticsClassFilter === "all" ? `${index + 1}. ` : ""}
                                  {entry.className}
                                </span>
                                <span className="text-xs font-semibold text-emerald-700">
                                  {entry.totalAttendees} students
                                </span>
                              </div>
                              {entry.records.length > 0 && (
                                <ul className="mt-3 space-y-2 text-xs text-slate-500">
                                  {entry.records.map((record) => (
                                    <li
                                      key={record.recordId}
                                      className="flex flex-col gap-1 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <span className="font-medium text-emerald-900">
                                          {record.recordName}
                                        </span>
                                        <span className="text-[11px] font-semibold text-emerald-700">
                                          {record.attendeeCount} students
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                        {record.teacherName ? (
                                          <span>
                                            Teacher: <span className="font-medium text-emerald-700">{record.teacherName}</span>
                                            {record.teacherEmail
                                              ? ` · ${record.teacherEmail}`
                                              : ""}
                                          </span>
                                        ) : null}
                                        {record.createdAt ? (
                                          <span>
                                            {formatDateOnly(record.createdAt)}
                                          </span>
                                        ) : null}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                          Classes & teacher activity
                        </h3>
                        <ul className="mt-4 space-y-3 text-sm text-slate-600">
                          {analytics.teacherActivity.length === 0 && (
                            <li className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
                              No data captured yet.
                            </li>
                          )}
                          {analytics.teacherActivity.slice(0, 6).map((entry, index) => {
                            const primary = entry.primaryTeacher;
                            const primaryDisplay = primary
                              ? primary.teacherName?.trim() ||
                                primary.teacherEmail ||
                                primary.teacherId ||
                                "Unknown"
                              : "Unknown";
                            const secondaryDisplay = entry.additionalTeachers
                              .map((teacher) =>
                                teacher.teacherName?.trim() ||
                                teacher.teacherEmail ||
                                teacher.teacherId ||
                                "Unknown"
                              )
                              .slice(0, 2);

                            return (
                              <li
                                key={entry.className || index}
                                className="relative overflow-hidden rounded-xl border border-slate-200 bg-white pl-6 pr-4 py-4 shadow-sm"
                              >
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-y-3 left-2 w-[3px] rounded-full bg-emerald-300"
                                />
                                <div className="flex items-start justify-between gap-3">
                                  <span className="font-medium text-slate-900">
                                    {index + 1}. {entry.className}
                                  </span>
                                  <span className="text-xs font-semibold text-emerald-700">
                                    {entry.totalAttendees} students
                                  </span>
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-slate-500">
                                  <p>
                                    Teacher: <span className="font-semibold text-emerald-700">{primaryDisplay}</span>
                                    {primary?.teacherEmail && primary.teacherEmail !== primaryDisplay ? (
                                      <span className="text-slate-400"> · {primary.teacherEmail}</span>
                                    ) : null}
                                  </p>
                                  {secondaryDisplay.length > 0 && (
                                    <p className="text-[11px] text-slate-500">
                                      Additional: {secondaryDisplay.join(", ")}
                                      {entry.additionalTeachers.length > secondaryDisplay.length
                                        ? "…"
                                        : ""}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-slate-500">
                                    Sessions: <span className="font-semibold text-emerald-700">{entry.totalSessions}</span>
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                            Attendance trends by record
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Student counts per record grouped by class within the selected date range (inclusive).
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
                          <label className="flex flex-col gap-1">
                            <span className="font-semibold uppercase tracking-wide text-slate-600">
                              From date
                            </span>
                            <input
                              type="date"
                              value={graphStartDate}
                              onChange={(event) => setGraphStartDate(event.target.value)}
                              min={analytics.minDateIso || undefined}
                              max={analytics.maxDateIso || undefined}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/20"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-semibold uppercase tracking-wide text-slate-600">
                              To date
                            </span>
                            <input
                              type="date"
                              value={graphEndDate}
                              onChange={(event) => setGraphEndDate(event.target.value)}
                              min={analytics.minDateIso || undefined}
                              max={analytics.maxDateIso || undefined}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/20"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="mt-6 space-y-6">
                        {!attendanceGraph.rangeProvided && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
                            Select a start and end date to generate the graph.
                          </div>
                        )}
                        {attendanceGraph.rangeProvided && !attendanceGraph.rangeValid && (
                          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-6 text-center text-slate-600">
                            <span className="font-semibold text-emerald-700">Invalid date range.</span> Ensure the start date is on or before the end date.
                          </div>
                        )}
                        {attendanceGraph.rangeProvided &&
                          attendanceGraph.rangeValid &&
                          !attendanceGraph.hasData && (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
                              No records found within the selected range.
                            </div>
                          )}
                        {attendanceGraph.rangeProvided &&
                          attendanceGraph.rangeValid &&
                          attendanceGraph.hasData && (
                            <div className="space-y-6">
                              {attendanceGraph.classes.map((classEntry) => (
                                <div
                                  key={classEntry.className}
                                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white pl-6 pr-4 py-4 shadow-sm"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="absolute inset-y-4 left-3 w-[3px] rounded-full bg-emerald-300"
                                  />
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-900">
                                        {classEntry.className}
                                      </h4>
                                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                        {classEntry.records.length} record{classEntry.records.length === 1 ? "" : "s"}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-700">
                                      {classEntry.totalAttendees} students
                                    </span>
                                  </div>
                                  <div className="mt-4 space-y-3">
                                    {classEntry.records.map((record) => {
                                      const widthPercentage = attendanceGraph.maxCount
                                        ? Math.max(
                                            6,
                                            Math.round(
                                              (record.attendeeCount / attendanceGraph.maxCount) *
                                                100
                                            )
                                          )
                                        : 0;

                                      return (
                                        <div
                                          key={`${classEntry.className}-${record.recordId}`}
                                          className="space-y-1"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                                            <span className="font-medium text-emerald-800">
                                              {record.recordName}
                                            </span>
                                            <span>
                                              {formatDateOnly(record.createdAt)} · {record.attendeeCount} students
                                            </span>
                                          </div>
                                          <div className="h-3 w-full rounded-full bg-emerald-100/70">
                                            <div
                                              className="h-3 rounded-full bg-emerald-500"
                                              style={{ width: `${widthPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {adminTab === "invites" && (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
                    <form
                      onSubmit={createInviteFromForm}
                      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                <h3 className="text-base font-semibold text-slate-900">
                  Generate invite
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Email is optional—leave blank for transferable codes.
                </p>
                <div className="mt-6 space-y-4 text-sm text-slate-600">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email (optional)
                    </span>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      placeholder="firstname.lastname@lut.fi"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Role
                    </span>
                    <select
                      value={inviteForm.role}
                      onChange={(event) =>
                        setInviteForm((prev) => ({
                          ...prev,
                          role: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-emerald-400"
                    >
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expires in (days)
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={inviteForm.expiresInDays}
                      onChange={(event) =>
                        setInviteForm((prev) => ({
                          ...prev,
                          expiresInDays: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes (optional)
                    </span>
                    <textarea
                      rows={3}
                      value={inviteForm.note}
                      onChange={(event) =>
                        setInviteForm((prev) => ({
                          ...prev,
                          note: event.target.value,
                        }))
                      }
                      placeholder="Week 4 tutors"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={creatingInvite}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-70"
                >
                  {creatingInvite ? "Generating…" : "Create invite"}
                </button>
              </form>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Invite log
                  </h3>
                  {loadingAdminData && (
                    <span className="text-xs text-slate-500">Refreshing…</span>
                  )}
                </div>
                {sortedInvites.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500">
                    No invites generated yet.
                  </div>
                ) : (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-slate-600">
                      <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Expires</th>
                          <th className="px-3 py-2">Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedInvites.map((invite) => (
                          <tr key={invite.invite_code} className="bg-white">
                            <td className="px-3 py-2 font-mono text-[11px] text-emerald-700">
                              {invite.invite_code}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-500">
                              {invite.email || "—"}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-500">
                              {invite.role}
                            </td>
                            <td className="px-3 py-2 text-[11px]">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 font-medium ${
                                  invite.status === "active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {invite.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-500">
                              {invite.expires_at ? formatDate(invite.expires_at) : "—"}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-500">
                              {invite.used_at ? formatDate(invite.used_at) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            )}

            {adminTab === "requests" && (
            <div className="space-y-4">
              {loadingAdminData && (
                <span className="text-xs text-slate-500">Refreshing…</span>
              )}
              {pendingRequests.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
                  All caught up—no pending requests.
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.request_id}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {request.email}
                        </p>
                        <p className="text-xs text-slate-500">
                          {request.name || "No name provided"}
                        </p>
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        {formatDate(request.created_at)}
                      </span>
                    </div>
                    {request.context && (
                      <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        {request.context}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => approveRequest(request.request_id, "teacher")}
                        disabled={
                          handlingRequest?.id === request.request_id &&
                          handlingRequest?.action === "approve"
                        }
                        className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 font-semibold text-white disabled:opacity-60"
                      >
                        Approve (Teacher)
                      </button>
                      <button
                        type="button"
                        onClick={() => approveRequest(request.request_id, "admin")}
                        disabled={
                          handlingRequest?.id === request.request_id &&
                          handlingRequest?.action === "approve"
                        }
                        className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-600 disabled:opacity-60"
                      >
                        Approve as Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => declineRequest(request.request_id)}
                        disabled={
                          handlingRequest?.id === request.request_id &&
                          handlingRequest?.action === "decline"
                        }
                        className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-600 disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            )}
          </div>
        </section>
      )}

  <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Attendance history</h2>
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {loading ? "Loading…" : `${records.length} class${records.length === 1 ? "" : "es"}`}
          </span>
        </div>
        {records.length === 0 && !loading && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
            No attendance records yet. Create a new one to get started.
          </div>
        )}

        <div className="space-y-6">
          {records.map((group) => (
            <div
              key={group.className}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {group.className}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {group.records.length} session{group.records.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {group.records.map((record) => (
                  <div
                    key={record.recordId}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-wide text-slate-500">
                          {formatDate(record.createdAt)}
                        </p>
                        <h4 className="text-lg font-semibold text-slate-900">
                          {record.recordName}
                        </h4>
                        {(record.teacherName || record.teacherEmail || record.teacherId) && (
                          <p className="mt-1 text-xs text-slate-500">
                            Teacher: {record.teacherName || record.teacherEmail || record.teacherId}
                            {record.teacherName && record.teacherEmail ? (
                              <span className="text-slate-400"> · {record.teacherEmail}</span>
                            ) : null}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-4 mt-2 rounded-full border border-emerald-200 bg-white px-4 py-1 text-xs font-semibold text-emerald-700">
                          {record.attendees.length} attendee{record.attendees.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {activeRecord?.recordId === record.recordId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsScannerActive(true);
                              setCameraError(null);
                              setScannerStatus("loading");
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-emerald-950 shadow-sm"
                          >
                            Scanner started
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRecord({ ...record });
                              setIsScannerActive(true);
                              setCameraError(null);
                              setScannedStudents(new Map());
                              
                              processedQrsRef.current.clear();
                              lastQrRef.current = null;
                              lastQrTimeRef.current = 0;
                              setScannerStatus("loading");
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500 hover:text-black"
                          >
                            Scan for this record
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleExportRecord(record, "pdf")}
                          disabled={
                            downloadingRecord?.id === record.recordId &&
                            downloadingRecord?.format === "pdf"
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500 hover:text-black disabled:opacity-60"
                        >
                          {downloadingRecord?.id === record.recordId &&
                          downloadingRecord?.format === "pdf"
                            ? "Exporting…"
                            : "Export PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportRecord(record, "excel")}
                          disabled={
                            downloadingRecord?.id === record.recordId &&
                            downloadingRecord?.format === "excel"
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-1000 transition hover:bg-emerald-600 hover:text-black disabled:opacity-60"
                        >
                          {downloadingRecord?.id === record.recordId &&
                          downloadingRecord?.format === "excel"
                            ? "Exporting…"
                            : "Export Excel"}
                        </button>
                      </div>
                    </div>
                    {record.attendees.length > 0 && (
                      <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        {record.attendees.map((student) => (
                          <li
                            key={`${student.studentId}-${student.timestamp}`}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <span className="text-s text-slate-700">{student.studentName}</span>
                            <span className="text-xs text-slate-500">
                              {student.studentId}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}
