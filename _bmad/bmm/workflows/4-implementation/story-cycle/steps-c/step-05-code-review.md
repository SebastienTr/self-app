---
name: 'step-05-code-review'
description: 'Phase 4: Spawn sub-agent for adversarial code review with retry loop'
---

# Step 5: Code Review

**Goal:** Run adversarial code review. Auto-fix HIGH/MEDIUM issues. Retry dev if needed.

---

## AVAILABLE STATE

- `{story_key}`, `{story_file}`, `{execution_mode}`
- `{sprint_status}`, `{workflow_engine}`, `{code_review_workflow}`
- `{retry_count}`, `{max_retry_loops}` (default 2)

---

## EXECUTION SEQUENCE

### 1. Spawn Sub-Agent

Use the **Task tool** with `subagent_type: "general-purpose"` and the following prompt:

```
You are executing a BMAD workflow for adversarial code review.

1. Load the workflow engine: Read {workflow_engine}
2. Load the workflow config: Read {code_review_workflow}
3. Follow the workflow engine instructions to review the story: {story_file}
4. Work autonomously — do NOT ask the user questions.
5. For each issue found:
   - HIGH severity: auto-fix immediately
   - MEDIUM severity: auto-fix immediately
   - LOW severity: document in the story file Review Follow-ups section
6. After fixing, re-run affected tests to verify fixes don't break anything.
7. Update the story file status to "done" if all HIGH/MEDIUM issues are resolved and all ACs are met.
8. Update sprint-status.yaml accordingly.
```

### 2. Quality Gate

After the sub-agent completes, read the story file and sprint-status. Evaluate:

**Case A — Story done:**
- Story file status = `done`
- Sprint-status shows `{story_key}` as `done`
- → Proceed to step 6

**Case B — Issues remain, retries available:**
- Story file status = `in-progress` or `review`
- `{retry_count}` < `{max_retry_loops}`
- → Increment `{retry_count}`
- → Loop back to step 3 (dev-story) for fixes

**Case C — Retries exhausted:**
- `{retry_count}` >= `{max_retry_loops}`
- → Escalate to user

### 3. Gate Result

**Case A (done):**
- If `{execution_mode}` is "supervised" → display review summary + PAUSE
- Otherwise → proceed automatically

**Case B (retry):**
- If `{execution_mode}` is "supervised" → display issues + PAUSE, ask confirmation to retry
- If `{execution_mode}` is "gates-only" or "yolo" → retry automatically
- **NEXT (after confirmation):** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-03-dev-story.md`

**Case C (exhausted):**

Display:

```
## Code Review — Retries Exhausted

{retry_count} retry loops completed. Remaining issues:
{list remaining issues from story file}

[F] Force done (accept remaining issues as tech debt)
[M] Fix manually, then re-check
[A] Abort
```

ALWAYS pause when retries are exhausted regardless of execution mode.

- **F:** Mark story as done with remaining LOW issues documented, proceed to step 6
- **M:** Let user fix manually, then re-check gate
- **A:** Exit workflow

---

## NEXT STEP DIRECTIVE

When Case A or forced done:

**NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-06-finalize.md`
