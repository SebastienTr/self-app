---
name: 'step-01-init'
description: 'Sprint assessment, story discovery, execution mode selection'
---

# Step 1: Initialization

**Goal:** Capture baseline, discover the target story, determine execution mode, present the plan.

---

## STATE VARIABLES (capture now, persist throughout)

- `{baseline_commit}` — Git HEAD at workflow start
- `{execution_mode}` — "supervised" (default), "gates-only", or "yolo"
- `{story_key}` — Target story identifier (e.g., "1-2-backend-skeleton-and-single-command-deployment")
- `{story_file}` — Path to story file (e.g., `{implementation_artifacts}/1-2-backend-skeleton-and-single-command-deployment.md`)
- `{skip_create}` — true if story already has a file (status >= ready-for-dev)
- `{retry_count}` — 0

---

## EXECUTION SEQUENCE

### 1. Capture Baseline

Run `git rev-parse HEAD` and store result as `{baseline_commit}`.

### 2. Load Sprint Status

Read `{sprint_status}` and parse the `development_status` section.

### 3. Determine Target Story

**If user provided a story key or identifier:**
- Match it against sprint-status entries
- Set `{story_key}` accordingly

**If no story specified:**
- Find the first story with status `ready-for-dev` in sprint-status
- If none found, find the first story with status `backlog` (whose epic is `in-progress` or whose preceding story is `done`)
- Set `{story_key}` to that story

**If no eligible story found:**
- Inform user: "No actionable story found in sprint-status. Run sprint planning or specify a story key."
- **STOP.**

### 4. Determine Skip Create

Read sprint-status for `{story_key}`:
- If status is `ready-for-dev`, `in-progress`, or `review` → `{skip_create}` = true
- If status is `backlog` → `{skip_create}` = false

### 5. Determine Execution Mode

If user specified a mode (supervised/gates-only/yolo), use it. Otherwise default to `supervised`.

### 6. Present Plan

Display to user:

```
## Story Cycle Plan

**Story:** {story_key}
**Baseline:** {baseline_commit}
**Mode:** {execution_mode}

**Phases:**
1. {skip_create ? "~~Create Story~~ (skipped — file exists)" : "Create Story"}
2. Dev Story (implement + TDD)
3. Test (generate additional tests)
4. Code Review (adversarial + auto-fix)
5. Finalize (update roadmap + summary)

Proceed? [Y] Yes  [M] Change mode  [S] Change story  [A] Abort
```

### 7. Handle User Response

- **Y:** Proceed to next step
- **M:** Ask for mode, update `{execution_mode}`, re-display plan
- **S:** Ask for story key, restart from step 3
- **A:** Exit workflow

**yolo/gates-only mode:** Skip confirmation, proceed directly.

---

## NEXT STEP DIRECTIVE

When confirmed:
- If `{skip_create}` is false → **NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-02-create-story.md`
- If `{skip_create}` is true → **NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-03-dev-story.md`
