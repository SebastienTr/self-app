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

Read `{sprint_status}` to compute current counts, then read and update `{roadmap_file}`:

**3a. Update Dashboard (top of file)**

The dashboard is a fenced code block after `## Dashboard`. Update ALL of these:

1. **Banner box** — update wave, story key, and status to reflect the NEXT story to work on:
   ```
   ║  WAVE {n} · Story {next_key} · {next_status}              ║
   ║  Next milestone: ...                                       ║
   ```

2. **TOTAL progress bar** — recalculate `{done}/{total}` from sprint-status and regenerate:
   ```
   TOTAL   [▓▓▓░░░░░░░░░░░░░░░░░]  {done}/56 done ({pct}%)
   ```
   Use 20 chars: `▓` = round(done/56 * 20), rest `░`

3. **Wave bars** — each char = 1 story. For each wave, rebuild the bar from sprint-status:
   - `▓` = done, `~` = review or in-progress, `·` = backlog/ready-for-dev
   - Update the count `{done}/{total}`
   - Mark current wave with `<< ICI`

4. **Epic heatmap** — same char logic as waves, rebuild each epic line:
   - `▓` = done, `~` = review or in-progress, `·` = backlog/ready-for-dev
   - Update counts, mark active epic with `<<`

**3b. Update Story Detail Sections (below dashboard)**

- Update the story line: change `[ ]` or `[>]` or `[~]` to `[x]`
- Update the "Current focus" line to the next in-progress or backlog story
- Update the "Last updated" date
- If epic completed, update epic status display

**3c. Update README Project Status**

Read `{project-root}/README.md` and update the `## Project Status` section:

1. **Progress bar** — same formula as roadmap TOTAL bar (20 chars, `▓`/`░`)
2. **Phase table** — update the "Done" column for each phase:
   - First Light = epics 1–4
   - MVP = epics 5–10
   - Growth = epics 11–15
   - Set Status to `**In Progress**` if any story is in-progress/review, `**Done**` if all done
3. **Current focus / Next up** — match the roadmap's current wave and next story

### 4. Commit and Push

**4a. Stage all changes**

Run `git add -A` to stage all modified, new, and deleted files.

**4b. Create commit**

Run `git commit` with a message following this format:
```
feat({story_key}): {one-line summary of what the story implemented}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Use the story title and acceptance criteria to write a concise, meaningful commit message.

**4c. Push to remote**

Run `git push`. If the current branch has no upstream, use `git push -u origin HEAD`.

**4d. If push fails:**
- Display the error to the user
- PAUSE and ask how to proceed (force push, pull --rebase first, or abort)

### 5. Wait for GitHub Actions CI

**5a. Get the CI run**

After push, wait 10 seconds for GitHub Actions to pick up the commit, then run:
```
gh run list --branch $(git branch --show-current) --limit 1 --json databaseId,status,conclusion,name
```

If no run found, wait another 15 seconds and retry once.

**5b. Monitor CI status**

Poll the CI run until completion:
```
gh run watch {run_id} --exit-status
```

This blocks until the run completes and exits non-zero if the run fails.

**5c. Handle CI result**

**CI passes:**
- Display: `✅ CI passed — all checks green`
- Proceed to step 6

**CI fails:**
- Run `gh run view {run_id} --log-failed` to get failure details
- Display the failure summary to the user

```
## ❌ CI Failed

**Run:** {run_id}
**Failed step:** {failed_step_name}

{failure log excerpt}

[F] Fix and re-push  [I] Ignore (proceed anyway)  [A] Abort
```

ALWAYS pause on CI failure regardless of execution mode.

- **F:** Analyze the failure, fix the issue, then re-run from step 4 (commit + push + CI again)
- **I:** Proceed to step 6 with a warning in the cycle summary
- **A:** Exit workflow

### 6. Git Summary

Run `git diff --stat {baseline_commit}..HEAD` to get change stats.
Run `git log --oneline {baseline_commit}..HEAD` to get commit list.

### 7. Display Cycle Summary

```
## Story Cycle Complete

**Story:** {story_key}
**Status:** Done
**Mode:** {execution_mode}
**Retry loops:** {retry_count}/{max_retry_loops}
**CI:** {pass/fail/skipped}

### Phases Executed
1. {Create Story — completed/skipped}
2. Dev Story — completed
3. Test — completed
4. Code Review — completed {with N retries if retry_count > 0}
5. Finalize — completed
6. Commit + Push + CI — {passed/failed/skipped}

### Git Stats
{git diff stat output}
{commit count} commits since baseline

### Sprint Progress
{epic name}: {done_count}/{total_count} stories done
{overall progress}: {total_done}/{total_stories} stories done

---

### How to Test

{Write 2-5 lines explaining the simplest way for the user to manually verify the feature. Be concrete: which command to run, which URL to open, what to tap in the app, what result to expect. Base this on the story's acceptance criteria and the files that were changed. No fluff — just the fastest path to "it works".}

---

**Next Actions:**
[N] Run next story cycle
[S] Show sprint status
[E] Exit
```

### 8. Handle User Response

- **N:** Determine next eligible story, then restart from step 1 with new `{story_key}`
  - **NEXT:** Read fully and follow: `{project-root}/_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-01-init.md`
- **S:** Display sprint-status summary, then re-show menu
- **E:** Exit workflow gracefully
