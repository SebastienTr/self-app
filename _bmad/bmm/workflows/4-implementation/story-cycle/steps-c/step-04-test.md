---
name: 'step-04-test'
description: 'Phase 3: Spawn sub-agent to generate additional tests via testarch-automate'
---

# Step 4: Test (Optional)

**Goal:** Generate additional automated tests for the implemented story. Tests only — no source code modifications.

---

## AVAILABLE STATE

- `{story_key}`, `{story_file}`, `{execution_mode}`
- `{testarch_automate_workflow}`

---

## EXECUTION SEQUENCE

### 1. Spawn Sub-Agent

Use the **Task tool** with `subagent_type: "general-purpose"` and the following prompt:

```
You are executing a BMAD TEA workflow to generate additional tests for a recently implemented story.

1. Load the workflow config: Read {testarch_automate_workflow}
2. Load the workflow instructions referenced in that config
3. Context: the story file at {story_file} describes what was implemented
4. Mode: BMad-Integrated — use the story file as context for test generation
5. CRITICAL: Do NOT modify any source code files. Only create or modify test files.
6. Work autonomously — do NOT ask the user questions.
7. Focus on critical paths and edge cases not covered by existing tests.
```

### 2. Quality Gate

After the sub-agent completes, verify:

- [ ] No source code files were modified (only test files created/modified)
- [ ] All tests pass (run the relevant test commands)

### 3. Gate Result

**All checks pass:**
- If `{execution_mode}` is "supervised" → display summary of new tests + PAUSE
- Otherwise → proceed automatically

**Any check fails:**

Display:

```
## Test — Gate Failed

Failed checks:
{list failed checks}

[F] Fix failing tests  [S] Skip (remove failing tests)  [M] Fix manually  [A] Abort
```

ALWAYS pause on gate failure regardless of execution mode.

- **F:** Spawn sub-agent to fix failing tests (tests only, no source modifications)
- **S:** Remove/revert the failing test files and proceed without them
- **M:** Let user fix manually, then re-check gate
- **A:** Exit workflow

---

## NEXT STEP DIRECTIVE

When gate passes (or skipped) and confirmed:

**NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-05-code-review.md`
