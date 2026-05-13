# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project overview

萊特動物醫院內部排班管理系統 (Bright Animal Hospital internal shift scheduler). A Firebase-hosted SPA with Cloud Functions backend. Two workspaces: `webapp/` (React) and `functions/` (Node.js/TypeScript).

---

## Commands

### Local development

```bash
# Start Firebase emulators + seed test users (requires Java 21 Temurin at the path in the script)
./dev-start.sh           # full start: emulators + seed
./dev-start.sh seed      # re-seed only (emulators already running)
./dev-start.sh kill      # kill all emulator ports

# Vite dev server (after emulators are running)
cd webapp && npm run dev  # http://localhost:5173
```

Emulator ports: Firestore `:8080`, Auth `:9099`, Functions `:5001`, Hosting `:5002`, UI `:4000`.

**Java requirement**: Firestore emulator requires Java 21 (Temurin). The script sets `JAVA_HOME` to `/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home`.

### webapp

```bash
cd webapp
npm run build        # tsc -b + vite build (production)
npm run lint         # ESLint
npm run dev          # Vite dev server
npm run test:e2e     # Playwright E2E (requires emulators + Vite dev server)
npm run test:e2e:ui  # Playwright with UI mode
```

### functions

```bash
cd functions
npm run build        # tsc → lib/
npm test             # all Vitest tests (functions + rules)
npm run test:unit    # functions.test.ts only (no emulator needed)
npm run test:rules   # rules.test.ts only (needs Firestore emulator)
```

Run a single test file:
```bash
cd functions && npx vitest run test/functions.test.ts
```

---

## Architecture

### Data flow

```
Firebase Auth (Google OAuth / Email+Password)
    → beforeUserSignedIn (blocking trigger)
        checks email against users/{email} whitelist
        injects role custom claim (manager | staff)
    → client AuthContext reads claim from token
```

The `useAuth()` hook exposes both `firebaseUser` (Firebase token) and `userProfile` (Firestore `users/{email}` doc). Role-based access in `ProtectedRoute` uses `userProfile.role`; Firestore security rules use the `role` custom claim from the token.

### Firestore schema

```
users/{email}             User (whitelist + role + isActive + isDeleted)
monthly_schedules/{YYYY-MM}
  .isPublished, .year, .month, .managerId
  /shifts/{DD}            ShiftDocument (date, dayOfWeek, slots: {morning/afternoon/evening: email[]})
unavailability/{docId}    Unavailability (userId, date, unavailableSlots, reason)
weekly_templates/{id}     WeeklyTemplate (name, createdBy, days: Record<DayOfWeek, ShiftSlots>)
```

`scheduleId` is always `"YYYY-MM"`. Shift doc IDs are zero-padded day numbers `"01"`–`"31"`.

### Cloud Functions (`functions/src/index.ts`)

| Function | Type | Purpose |
|---|---|---|
| `beforeusersignedin` | Auth Blocking | Email whitelist + role claim injection + isDeleted/isActive check |
| `initializeBlankMonth` | onCall | Creates monthly_schedule + all shift sub-docs in one batch |
| `onShiftUpdated` | Firestore trigger | Logs changes on published months (Resend email TODO) |
| `applyWeeklyTemplate` | onCall | Union-merges a weekly template into a target month (auto-creates month if absent, filters inactive staff) |

All callables verify `manager` role by re-reading Firestore rather than trusting only the token.

### Frontend key patterns

**Auth**: `AuthContext` wraps `onAuthStateChanged`; after sign-in it fetches the Firestore user doc to populate `userProfile`. In dev mode, `window.__e2eSignIn` / `window.__e2eSignOut` are exposed for Playwright.

**Real-time data**: `useSchedule(scheduleId)` sets up three concurrent `onSnapshot` listeners (schedule doc, shifts subcollection, unavailability collection). `useTemplates()` listens to `weekly_templates`.

**ShiftBoard interaction modes**:
- Normal: click a cell → `QuickAssignModal` popover (checkbox multi-select)
- Paint/Brush mode: click a sidebar employee → all cell clicks call `arrayUnion` directly; DnD is disabled while active; Escape exits

**Soft delete**: Employees are never hard-deleted. `isDeleted: true` hides them from all lists and blocks login via the blocking trigger. Shift history still resolves their name via `userMap` (which is built from all users including deleted ones).

### CSS system

All styling uses CSS custom properties defined in `webapp/src/styles/tokens.css` (brand: `--color-primary: #D4A843`, secondary: `--color-secondary: #9B8B7A`). Utility classes are in `webapp/src/styles/global.css`. Both are imported once in `main.tsx`. Components use `className="btn btn-primary"` etc., or inline `style={{ color: "var(--color-warning)" }}` for one-offs. Do **not** add raw hex color values — always use a token variable.

`global.css` also contains **responsive Navbar classes** (`.navbar`, `.navbar-brand`, `.navbar-nav`, `.navbar-user`, `.nav-link`) with `@media (max-width: 768px)` (nav wraps to a full-width second row) and `@media (max-width: 480px)` (brand title hidden). `Navbar.tsx` uses only CSS classNames — no inline styles.

### Type synchronization

`functions/src/types.ts` and `webapp/src/types/index.ts` are manually kept in sync — there is no shared package. When adding or changing a type, update **both files**.

### E2E tests

`webapp/e2e/global-setup.ts` runs before all specs: it clears emulator state and seeds 9 users (1 manager, 7 active staff, 1 inactive staff) via the emulator REST API. Tests must run serially (`workers: 1`) to avoid Firestore state conflicts. The base URL is `http://localhost:5173` (Vite dev server, not the Firebase Hosting emulator at `:5002`).

Spec files: `auth.spec.ts`, `schedule.spec.ts`, `popover.spec.ts`, `admin.spec.ts`, `template.spec.ts`, `paint-mode.spec.ts`, `unavailability.spec.ts`, `navbar.spec.ts` (N-1~N-6, responsive layout tests). Screenshot capture is in `capture-screenshots.spec.ts` (excluded from normal runs; use `screenshot.config.ts`).

### Environment variables

`webapp/.env.local` (copy from `.env.local.example`) must contain all `VITE_FIREBASE_*` keys from the Firebase Console. These are only needed for production builds; dev mode uses hardcoded emulator endpoints.

### Firestore security rules

Rules in `firestore.rules` use `request.auth.token.get('role', '')` to check the custom claim. The `userFieldsOnly()` function allowlists permitted fields on writes — add new fields there when extending the `User` type.
