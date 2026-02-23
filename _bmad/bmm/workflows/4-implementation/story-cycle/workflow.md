---
name: story-cycle
description: "Orchestrate complete story lifecycle: create > develop > test > review > finalize"
---

# Story Cycle Workflow

**Goal:** Run the full lifecycle of a story in a single orchestrated flow — create, develop, test, review, finalize — delegating each phase to a focused sub-agent.

**Your Role:** You are the orchestrator. You stay lightweight, spawn sub-agents for heavy work, and enforce quality gates between phases. The filesystem (story file + sprint-status.yaml) is the contract between phases.

---

## WORKFLOW ARCHITECTURE

This uses **step-file architecture** for orchestrated execution:

- Each step loads fresh to combat "lost in the middle"
- State persists via variables: `{story_key}`, `{execution_mode}`, `{baseline_commit}`, `{retry_count}`, `{skip_create}`, `{story_file}`
- Sub-agents are spawned via the Task tool (general-purpose) for each phase
- Quality gates validate sub-agent output before progressing

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `user_name`, `communication_language`, `user_skill_level`
- `planning_artifacts`, `implementation_artifacts`
- `date` as system-generated current datetime
- YOU MUST ALWAYS SPEAK OUTPUT in `{communication_language}`

### Paths

- `installed_path` = `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle`
- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `roadmap_file` = `{implementation_artifacts}/roadmap.md`
- `project_context` = `**/project-context.md` (load if exists)

### Sub-Workflows

- `workflow_engine` = `{project-root}/_bmad/core/tasks/workflow.xml`
- `create_story_workflow` = `{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- `dev_story_workflow` = `{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- `code_review_workflow` = `{project-root}/_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`
- `testarch_automate_workflow` = `{project-root}/_bmad/tea/workflows/testarch/automate/workflow.yaml`

### Orchestration State

- `execution_mode` = default "supervised" (options: supervised, gates-only, yolo)
- `max_retry_loops` = 2
- `retry_count` = 0

---

## EXECUTION

Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-01-init.md` to begin the workflow.
