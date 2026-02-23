---
name: 'step-06-finalize'
description: 'Phase 5: Update roadmap, check epic completion, display summary, propose next action'
---

# Step 6: Finalize

**Goal:** Sync tracking files, update roadmap, summarize the cycle, propose next actions.

---

## AVAILABLE STATE

- `{story_key}`, `{story_file}`, `{baseline_commit}`, `{execution_mode}`
- `{sprint_status}`, `{roadmap_file}`
- `{retry_count}`

---

## EXECUTION SEQUENCE

### 1. Verify Final State

Read `{sprint_status}` and `{story_file}`:
- Confirm `{story_key}` status is `done`
- If not done, display warning and ask user how to proceed

### 2. Check Epic Completion

Parse `{sprint_status}` to find the epic containing `{story_key}`:
- List all stories in that epic
- If ALL stories have status `done` → mark the epic as `done` in sprint-status
- Display epic progress either way

### 3. Update Roadmap

Read and update `{roadmap_file}`:
- Update the story line: change `[ ]` or `[>]` or `[~]` to `[x]`
- Update the progress bar and stats (stories done count)
- Update the "Current focus" line to the next in-progress or backlog story
- Update the "Last updated" date
- If epic completed, update epic status display

### 4. Git Summary

Run `git diff --stat {baseline_commit}..HEAD` to get change stats.
Run `git log --oneline {baseline_commit}..HEAD` to get commit list.

### 5. Display Cycle Summary

```
## Story Cycle Complete

**Story:** {story_key}
**Status:** Done
**Mode:** {execution_mode}
**Retry loops:** {retry_count}/{max_retry_loops}

### Phases Executed
1. {Create Story — completed/skipped}
2. Dev Story — completed
3. Test — completed
4. Code Review — completed {with N retries if retry_count > 0}
5. Finalize — completed

### Git Stats
{git diff stat output}
{commit count} commits since baseline

### Sprint Progress
{epic name}: {done_count}/{total_count} stories done
{overall progress}: {total_done}/{total_stories} stories done

---

**Next Actions:**
[N] Run next story cycle
[S] Show sprint status
[E] Exit
```

### 6. Handle User Response

- **N:** Determine next eligible story, then restart from step 1 with new `{story_key}`
  - **NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-01-init.md`
- **S:** Display sprint-status summary, then re-show menu
- **E:** Exit workflow gracefully
