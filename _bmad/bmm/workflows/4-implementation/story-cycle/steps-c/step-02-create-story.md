---
name: 'step-02-create-story'
description: 'Phase 1: Spawn sub-agent to create the story file via create-story workflow'
---

# Step 2: Create Story

**Goal:** Delegate story creation to a sub-agent. Validate the output before proceeding.

---

## AVAILABLE STATE

- `{story_key}`, `{baseline_commit}`, `{execution_mode}`
- `{sprint_status}`, `{workflow_engine}`, `{create_story_workflow}`
- `{implementation_artifacts}`

---

## EXECUTION SEQUENCE

### 1. Spawn Sub-Agent

Use the **Task tool** with `subagent_type: "general-purpose"` and the following prompt:

```
You are executing a BMAD workflow to create a story file.

1. Load the workflow engine: Read {workflow_engine}
2. Load the workflow config: Read {create_story_workflow}
3. Follow the workflow engine instructions with this config to create story: {story_key}
4. Work autonomously — do NOT ask the user questions. Use your best judgment for all decisions.
5. The story file should be written to: {implementation_artifacts}/{story_key}.md
6. Update sprint-status.yaml to mark the story as ready-for-dev when complete.
```

### 2. Quality Gate

After the sub-agent completes, verify:

- [ ] Story file exists at `{implementation_artifacts}/{story_key}.md`
- [ ] File contains acceptance criteria
- [ ] File contains task breakdown
- [ ] Sprint-status shows `{story_key}` as `ready-for-dev`

Set `{story_file}` = `{implementation_artifacts}/{story_key}.md`

### 3. Gate Result

**All checks pass:**
- If `{execution_mode}` is "supervised" → display summary + PAUSE, wait for user to confirm
- Otherwise → proceed automatically

**Any check fails:**

Display:

```
## Create Story — Gate Failed

Failed checks:
{list failed checks}

[R] Retry  [M] Fix manually  [A] Abort
```

ALWAYS pause on gate failure regardless of execution mode.

- **R:** Re-run step 2 from the beginning
- **M:** Let user fix manually, then re-check gate
- **A:** Exit workflow

---

## NEXT STEP DIRECTIVE

When gate passes and confirmed:

**NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-03-dev-story.md`
