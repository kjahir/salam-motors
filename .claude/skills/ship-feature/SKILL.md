---
name: ship-feature
description: Commit the current feature-branch changes, push, open a PR to main, merge it, and cut the next feature/i-N branch — this repo's standard ship workflow. Use when the user says "ship this", "commit push PR merge", "close out this branch", or similar, on this repo.
---

# Ship feature and cut next branch

This repo's convention (see `git log --oneline` on `main`): every unit of work
lives on its own `feature/i-N` branch, gets exactly one PR into `main` titled
after the change, is merged with a regular merge commit (never squash/rebase —
history shows `Merge pull request #N from kjahir/feature/i-N`), and the branch
is left in place afterward (old `feature/i-1`..`feature/i-N` branches are never
deleted). Immediately after merging, a fresh `feature/i-(N+1)` branch is cut
from the updated `main` so the next task always starts clean.

## Steps

1. **Check for foreign untracked/pending work before staging anything.**
   Run `git status` and `git log --oneline main -5`. If there are untracked
   files that don't belong to the current task (e.g. a migration or WIP file
   from a different, unrelated piece of work — check its content/timestamp
   against what you actually did this session), **exclude it** from staging
   with a pathspec exclusion, e.g.:
   ```
   git add -A -- . ':!path/to/unrelated/file'
   ```
   Never sweep unrelated WIP into your commit just because `git add -A` would
   pick it up. When genuinely unsure whether an untracked file is yours, ask
   before staging it.

2. **Determine the branch name.** Find the highest existing `feature/i-N`
   (local + remote): `git branch -a | grep -oE 'feature/i-[0-9]+' | grep -oE '[0-9]+' | sort -n | tail -1`.
   If you're already on an unmerged `feature/i-N` branch with the pending
   changes, commit there. If the current branch's PR is already merged
   (check with `gh pr list --state all --head <branch>`), create a new
   `feature/i-(N+1)` branch first — don't push new work onto an already-shipped
   branch.

3. **Commit.** Write a message that summarizes the *why*, matching this
   repo's style (imperative subject line, body describing each distinct
   piece of work as a bullet if there are several). Only commit when the
   user has actually asked to commit — this skill assumes that's already
   been established by the invocation.

4. **Push**: `git push -u origin <branch>`.

5. **Open the PR**: `gh pr create --base main --head <branch> --title "..." --body "..."`.
   Body format, matching existing PRs on this repo:
   ```
   ## Summary
   - bullet per distinct change

   ## Test plan
   - [x] things you actually verified (tsc/eslint/build/smoke tests)
   - [ ] things that need manual/live verification you couldn't do yourself
   ```

6. **Merge**: `gh pr merge <number> --merge --delete-branch=false`. Always
   `--merge` (not `--squash`/`--rebase`) to match history. Always
   `--delete-branch=false` — this repo keeps every feature branch around.
   Verify with `gh pr view <number> --json state,mergedAt` before moving on.

7. **Cut the next branch**:
   ```
   git checkout main && git pull origin main --quiet
   git checkout -b feature/i-(N+1)
   git push -u origin feature/i-(N+1)
   ```

## Guardrails

- This performs real, hard-to-reverse actions (push, PR, merge) against a
  shared remote. Only run it when the user has explicitly asked to ship —
  never proactively.
- Never force-push, never delete a branch, never squash/rebase-merge on this
  repo.
- If `gh pr create`/`gh pr merge` fails (checks required, conflicts, etc.),
  stop and surface the exact error rather than working around it.
