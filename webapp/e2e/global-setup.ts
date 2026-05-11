import type { FullConfig } from "@playwright/test";

const PROJECT_ID = "brightah50-shift-master";
const FS = "http://127.0.0.1:8080";
const AU = "http://127.0.0.1:9099";

const USERS = [
  { email: "manager@brightah50.com", displayName: "陳經理", role: "manager", isActive: true },
  { email: "staff1@brightah50.com",  displayName: "王小明", role: "staff",   isActive: true },
  { email: "staff2@brightah50.com",  displayName: "李小華", role: "staff",   isActive: true },
  { email: "staff3@brightah50.com",  displayName: "張小美", role: "staff",   isActive: true },
  { email: "staff4@brightah50.com",  displayName: "吳大山", role: "staff",   isActive: true },
  { email: "staff5@brightah50.com",  displayName: "林小雨", role: "staff",   isActive: true },
  { email: "staff6@brightah50.com",  displayName: "趙志明", role: "staff",   isActive: true },
  { email: "staff7@brightah50.com",  displayName: "黃美玲", role: "staff",   isActive: true },
  { email: "staff8@brightah50.com",  displayName: "周大偉", role: "staff",   isActive: false },
];

/** Write a Firestore document via the emulator REST API. */
async function fsSet(
  collection: string,
  docId: string,
  data: Record<string, string | boolean | number>
) {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (typeof v === "number") fields[k] = { integerValue: String(v) };
    else fields[k] = { stringValue: v };
  }
  const res = await fetch(
    `${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents` +
      `/${collection}/${encodeURIComponent(docId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        // Bypass security rules — emulator-only admin token
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) throw new Error(`fsSet ${collection}/${docId}: ${await res.text()}`);
}

export default async function globalSetup(_config: FullConfig) {
  // ── 1. Clear all emulator state ─────────────────────────────────────────
  await Promise.all([
    fetch(
      `${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" }
    ),
    fetch(`${AU}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: "DELETE",
    }),
  ]);

  // ── 2. Seed Firestore users (must be done BEFORE auth signUp so the
  //        beforeUserSignedIn blocking function can whitelist them) ──────────
  await Promise.all(
    USERS.map((u) =>
      fsSet("users", u.email, {
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        isActive: u.isActive,
      })
    )
  );

  // ── 3. Create Auth emulator accounts ────────────────────────────────────
  await Promise.all(
    USERS.map((u) =>
      fetch(
        `${AU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: u.email,
            password: "test1234",
            returnSecureToken: false,
          }),
        }
      ).then(async (r) => {
        if (!r.ok) {
          const body = await r.text();
          // EMAIL_EXISTS is fine — account already present from a previous run
          if (!body.includes("EMAIL_EXISTS")) {
            console.warn(`Auth signUp ${u.email}: ${body}`);
          }
        }
      })
    )
  );

  console.log(`✅ Global setup complete (${USERS.length} users seeded)`);
}
