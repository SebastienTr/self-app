---
name: 'step-03-dev-story'
description: 'Phase 2: Spawn sub-agent to implement the story via dev-story workflow'
---

# Step 3: Dev Story

**Goal:** Delegate story implementation to a sub-agent. Validate output before proceeding.

---

## AVAILABLE STATE

- `{story_key}`, `{story_file}`, `{baseline_commit}`, `{execution_mode}`
- `{sprint_status}`, `{workflow_engine}`, `{dev_story_workflow}`
- `{retry_count}` — may be > 0 if returning from code review retry loop

---

## EXECUTION SEQUENCE

### 1. Spawn Sub-Agent

Use the **Task tool** with `subagent_type: "general-purpose"` and the following prompt:

```
You are executing a BMAD workflow to implement a story.

1. Load the workflow engine: Read {workflow_engine}
2. Load the workflow config: Read {dev_story_workflow}
3. Follow the workflow engine instructions to implement the story file at: {story_file}
4. Work autonomously — do NOT ask the user questions. Use your best judgment for all decisions.
5. Follow TDD practices: write tests first, then implement, then verify all tests pass.
6. Do NOT use git worktree — changes must persist in the main working directory.
7. When complete, update the story file status to "review" and mark all tasks as [x].
8. Update sprint-status.yaml to reflect the new status.
```

**IMPORTANT:** Do NOT use `isolation: "worktree"` — changes must persist in the main working directory.

### 2. Quality Gate

After the sub-agent completes, verify:

- [ ] Story file `{story_file}` has status = `review`
- [ ] All task checkboxes in the story file are `[x]`
- [ ] Sprint-status shows `{story_key}` as `review`
- [ ] Tests pass (run the relevant test command from the story file)

### 3. Gate Result

**All checks pass:**
- If `{execution_mode}` is "supervised" → display summary + PAUSE
- Otherwise → proceed automatically

**Any check fails:**

Display:

```
## Dev Story — Gate Failed

Failed checks:
{list failed checks}

[R] Retry  [M] Fix manually  [A] Abort
```

ALWAYS pause on gate failure regardless of execution mode.

- **R:** Re-run step 3 from the beginning
- **M:** Let user fix manually, then re-check gate
- **A:** Exit workflow

---

## NEXT STEP DIRECTIVE

When gate passes and confirmed:

**NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-04-test.md`
