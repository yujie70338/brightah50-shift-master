/**
 * Firestore Security Rules Integration Tests
 * Uses @firebase/rules-unit-testing against the Firestore Emulator.
 *
 * Prerequisites:
 *   Start emulator before running:
 *     npx firebase-tools@latest emulators:start --only firestore
 *
 * Run: npm run test:rules
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  collection,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RULES = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");

// ── Auth token shapes ────────────────────────────────────────────────────────
const MANAGER_TOKEN = { role: "manager", email: "manager@example.com" };
const STAFF_TOKEN = { role: "doctor", email: "staff@example.com" };
const OTHER_STAFF_TOKEN = { role: "assistant", email: "other@example.com" };

let testEnv: RulesTestEnvironment;

// ── Setup / teardown ─────────────────────────────────────────────────────────
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "brightah50-shift-master",
    firestore: {
      rules: RULES,
      host: "localhost",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ── Context helpers ───────────────────────────────────────────────────────────
const managerDb = () =>
  testEnv.authenticatedContext("manager1", MANAGER_TOKEN).firestore();
const staffDb = () =>
  testEnv.authenticatedContext("staff1", STAFF_TOKEN).firestore();
const otherStaffDb = () =>
  testEnv.authenticatedContext("staff2", OTHER_STAFF_TOKEN).firestore();
const unauthDb = () => testEnv.unauthenticatedContext().firestore();

// Bypass rules to seed initial data for read/update/delete tests
const seedDb = () =>
  testEnv.withSecurityRulesDisabled((ctx) => ctx.firestore());

// ============================================================================
// users collection
// ============================================================================
describe("users collection", () => {
  const validUser = {
    displayName: "New Staff",
    email: "new@example.com",
    role: "staff",
    isActive: true,
  };

  it("unauthenticated user cannot read users", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "new@example.com"), validUser);
    });
    await assertFails(getDoc(doc(unauthDb(), "users", "new@example.com")));
  });

  it("authenticated staff can read users", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "new@example.com"), validUser);
    });
    await assertSucceeds(getDoc(doc(staffDb(), "users", "new@example.com")));
  });

  it("staff cannot create a user document", async () => {
    await assertFails(
      setDoc(doc(staffDb(), "users", "new@example.com"), validUser),
    );
  });

  it("manager can create a user document with valid fields", async () => {
    await assertSucceeds(
      setDoc(doc(managerDb(), "users", "new@example.com"), validUser),
    );
  });

  it("manager cannot create a user document with extra fields", async () => {
    await assertFails(
      setDoc(doc(managerDb(), "users", "new@example.com"), {
        ...validUser,
        secretNote: "injection attempt",
      }),
    );
  });

  it("manager cannot delete a user document", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "new@example.com"), validUser);
    });
    await assertFails(deleteDoc(doc(managerDb(), "users", "new@example.com")));
  });
});

// ============================================================================
// monthly_schedules collection
// ============================================================================
describe("monthly_schedules collection", () => {
  const validSchedule = {
    year: 2026,
    month: 5,
    isPublished: false,
    managerId: "manager@example.com",
  };

  it("staff can read monthly schedules", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "monthly_schedules", "2026-05"),
        validSchedule,
      );
    });
    await assertSucceeds(
      getDoc(doc(staffDb(), "monthly_schedules", "2026-05")),
    );
  });

  it("staff cannot create a monthly schedule", async () => {
    await assertFails(
      setDoc(doc(staffDb(), "monthly_schedules", "2026-05"), validSchedule),
    );
  });

  it("manager can create a monthly schedule with valid fields", async () => {
    await assertSucceeds(
      setDoc(doc(managerDb(), "monthly_schedules", "2026-05"), validSchedule),
    );
  });

  it("manager can update the isPublished field (publish toggle)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "monthly_schedules", "2026-05"),
        validSchedule,
      );
    });
    await assertSucceeds(
      updateDoc(doc(managerDb(), "monthly_schedules", "2026-05"), {
        ...validSchedule,
        isPublished: true,
      }),
    );
  });

  it("manager cannot delete a monthly schedule", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "monthly_schedules", "2026-05"),
        validSchedule,
      );
    });
    await assertFails(
      deleteDoc(doc(managerDb(), "monthly_schedules", "2026-05")),
    );
  });

  // ── shifts subcollection ────────────────────────────────────────────────
  describe("shifts subcollection", () => {
    const validShift = {
      date: "2026-05-01",
      dayOfWeek: "五",
      slots: { morning: [], afternoon: [], evening: [] },
    };

    it("staff can read shifts", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), "monthly_schedules/2026-05/shifts", "01"),
          validShift,
        );
      });
      await assertSucceeds(
        getDoc(doc(staffDb(), "monthly_schedules/2026-05/shifts", "01")),
      );
    });

    it("staff cannot write shifts", async () => {
      await assertFails(
        setDoc(
          doc(staffDb(), "monthly_schedules/2026-05/shifts", "01"),
          validShift,
        ),
      );
    });

    it("manager can write shifts with valid fields", async () => {
      await assertSucceeds(
        setDoc(
          doc(managerDb(), "monthly_schedules/2026-05/shifts", "01"),
          validShift,
        ),
      );
    });
  });
});

// ============================================================================
// unavailability collection
// ============================================================================
describe("unavailability collection", () => {
  const staffUnavail = {
    userId: "staff@example.com",
    userDisplayName: "Staff User",
    date: "2026-05-10",
    unavailableSlots: ["morning"],
  };
  const otherUnavail = {
    userId: "other@example.com",
    userDisplayName: "Other User",
    date: "2026-05-10",
    unavailableSlots: ["afternoon"],
  };

  it("unauthenticated user cannot read unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc1"),
        staffUnavail,
      );
    });
    await assertFails(getDoc(doc(unauthDb(), "unavailability", "doc1")));
  });

  it("authenticated staff can read all unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc1"),
        otherUnavail,
      );
    });
    await assertSucceeds(getDoc(doc(staffDb(), "unavailability", "doc1")));
  });

  it("staff can create their own unavailability", async () => {
    await assertSucceeds(
      addDoc(collection(staffDb(), "unavailability"), staffUnavail),
    );
  });

  it("staff cannot create unavailability for another user (userId mismatch)", async () => {
    // staff@example.com tries to create a doc where userId = other@example.com
    await assertFails(
      addDoc(collection(staffDb(), "unavailability"), otherUnavail),
    );
  });

  it("staff cannot create unavailability with extra fields", async () => {
    await assertFails(
      addDoc(collection(staffDb(), "unavailability"), {
        ...staffUnavail,
        hidden: "extra field injection",
      }),
    );
  });

  it("staff can update their own unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc1"),
        staffUnavail,
      );
    });
    await assertSucceeds(
      updateDoc(doc(staffDb(), "unavailability", "doc1"), {
        ...staffUnavail,
        unavailableSlots: ["morning", "afternoon"],
      }),
    );
  });

  it("staff cannot update another user's unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc2"),
        otherUnavail,
      );
    });
    // staff@example.com tries to update a doc owned by other@example.com
    await assertFails(
      updateDoc(doc(staffDb(), "unavailability", "doc2"), {
        ...otherUnavail,
        unavailableSlots: ["evening"],
      }),
    );
  });

  it("staff cannot update own unavailability to change userId", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc1"),
        staffUnavail,
      );
    });
    await assertFails(
      updateDoc(doc(staffDb(), "unavailability", "doc1"), {
        ...staffUnavail,
        userId: "other@example.com", // attempt to change ownership
      }),
    );
  });

  it("staff can delete their own unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc1"),
        staffUnavail,
      );
    });
    await assertSucceeds(deleteDoc(doc(staffDb(), "unavailability", "doc1")));
  });

  it("staff cannot delete another user's unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc2"),
        otherUnavail,
      );
    });
    await assertFails(deleteDoc(doc(staffDb(), "unavailability", "doc2")));
  });

  it("manager can delete any unavailability", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "unavailability", "doc1"),
        staffUnavail,
      );
    });
    await assertSucceeds(deleteDoc(doc(managerDb(), "unavailability", "doc1")));
  });
});

// ============================================================================
// weekly_templates collection
// ============================================================================
describe("weekly_templates collection", () => {
  const emptySlots = { morning: [], afternoon: [], evening: [] };
  const validTemplate = {
    name: "標準週班表",
    createdBy: "manager@example.com",
    updatedAt: new Date(),
    days: {
      日: emptySlots,
      一: emptySlots,
      二: emptySlots,
      三: emptySlots,
      四: emptySlots,
      五: emptySlots,
      六: emptySlots,
    },
  };

  it("unauthenticated user cannot read templates", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "weekly_templates", "t1"),
        validTemplate,
      );
    });
    await assertFails(getDoc(doc(unauthDb(), "weekly_templates", "t1")));
  });

  it("authenticated staff can read templates", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "weekly_templates", "t1"),
        validTemplate,
      );
    });
    await assertSucceeds(getDoc(doc(staffDb(), "weekly_templates", "t1")));
  });

  it("staff cannot create a template", async () => {
    await assertFails(
      setDoc(doc(staffDb(), "weekly_templates", "t1"), validTemplate),
    );
  });

  it("manager can create a template with valid fields", async () => {
    await assertSucceeds(
      setDoc(doc(managerDb(), "weekly_templates", "t1"), validTemplate),
    );
  });

  it("manager cannot create a template with extra fields", async () => {
    await assertFails(
      setDoc(doc(managerDb(), "weekly_templates", "t1"), {
        ...validTemplate,
        extraField: "injection attempt",
      }),
    );
  });

  it("manager cannot create a template with empty name", async () => {
    await assertFails(
      setDoc(doc(managerDb(), "weekly_templates", "t1"), {
        ...validTemplate,
        name: "",
      }),
    );
  });

  it("manager can update a template", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "weekly_templates", "t1"),
        validTemplate,
      );
    });
    await assertSucceeds(
      setDoc(doc(managerDb(), "weekly_templates", "t1"), {
        ...validTemplate,
        name: "更新後模板",
      }),
    );
  });

  it("staff cannot update a template", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "weekly_templates", "t1"),
        validTemplate,
      );
    });
    await assertFails(
      setDoc(doc(staffDb(), "weekly_templates", "t1"), {
        ...validTemplate,
        name: "Staff override",
      }),
    );
  });

  it("manager can delete a template", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "weekly_templates", "t1"),
        validTemplate,
      );
    });
    await assertSucceeds(
      deleteDoc(doc(managerDb(), "weekly_templates", "t1")),
    );
  });

  it("staff cannot delete a template", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "weekly_templates", "t1"),
        validTemplate,
      );
    });
    await assertFails(deleteDoc(doc(staffDb(), "weekly_templates", "t1")));
  });
});
