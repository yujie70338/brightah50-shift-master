import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { User, MonthlySchedule, ShiftDocument, ShiftSlots } from "./types.js";

initializeApp();
const db = getFirestore();

setGlobalOptions({ maxInstances: 10, region: "asia-northeast1" });

// ---------------------------------------------------------------------------
// 1. Auth Blocking Trigger — 白名單登入攔截
// ---------------------------------------------------------------------------
export const beforeusersignedin = beforeUserSignedIn(async (event) => {
  const email = event.data?.email;
  if (!email) {
    throw new HttpsError("permission-denied", "No email provided.");
  }

  const userDoc = await db.collection("users").doc(email).get();
  if (!userDoc.exists) {
    throw new HttpsError(
      "permission-denied",
      `User ${email} is not in the whitelist.`,
    );
  }

  const user = userDoc.data() as User;
  if (!user.isActive) {
    throw new HttpsError(
      "permission-denied",
      `User ${email} has been deactivated.`,
    );
  }

  logger.info(`User signed in: ${email}, role: ${user.role}`);

  return {
    customClaims: {
      role: user.role,
    },
  };
});

// ---------------------------------------------------------------------------
// 2. Callable — 建立空白月份
// ---------------------------------------------------------------------------
export const initializeBlankMonth = onCall(async (request) => {
  // 驗證登入狀態
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  // 驗證 manager 角色
  const callerEmail = request.auth.token.email;
  if (!callerEmail) {
    throw new HttpsError("unauthenticated", "No email in token.");
  }
  const callerDoc = await db.collection("users").doc(callerEmail).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "User not found.");
  }
  const caller = callerDoc.data() as User;
  if (caller.role !== "manager") {
    throw new HttpsError("permission-denied", "Only managers can do this.");
  }

  // 驗證參數
  const { year, month } = request.data as { year: number; month: number };
  if (
    !year ||
    !month ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new HttpsError(
      "invalid-argument",
      "year (integer) and month (1-12) are required.",
    );
  }

  const scheduleId = `${year}-${String(month).padStart(2, "0")}`;
  const scheduleRef = db.collection("monthly_schedules").doc(scheduleId);

  // 檢查是否已存在
  const existing = await scheduleRef.get();
  if (existing.exists) {
    throw new HttpsError(
      "already-exists",
      `Schedule ${scheduleId} already exists.`,
    );
  }

  // 計算該月天數
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

  // 批次寫入 (Firestore batch 上限 500，這裡最多 32 筆)
  const batch = db.batch();

  const scheduleData: MonthlySchedule = {
    year,
    month,
    isPublished: false,
    managerId: callerEmail,
  };
  batch.set(scheduleRef, scheduleData);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, "0");
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dayNames[dateObj.getDay()];

    const emptySlots: ShiftSlots = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    const shiftData: ShiftDocument = {
      date: `${scheduleId}-${dayStr}`,
      dayOfWeek,
      slots: emptySlots,
    };

    batch.set(scheduleRef.collection("shifts").doc(dayStr), shiftData);
  }

  await batch.commit();

  logger.info(`Blank month created: ${scheduleId} by ${callerEmail}`);
  return { scheduleId, daysCreated: daysInMonth };
});

// ---------------------------------------------------------------------------
// 3. Firestore Trigger — 班表異動通知 (V1.0: log only)
// ---------------------------------------------------------------------------
export const onShiftUpdated = onDocumentUpdated(
  "monthly_schedules/{scheduleId}/shifts/{shiftId}",
  async (event) => {
    const beforeData = event.data?.before.data() as ShiftDocument | undefined;
    const afterData = event.data?.after.data() as ShiftDocument | undefined;
    if (!beforeData || !afterData) return;

    const scheduleId = event.params.scheduleId;
    const shiftId = event.params.shiftId;

    // 檢查所屬月份是否已發布
    const scheduleDoc = await db
      .collection("monthly_schedules")
      .doc(scheduleId)
      .get();
    if (!scheduleDoc.exists) return;

    const schedule = scheduleDoc.data() as MonthlySchedule;
    if (!schedule.isPublished) return;

    // 比對 before/after 差異
    const slotTypes: (keyof ShiftSlots)[] = ["morning", "afternoon", "evening"];
    const added: string[] = [];
    const removed: string[] = [];

    for (const slot of slotTypes) {
      const before = new Set(beforeData.slots[slot]);
      const after = new Set(afterData.slots[slot]);

      for (const email of after) {
        if (!before.has(email)) added.push(`${email} → ${slot}`);
      }
      for (const email of before) {
        if (!after.has(email)) removed.push(`${email} ✕ ${slot}`);
      }
    }

    if (added.length === 0 && removed.length === 0) return;

    // V1.0: 僅 log，未來接 Resend 寄信
    logger.info(`[Published] Shift changed: ${scheduleId}/${shiftId}`, {
      added,
      removed,
    });
    // TODO: 接 Resend 發送異動通知給受影響員工
  },
);
