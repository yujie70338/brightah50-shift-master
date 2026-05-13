/**
 * Cloud Functions Unit Tests
 * Uses vitest + mocked firebase-admin. No emulator required.
 *
 * Run: npm run test:unit
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ──────────────────────────────────────────────────────
// vi.hoisted() executes before vi.mock() factories, making these refs available.
const mocks = vi.hoisted(() => {
  const docGet = vi.fn();
  const collectionGet = vi.fn(); // for top-level collection.get()
  const subcollectionGet = vi.fn(); // for subcollection.get()
  const batchSet = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);

  const subcollectionRef = {
    doc: vi.fn().mockReturnValue({}),
    get: subcollectionGet,
  };
  const docRef = {
    get: docGet,
    collection: vi.fn().mockReturnValue(subcollectionRef),
  };
  const collectionRef = {
    doc: vi.fn().mockReturnValue(docRef),
    get: collectionGet,
  };

  const db = {
    collection: vi.fn().mockReturnValue(collectionRef),
    batch: vi.fn().mockReturnValue({
      set: batchSet,
      update: batchUpdate,
      commit: batchCommit,
    }),
  };

  return {
    docGet,
    collectionGet,
    subcollectionGet,
    batchSet,
    batchUpdate,
    batchCommit,
    db,
  };
});

// ── Module mocks ────────────────────────────────────────────────────────────
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => mocks.db),
}));
vi.mock("firebase-functions", () => ({ setGlobalOptions: vi.fn() }));
vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("firebase-functions/v2/https", () => ({
  // onCall becomes transparent — the export IS the raw async handler
  onCall: vi.fn((handler: Function) => handler),
  HttpsError: class HttpsError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));
vi.mock("firebase-functions/v2/identity", () => ({
  beforeUserSignedIn: vi.fn((handler: Function) => handler),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: vi.fn((_path: string, handler: Function) => handler),
}));

// ── Import after mocks are registered ──────────────────────────────────────
import {
  beforeusersignedin,
  initializeBlankMonth,
  onShiftUpdated,
  applyWeeklyTemplate,
} from "../src/index.js";
import * as logger from "firebase-functions/logger";

// ── Helpers ─────────────────────────────────────────────────────────────────
const snap = (exists: boolean, data?: object) => ({ exists, data: () => data });

// Cast to raw async handlers — onCall/beforeUserSignedIn mocks return handler directly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => Promise<any>;
const authHandler = beforeusersignedin as unknown as Handler;
const callHandler = initializeBlankMonth as unknown as Handler;
const shiftHandler = onShiftUpdated as unknown as Handler;

// ── Reset per-call state between tests ──────────────────────────────────────
beforeEach(() => {
  mocks.docGet.mockReset();
  mocks.collectionGet.mockReset();
  mocks.subcollectionGet.mockReset();
  mocks.batchSet.mockReset();
  mocks.batchUpdate.mockReset();
  mocks.batchCommit.mockReset().mockResolvedValue(undefined);
  vi.mocked(logger.info).mockClear();
});

// ============================================================================
// beforeusersignedin — Auth blocking trigger
// ============================================================================
describe("beforeusersignedin", () => {
  it("throws permission-denied when event has no email", async () => {
    await expect(authHandler({ data: {} })).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("throws permission-denied for an email not in the whitelist", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(false));
    await expect(
      authHandler({ data: { email: "unknown@example.com" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws permission-denied for a deactivated user", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "doctor", isActive: false }),
    );
    await expect(
      authHandler({ data: { email: "inactive@example.com" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("returns manager role claim for an active manager", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "manager", isActive: true }),
    );
    const result = await authHandler({ data: { email: "boss@example.com" } });
    expect(result).toEqual({ customClaims: { role: "manager" } });
  });

  it("returns doctor role claim for an active doctor user", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "doctor", isActive: true }),
    );
    const result = await authHandler({ data: { email: "doctor@example.com" } });
    expect(result).toEqual({ customClaims: { role: "doctor" } });
  });

  it("returns assistant role claim for an active assistant user", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "assistant", isActive: true }),
    );
    const result = await authHandler({ data: { email: "assistant@example.com" } });
    expect(result).toEqual({ customClaims: { role: "assistant" } });
  });
});

// ============================================================================
// initializeBlankMonth — Callable function
// ============================================================================
describe("initializeBlankMonth", () => {
  const managerAuth = {
    uid: "manager1",
    token: { email: "manager@example.com", role: "manager" },
  };

  it("throws unauthenticated when no auth context", async () => {
    await expect(
      callHandler({ auth: null, data: { year: 2026, month: 5 } }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws unauthenticated when token has no email", async () => {
    await expect(
      callHandler({
        auth: { uid: "x", token: {} },
        data: { year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws permission-denied when caller is not found in users collection", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(false));
    await expect(
      callHandler({ auth: managerAuth, data: { year: 2026, month: 5 } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws permission-denied when caller is staff", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "staff", isActive: true }),
    );
    await expect(
      callHandler({ auth: managerAuth, data: { year: 2026, month: 5 } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when month is missing", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "manager", isActive: true }),
    );
    await expect(
      callHandler({ auth: managerAuth, data: { year: 2026 } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws invalid-argument when month is out of range (13)", async () => {
    mocks.docGet.mockResolvedValueOnce(
      snap(true, { role: "manager", isActive: true }),
    );
    await expect(
      callHandler({ auth: managerAuth, data: { year: 2026, month: 13 } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws already-exists when the schedule already exists", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager", isActive: true }))
      .mockResolvedValueOnce(snap(true)); // schedule already exists
    await expect(
      callHandler({ auth: managerAuth, data: { year: 2026, month: 5 } }),
    ).rejects.toMatchObject({ code: "already-exists" });
  });

  it("creates the schedule and returns scheduleId + correct daysCreated", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager", isActive: true }))
      .mockResolvedValueOnce(snap(false)); // schedule does not exist
    const result = await callHandler({
      auth: managerAuth,
      data: { year: 2026, month: 5 },
    });
    expect(result).toEqual({ scheduleId: "2026-05", daysCreated: 31 });
    expect(mocks.batchCommit).toHaveBeenCalledOnce();
    // 1 monthly_schedule doc + 31 shift docs = 32 total batch.set calls
    expect(mocks.batchSet).toHaveBeenCalledTimes(32);
  });

  it("creates 28 days for February in a non-leap year", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager", isActive: true }))
      .mockResolvedValueOnce(snap(false));
    const result = await callHandler({
      auth: managerAuth,
      data: { year: 2025, month: 2 },
    });
    expect(result).toEqual({ scheduleId: "2025-02", daysCreated: 28 });
    expect(mocks.batchSet).toHaveBeenCalledTimes(29); // 1 + 28
  });

  it("creates 29 days for February in a leap year", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager", isActive: true }))
      .mockResolvedValueOnce(snap(false));
    const result = await callHandler({
      auth: managerAuth,
      data: { year: 2024, month: 2 },
    });
    expect(result).toEqual({ scheduleId: "2024-02", daysCreated: 29 });
    expect(mocks.batchSet).toHaveBeenCalledTimes(30); // 1 + 29
  });
});

// ============================================================================
// onShiftUpdated — Firestore trigger
// ============================================================================
describe("onShiftUpdated", () => {
  const emptyShift = {
    date: "2026-05-01",
    dayOfWeek: "五",
    slots: { morning: [], afternoon: [], evening: [] },
  };
  const shiftWithStaff = {
    date: "2026-05-01",
    dayOfWeek: "五",
    slots: { morning: ["staff@example.com"], afternoon: [], evening: [] },
  };

  const makeEvent = (
    before: object,
    after: object,
    scheduleId = "2026-05",
  ) => ({
    data: {
      before: { data: () => before },
      after: { data: () => after },
    },
    params: { scheduleId, shiftId: "01" },
  });

  it("returns early and does not query Firestore when event data is null", async () => {
    await shiftHandler({
      data: null,
      params: { scheduleId: "2026-05", shiftId: "01" },
    });
    expect(mocks.docGet).not.toHaveBeenCalled();
  });

  it("does not log when the schedule is not published", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { isPublished: false }));
    await shiftHandler(makeEvent(emptyShift, shiftWithStaff));
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
  });

  it("does not log when the schedule is published but nothing changed", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { isPublished: true }));
    await shiftHandler(makeEvent(shiftWithStaff, shiftWithStaff));
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
  });

  it("logs changes when staff is added to a published schedule", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { isPublished: true }));
    await shiftHandler(makeEvent(emptyShift, shiftWithStaff));
    expect(vi.mocked(logger.info)).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining("[Published]"),
      expect.objectContaining({
        added: expect.arrayContaining(["staff@example.com → morning"]),
      }),
    );
  });

  it("logs changes when staff is removed from a published schedule", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { isPublished: true }));
    await shiftHandler(makeEvent(shiftWithStaff, emptyShift));
    expect(vi.mocked(logger.info)).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining("[Published]"),
      expect.objectContaining({
        removed: expect.arrayContaining(["staff@example.com ✕ morning"]),
      }),
    );
  });
});

// ============================================================================
// applyWeeklyTemplate — Callable function
// ============================================================================
describe("applyWeeklyTemplate", () => {
  const applyHandler = applyWeeklyTemplate as unknown as Handler;

  const MANAGER_AUTH = {
    uid: "manager1",
    token: { email: "manager@example.com", role: "manager" },
  };

  // Template with staff1 assigned to every day-of-week, morning only
  const FULL_TEMPLATE = {
    name: "全週班",
    days: {
      日: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
      一: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
      二: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
      三: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
      四: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
      五: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
      六: { morning: ["staff1@example.com"], afternoon: [], evening: [] },
    },
  };

  // Template with only inactive staff
  const INACTIVE_TEMPLATE = {
    name: "停用員工模板",
    days: {
      日: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
      一: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
      二: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
      三: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
      四: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
      五: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
      六: { morning: ["inactive@example.com"], afternoon: [], evening: [] },
    },
  };

  const USERS_SNAP = {
    docs: [
      {
        id: "staff1@example.com",
        data: () => ({ email: "staff1@example.com", isActive: true }),
      },
      {
        id: "inactive@example.com",
        data: () => ({ email: "inactive@example.com", isActive: false }),
      },
    ],
  };

  const EMPTY_SHIFTS_SNAP = { docs: [] };

  it("throws unauthenticated when no auth context", async () => {
    await expect(
      applyHandler({
        auth: null,
        data: { templateId: "t1", year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws unauthenticated when token has no email", async () => {
    await expect(
      applyHandler({
        auth: { uid: "x", token: {} },
        data: { templateId: "t1", year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws permission-denied when caller is not found in users collection", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(false));
    await expect(
      applyHandler({
        auth: MANAGER_AUTH,
        data: { templateId: "t1", year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws permission-denied when caller is staff", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { role: "staff" }));
    await expect(
      applyHandler({
        auth: MANAGER_AUTH,
        data: { templateId: "t1", year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when templateId is missing", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { role: "manager" }));
    await expect(
      applyHandler({
        auth: MANAGER_AUTH,
        data: { year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws invalid-argument for month out of range (13)", async () => {
    mocks.docGet.mockResolvedValueOnce(snap(true, { role: "manager" }));
    await expect(
      applyHandler({
        auth: MANAGER_AUTH,
        data: { templateId: "t1", year: 2026, month: 13 },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws not-found when template does not exist", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager" })) // caller
      .mockResolvedValueOnce(snap(false)); // template missing
    await expect(
      applyHandler({
        auth: MANAGER_AUTH,
        data: { templateId: "missing-id", year: 2026, month: 5 },
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("auto-creates month and applies template when month does not exist", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager" })) // caller
      .mockResolvedValueOnce(snap(true, FULL_TEMPLATE)) // template
      .mockResolvedValueOnce(snap(false)); // schedule doesn't exist
    mocks.collectionGet.mockResolvedValueOnce(USERS_SNAP); // active users
    mocks.subcollectionGet.mockResolvedValueOnce(EMPTY_SHIFTS_SNAP); // empty shifts

    const result = await applyHandler({
      auth: MANAGER_AUTH,
      data: { templateId: "t1", year: 2026, month: 5 },
    });

    expect(result.scheduleId).toBe("2026-05");
    // All 31 days get staff1 added (from empty), so all 31 are updated
    expect(result.daysUpdated).toBe(31);
    expect(result.staffFiltered).toHaveLength(0);
    // batch.commit() called twice: once for month creation, once for updates
    expect(mocks.batchCommit).toHaveBeenCalledTimes(2);
    // 1 schedule doc + 31 shift docs created in first batch
    expect(mocks.batchSet).toHaveBeenCalledTimes(32);
  });

  it("applies to existing month without auto-creating it", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager" })) // caller
      .mockResolvedValueOnce(snap(true, FULL_TEMPLATE)) // template
      .mockResolvedValueOnce(snap(true, { year: 2026, month: 5 })); // schedule exists
    mocks.collectionGet.mockResolvedValueOnce(USERS_SNAP);
    mocks.subcollectionGet.mockResolvedValueOnce(EMPTY_SHIFTS_SNAP);

    const result = await applyHandler({
      auth: MANAGER_AUTH,
      data: { templateId: "t1", year: 2026, month: 5 },
    });

    expect(result.scheduleId).toBe("2026-05");
    expect(result.daysUpdated).toBe(31);
    // Only one batch commit — the update batch, no creation batch
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(mocks.batchSet).not.toHaveBeenCalled();
  });

  it("filters inactive staff and reports them in staffFiltered", async () => {
    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager" }))
      .mockResolvedValueOnce(snap(true, INACTIVE_TEMPLATE))
      .mockResolvedValueOnce(snap(true, { year: 2026, month: 5 }));
    mocks.collectionGet.mockResolvedValueOnce(USERS_SNAP);
    mocks.subcollectionGet.mockResolvedValueOnce(EMPTY_SHIFTS_SNAP);

    const result = await applyHandler({
      auth: MANAGER_AUTH,
      data: { templateId: "t1", year: 2026, month: 5 },
    });

    expect(result.staffFiltered).toContain("inactive@example.com");
    // No days updated since the only template staff is inactive
    expect(result.daysUpdated).toBe(0);
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
  });

  it("preserves existing assignments when applying (union merge)", async () => {
    // Existing: day "01" morning has existing@example.com
    const existingShiftDoc = {
      id: "01",
      data: () => ({
        date: "2026-05-01",
        dayOfWeek: "五",
        slots: {
          morning: ["existing@example.com"],
          afternoon: [],
          evening: [],
        },
      }),
    };

    mocks.docGet
      .mockResolvedValueOnce(snap(true, { role: "manager" }))
      .mockResolvedValueOnce(snap(true, FULL_TEMPLATE)) // staff1 on all days
      .mockResolvedValueOnce(snap(true, { year: 2026, month: 5 }));
    mocks.collectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "staff1@example.com",
          data: () => ({ email: "staff1@example.com", isActive: true }),
        },
        {
          id: "existing@example.com",
          data: () => ({ email: "existing@example.com", isActive: true }),
        },
      ],
    });
    mocks.subcollectionGet.mockResolvedValueOnce({
      docs: [existingShiftDoc],
    });

    const result = await applyHandler({
      auth: MANAGER_AUTH,
      data: { templateId: "t1", year: 2026, month: 5 },
    });

    // All 31 days updated: day "01" gets staff1 added alongside existing@, rest get staff1
    expect(result.daysUpdated).toBe(31);
    expect(result.staffFiltered).toHaveLength(0);
    // Day "01" should have both existing and template staff merged
    expect(mocks.batchUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slots: expect.objectContaining({
          morning: expect.arrayContaining([
            "existing@example.com",
            "staff1@example.com",
          ]),
        }),
      }),
    );
  });
});
