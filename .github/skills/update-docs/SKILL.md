---
name: update-docs
description: 'Update README.md and docs/ files after code changes. Use when: code was modified and documentation needs updating; after merging PRs; after adding features, changing config, or modifying security rules; user says "update docs", "sync documentation", "文件更新", "更新文件".'
argument-hint: 'Optionally specify which files changed or a git ref range (e.g., HEAD~3..HEAD)'
---

# Update Documentation After Code Changes

## When to Use
- After code changes that affect user-facing behavior, architecture, configuration, or project structure
- After modifying `firebase.json`, `firestore.rules`, Cloud Functions, React components/pages, or package dependencies
- When the user asks to update or sync documentation

## Procedure

### Step 1: Identify Changes

Run `git diff` to understand what changed. Use the scope provided by the user, or default to unstaged + staged changes:

```bash
# If user provides a ref range:
git diff <ref-range> --stat
git diff <ref-range> --name-only

# Otherwise, check all recent changes:
git diff HEAD --stat
git diff --cached --stat
git log --oneline -10
```

Categorize each changed file into one of these impact areas:

| Impact Area | Triggers doc update in | Example changes |
|---|---|---|
| **User-facing behavior** | `docs/manager-guide.md`, `docs/staff-guide.md` | New UI component, changed workflow, new page |
| **Architecture / Config** | `README.md` (技術棧/專案結構), `CLAUDE.md` | `firebase.json`, `firestore.rules`, new dependency, new Cloud Function |
| **Dev workflow** | `docs/dev-testing-guide.md`, `README.md` (快速開始/測試) | `dev-start.sh`, test config, emulator changes |
| **Deployment** | `docs/deployment-guide.md` | CI/CD, deploy scripts, environment variables |
| **Project structure** | `README.md` (專案結構 tree) | New files/folders, renamed files |

### Step 2: Read Affected Documentation Files

Read the documentation files identified in Step 1 to understand their current content. Key files:

- `README.md` — Project overview, tech stack, quick start, test commands, deploy commands, project structure tree, role permissions table
- `docs/manager-guide.md` — Manager operations manual with screenshots
- `docs/staff-guide.md` — Staff operations manual with screenshots
- `docs/dev-testing-guide.md` — Local dev setup, test flows, AI agent testing guide
- `docs/deployment-guide.md` — Production deployment steps, troubleshooting
- `docs/development-phases.md` — Build history by phase (append-only)
- `CLAUDE.md` — AI assistant context (architecture, schema, commands, patterns)

### Step 3: Determine Required Updates

For each affected doc file, compare the current content against the code changes:

1. **Accuracy check**: Are there descriptions that contradict the new code?
2. **Completeness check**: Are new features/files/commands missing from the docs?
3. **Structure check**: Does the project structure tree in `README.md` match the actual file tree?
4. **Screenshot check**: If UI changed, do screenshots in `docs/images/` need recapture?

### Step 4: Apply Updates

Edit the affected documentation files. Follow these conventions:

- **Language**: `README.md` and `CLAUDE.md` use mixed Chinese/English. `docs/manager-guide.md` and `docs/staff-guide.md` are fully in Traditional Chinese (繁體中文). `docs/dev-testing-guide.md` and `docs/deployment-guide.md` use mixed.
- **CSS tokens**: Never reference raw hex colors — use `--color-primary`, `--color-secondary` etc.
- **Screenshot references**: Use relative paths like `images/01-login.png`
- **Project structure tree**: Must reflect actual files. Verify with `find` or `list_dir` before updating.
- **Type sync note**: If `functions/src/types.ts` or `webapp/src/types/index.ts` changed, mention both files need to stay in sync.

### Step 5: Verify

After editing, verify the updates:

1. Check for broken markdown links: search for `](` patterns and verify targets exist
2. Confirm the project structure tree in `README.md` matches reality
3. If screenshots were referenced, confirm the image files exist in `docs/images/`
4. Read each modified doc file to ensure consistency and no leftover outdated content

### Step 6: Summary

Report to the user:
- Which files were updated and why
- Any screenshots that may need recapture (list specific ones)
- Any doc files that were NOT updated and why (no impact from the changes)

## Important Notes

- Do NOT update `docs/development-phases.md` unless the user explicitly asks — it's an append-only historical log
- Do NOT fabricate feature descriptions — always verify against actual source code
- If a change affects `CLAUDE.md` (architecture, schema, commands), update it too — AI assistants rely on it for context
