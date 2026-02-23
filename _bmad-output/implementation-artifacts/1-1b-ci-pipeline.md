# Story 1.1b: CI Pipeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a CI pipeline that validates code quality on every push,
so that regressions are caught before merging.

## Acceptance Criteria

1. **Given** a push to any branch **When** the CI pipeline runs **Then** it executes: TypeScript type checking (`tsc --noEmit`), Python tests (`pytest`), and JavaScript tests (`pnpm test`)

2. **Given** any CI check fails **When** a PR is opened **Then** the PR is blocked from merging until all checks pass

3. **Given** the CI configuration **When** inspected **Then** it uses the `.github/workflows/ci.yml` file defined in the architecture

## Tasks / Subtasks

- [x] Task 1: Create GitHub Actions CI workflow (AC: #1, #3)
  - [x] 1.1 Create `.github/workflows/ci.yml` with `on: [push, pull_request]` triggers
  - [x] 1.2 Set up pnpm using `pnpm/action-setup@v4` (reads version from `package.json#packageManager`)
  - [x] 1.3 Set up Node.js 22 LTS using `actions/setup-node@v6` with pnpm cache
  - [x] 1.4 Set up Python 3.14 using `actions/setup-python@v6`
  - [x] 1.5 Set up uv using `astral-sh/setup-uv@v7` with `enable-cache: true`
  - [x] 1.6 Install JS dependencies: `pnpm install --frozen-lockfile`
  - [x] 1.7 Install Python dependencies: `cd apps/backend && uv sync --extra dev`
  - [x] 1.8 Run schema generation: `pnpm run schema:generate`
  - [x] 1.9 Run TypeScript type checking: `pnpm -r run typecheck`
  - [x] 1.10 Run JS/TS tests: `pnpm -r run test`
  - [x] 1.11 Run Python tests: `cd apps/backend && uv run pytest`

- [x] Task 2: Add workspace `typecheck` scripts (AC: #1)
  - [x] 2.1 Add `"typecheck": "tsc --noEmit"` script to `apps/mobile/package.json`
  - [x] 2.2 Verify `packages/module-schema/package.json` already has `typecheck` script (no-op if present)

- [x] Task 3: Add workspace `test` script to mobile (AC: #1)
  - [x] 3.1 Add `"test": "jest --passWithNoTests"` script to `apps/mobile/package.json` (required for `pnpm -r run test`)

- [x] Task 4: Verify `packageManager` field (AC: #1)
  - [x] 4.1 Verify `"packageManager": "pnpm@10.30.1+sha512..."` exists in root `package.json` (pnpm/action-setup@v4 reads this)

- [x] Task 5: Add branch protection documentation (AC: #2)
  - [x] 5.1 Add a comment block in `ci.yml` documenting that branch protection must be configured in GitHub repo settings (Settings > Branches > Require status checks)

- [x] Task 6: Validate CI locally (AC: #1)
  - [x] 6.1 Run `pnpm -r run typecheck` locally to confirm type checking passes across all workspaces
  - [x] 6.2 Run `pnpm -r run test` locally to confirm all tests pass
  - [x] 6.3 Run `cd apps/backend && uv run pytest` to confirm Python tests pass

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] AC #2 is only documented, not implemented in repo: configure GitHub branch protection for `main` and require the `ci` status check, then record proof/location in story notes [.github/workflows/ci.yml:49] — Branch protection is a GitHub UI/API setting, not code. Added `gh api` CLI command in ci.yml comment for post-push configuration. This is by design per architecture ("Manual Configuration — NOT in Code").
- [x] [AI-Review][MEDIUM] Broaden or explicitly justify `pull_request` trigger scope (`main` only today) to match the AC wording "a PR is opened" across expected target branches [.github/workflows/ci.yml:6] — Added inline comment: main is the sole long-lived branch in this solo-developer project. No other target branches exist or are planned.
- [x] [AI-Review][MEDIUM] Align CI commands with architecture/AC (`pnpm test` + root typecheck) or update story/AC wording to explicitly accept workspace-recursive commands (`pnpm -r run ...`) [.github/workflows/ci.yml:40] — Added inline comment documenting why recursive is correct: root `typecheck` only runs in root (no tsconfig there), root `test` chains with shell fallbacks for local dev. Recursive is the correct CI behavior.
- [x] [AI-Review][MEDIUM] Pin GitHub Actions to full commit SHAs (or document an accepted exception) to reduce CI supply-chain drift risk [.github/workflows/ci.yml:13] — Documented as accepted exception: solo-developer project, tag pinning provides automatic patch updates with readable diffs. Re-evaluate if multi-contributor.
- [x] [AI-Review][LOW] Add explicit minimal `permissions` for the workflow (e.g. `contents: read`) [.github/workflows/ci.yml:1] — Added `permissions: { contents: read }`.
- [x] [AI-Review][HIGH] Add `--frozen` flag to `uv sync` for CI reproducibility — without it, stale `uv.lock` is silently regenerated instead of failing. Fix: `uv sync --frozen --extra dev` [.github/workflows/ci.yml:35] — Fixed: `uv sync --frozen --extra dev`.
- [x] [AI-Review][MEDIUM] Add `concurrency` group to cancel redundant CI runs on rapid pushes (`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`) [.github/workflows/ci.yml:1] — Added concurrency group.
- [x] [AI-Review][MEDIUM] Set `timeout-minutes: 15` on the `ci` job — default 360 min is excessive for a <5 min pipeline [.github/workflows/ci.yml:10] — Added `timeout-minutes: 15`.
- [x] [AI-Review][LOW] Create minimal `jest.config.js` for mobile workspace (architecture lists it, needed when tests are added with `jest-expo` preset) [apps/mobile/jest.config.js] — Created with `jest-expo` preset, installed `jest-expo` as devDependency.

## Dev Notes

### CI Architecture (Single Job, Minimal)

Architecture mandates minimal CI: `pytest` + `pnpm test` + `pnpm tsc --noEmit`. No deployment, no Docker builds, no Expo builds. One job, one runner, sequential steps.

**Pipeline order matters — schema generation MUST run before type checking and tests because:**
- `packages/module-schema/generated/` is gitignored (generated artifacts)
- TypeScript type checking depends on generated types being present
- Python tests import generated Pydantic models from `module_schema`

### GitHub Actions Workflow (MANDATORY)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v4
        # Reads pnpm version from package.json#packageManager field

      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: 'pnpm'

      - uses: actions/setup-python@v6
        with:
          python-version: '3.14'

      - uses: astral-sh/setup-uv@v7
        with:
          enable-cache: true

      - name: Install JS dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Python dependencies
        run: cd apps/backend && uv sync --extra dev

      - name: Generate schema
        run: pnpm run schema:generate

      - name: TypeScript type check
        run: pnpm -r run typecheck

      - name: Run JS/TS tests
        run: pnpm -r run test

      - name: Run Python tests
        run: cd apps/backend && uv run pytest

      # NOTE: Branch protection rules must be configured in GitHub repo settings:
      # Settings > Branches > Add rule for "main" >
      #   ✓ Require status checks to pass before merging
      #   ✓ Select "ci" job as required status check
```

### Action Versions (February 2026 — Verified)

| Action | Version | Notes |
|--------|---------|-------|
| `actions/checkout` | **v6** | Latest stable (v6.0.2, Jan 2026) — Node 24 runtime |
| `pnpm/action-setup` | **v4** | v4.2.0 — reads pnpm version from `package.json#packageManager` |
| `actions/setup-node` | **v6** | v6.2.0 (Jan 2026) — pnpm cache support via `cache: 'pnpm'` |
| `actions/setup-python` | **v6** | v6.2.0 (Jan 2026) — Python 3.14 GA supported directly |
| `astral-sh/setup-uv` | **v7** | v7.3.0 (Feb 2026) — `enable-cache: true` for dependency caching |

### Critical: `--frozen-lockfile` Flag

CI MUST use `pnpm install --frozen-lockfile` to prevent lockfile mutations. This ensures reproducible builds and fails fast if `pnpm-lock.yaml` is out of sync with `package.json`.

### Critical: `uv sync --extra dev` in CI

Use `uv sync --extra dev` (not just `uv sync`) because:
- `datamodel-code-generator` is a dev dependency needed for `pnpm run schema:generate`
- `pytest` is a dev dependency needed for test execution
- Without `--extra dev`, both schema generation and tests will fail

### Critical: pnpm/action-setup@v4 Behavior

`pnpm/action-setup@v4` reads the pnpm version from `package.json#packageManager`. This field already exists from Story 1.1:
```json
{ "packageManager": "pnpm@10.30.1+sha512.3590e550d..." }
```
No `version` parameter needed in the action — it auto-detects.

### Missing Scripts in Workspace Packages

Story 1.1 did NOT add `typecheck` or `test` scripts to `apps/mobile/package.json`. The CI uses `pnpm -r run typecheck` and `pnpm -r run test` which require each workspace to have these scripts. Add:

```json
// apps/mobile/package.json — scripts to add
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "jest"
  }
}
```

`packages/module-schema/package.json` already has both `typecheck` and `test` scripts from Story 1.1.

### Why No Matrix Strategy

Architecture specifies single-user, solo-developer project. Matrix testing across multiple Node/Python versions adds CI time without value. Pin to exact development versions:
- Node.js 22 (matches Expo SDK 54 requirement)
- Python 3.14 (matches architecture spec)

### What NOT To Do

- Do NOT add Docker build steps — deployment is manual `docker compose up` (Story 1.2)
- Do NOT add Expo build/preview steps — no EAS in V1
- Do NOT add code coverage reporting — no minimum threshold for First Light
- Do NOT add custom caching beyond what actions provide natively
- Do NOT use `npm` or `yarn` commands
- Do NOT add deployment steps or environment-specific workflows
- Do NOT add linting (Ruff/ESLint) as separate CI steps yet — can be added incrementally later
- Do NOT create multiple workflow files — one `ci.yml` is all that's needed

### Branch Protection (Manual Configuration — NOT in Code)

AC #2 requires PRs blocked when checks fail. This is configured in **GitHub repo settings**, not in code:

1. Go to repository Settings > Branches
2. Add branch protection rule for `main`
3. Enable "Require status checks to pass before merging"
4. Select the `ci` job as required status check

Document this in a comment in `ci.yml` (Task 5).

### Previous Story Intelligence (Story 1.1)

Story 1.1 established:
- **pnpm 10.30.1** with `packageManager` field in root `package.json`
- **Root scripts:** `schema:generate`, `test:schema`, `test:mobile`, `test:backend`, `test`, `typecheck`
- **pnpm-workspace.yaml** with `onlyBuiltDependencies` for `expo`, `react-native`, `esbuild`
- **uv** for Python deps via `pyproject.toml` — backend uses editable path dep to `module-schema/generated/`
- **Jest** for TS tests (25 tests in `packages/module-schema`)
- **pytest** for Python tests (16 tests in `apps/backend/tests`)
- **Schema generation** via `pnpm run schema:generate` — generates gitignored files needed before type checking
- **Code review fixes:** Root scripts hardened with `.venv` fallback + `uv run` fallback; schema generation prefers `uv run` then falls back to `.venv/bin/datamodel-codegen`

### Project Structure Notes

- `.github/workflows/ci.yml` is the **only new file** to create
- `apps/mobile/package.json` needs `typecheck` and `test` scripts added
- No changes to source code or existing test files
- Generated schema files are gitignored — CI must regenerate them

### References

- [Source: architecture.md#CI] — "GitHub Action running `pytest` + `pnpm test` + `pnpm tsc --noEmit`" (line 773)
- [Source: architecture.md#Project Directory Structure] — `.github/workflows/ci.yml` location (lines 1146-1148)
- [Source: architecture.md#Development Workflow] — Root scripts definition (lines 303-315)
- [Source: architecture.md#Linting Enforcement] — ESLint + Ruff rules (lines 1119-1132)
- [Source: epics.md#Story 1.1b] — Acceptance criteria (lines 417-435)
- [Source: story 1-1] — Monorepo setup, pnpm 10.x config, uv usage, test frameworks established
- [Source: web research Feb 2026] — GitHub Actions versions verified: checkout@v6, setup-node@v6, setup-python@v6, pnpm/action-setup@v4, astral-sh/setup-uv@v7

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- Story context engine analysis completed — comprehensive developer guide created
- GitHub Actions versions verified via web research (Feb 2026): checkout@v6, setup-node@v6, setup-python@v6
- Previous story (1.1) intelligence extracted: scripts, tools, test infrastructure, code review fixes
- Identified missing `typecheck` and `test` scripts in `apps/mobile/package.json`
- CI pipeline order validated: install → schema:generate → typecheck → test
- Implementation: Created `.github/workflows/ci.yml` matching architecture spec exactly
- Added `typecheck: "tsc --noEmit"` and `test: "jest --passWithNoTests"` to `apps/mobile/package.json`
- Installed jest + @types/jest as devDependencies in mobile workspace
- Local validation: typecheck passes (2 workspaces), JS tests pass (25), Python tests pass (16)
- Used `--passWithNoTests` for mobile jest since no test files exist yet — prevents CI failure
- ✅ Resolved review finding [HIGH]: Added `--frozen` flag to `uv sync` for CI reproducibility
- ✅ Resolved review finding [HIGH]: Branch protection documented with `gh api` CLI command (manual config by design)
- ✅ Resolved review finding [MEDIUM]: Added `concurrency` group to cancel redundant CI runs
- ✅ Resolved review finding [MEDIUM]: Added `timeout-minutes: 15` on ci job
- ✅ Resolved review finding [MEDIUM]: Justified PR trigger scope (main-only) with inline comment
- ✅ Resolved review finding [MEDIUM]: Justified recursive commands vs root scripts with inline comment
- ✅ Resolved review finding [MEDIUM]: Documented SHA pinning exception for solo-developer project
- ✅ Resolved review finding [LOW]: Added `permissions: { contents: read }`
- ✅ Resolved review finding [LOW]: Created `apps/mobile/jest.config.js` with `jest-expo` preset

### File List

- `NEW` .github/workflows/ci.yml — GitHub Actions CI workflow (with concurrency, permissions, timeout)
- `NEW` apps/mobile/jest.config.js — Minimal jest config with jest-expo preset
- `MOD` apps/mobile/package.json — Added `typecheck`, `test` scripts + jest, jest-expo, @types/jest devDependencies
- `MOD` pnpm-lock.yaml — Updated lockfile after jest + jest-expo install
- `MOD` _bmad-output/implementation-artifacts/sprint-status.yaml — Story status updated
- `MOD` _bmad-output/implementation-artifacts/1-1b-ci-pipeline.md — Story file updated

## Change Log

- 2026-02-23: Created CI pipeline with GitHub Actions — single job running schema generation, TypeScript type checking, JS/TS tests (25 pass), and Python tests (16 pass). Added missing `typecheck` and `test` scripts to `apps/mobile/package.json`. Used `jest --passWithNoTests` for mobile since no tests exist yet. All local validation passed.
- 2026-02-23: AI code review #1 — 1 HIGH, 3 MEDIUM, 1 LOW findings recorded as `Review Follow-ups (AI)`; story moved back to `in-progress` pending fixes / branch protection setup.
- 2026-02-23: AI code review #2 — 4 new findings added (1 HIGH: missing `--frozen` on uv sync, 2 MEDIUM: no concurrency group + no timeout-minutes, 1 LOW: missing jest.config.js). Total: 2 HIGH, 5 MEDIUM, 2 LOW. Story remains `in-progress`.
- 2026-02-23: Addressed all 9 code review findings — 2 HIGH, 5 MEDIUM, 2 LOW resolved. Added `--frozen` to uv sync, concurrency group, timeout-minutes, permissions block, inline justification comments. Created jest.config.js with jest-expo preset. All local validations pass (typecheck 2/2, JS tests 25/25, Python tests 16/16).
- 2026-02-23: Fixed CI failure — `uv sync --frozen` failed because `packages/module-schema/generated/` (gitignored path dependency) doesn't exist in fresh CI. Added scaffold step to create minimal Python package structure before `uv sync`, then `schema:generate` overwrites with real content.
